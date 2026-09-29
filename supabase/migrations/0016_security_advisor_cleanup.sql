-- Security-advisor cleanup (NOT applied to any live project by this PR).
--
-- Clears:
--   1. ERROR security_definer_view on public.partner_profiles, and the
--      writable path through that view (authenticated held INSERT/UPDATE/DELETE
--      because 0014 revoked only from public/anon while default privileges
--      had already granted ALL to authenticated).
--   2. INFO rls_enabled_no_policy on public.stripe_events: make service-role
--      intent explicit (COMMENT + revoke client privileges + deny policy).
--   3. Grant hygiene on SECURITY DEFINER helpers + response_has_content;
--      harden search_path to '' with fully qualified names where safe.
--
-- Privacy guarantee for partner reads is unchanged: only id, display_name,
-- avatar_url, username of JOINED co-members of the caller's connections.

-- ---------------------------------------------------------------------------
-- 1. partner_profiles: SECURITY DEFINER function + read-only invoker view
-- ---------------------------------------------------------------------------
-- Function is the access-control boundary (runs as owner, filters by
-- auth.uid() + joined_at). View is security_invoker so the advisor no longer
-- flags it; selecting from a set-returning function makes the view
-- non-updatable. Same columns/name → existing .from("partner_profiles")
-- callers keep working (safe either deploy order).

create or replace function public.partner_profile_rows()
returns table (
  id uuid,
  display_name text,
  avatar_url text,
  username text
)
language sql
security definer
stable
set search_path = ''
as $$
  select
    p.id,
    p.display_name,
    p.avatar_url,
    p.username
  from public.profiles p
  where exists (
    select 1
    from public.connection_members me
    join public.connection_members them
      on them.connection_id = me.connection_id
     and them.user_id = p.id
     and them.joined_at is not null
    where me.user_id = auth.uid()
      and me.joined_at is not null
  );
$$;

revoke all on function public.partner_profile_rows() from public, anon;
revoke execute on function public.partner_profile_rows() from public, anon;
grant execute on function public.partner_profile_rows() to authenticated, service_role;

drop view if exists public.partner_profiles;

create view public.partner_profiles
with (security_invoker = true)
as
select id, display_name, avatar_url, username
from public.partner_profile_rows();

comment on view public.partner_profiles is
  'Read-only display fields (id, display_name, avatar_url, username) for '
  'joined co-members of the caller''s connections. Backed by '
  'partner_profile_rows(); not updatable.';

-- Default privileges may have granted ALL to authenticated on CREATE VIEW.
-- Revoke everything first, then grant SELECT only.
revoke all on public.partner_profiles from public, anon, authenticated;
grant select on public.partner_profiles to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. stripe_events: service-role only
-- ---------------------------------------------------------------------------
comment on table public.stripe_events is
  'Service-role only. Stripe webhook idempotency log; clients have no access. '
  'RLS is enabled with an explicit deny policy for anon/authenticated; the '
  'webhook uses SUPABASE_SERVICE_ROLE_KEY (bypasses RLS).';

revoke all on public.stripe_events from public, anon, authenticated;

drop policy if exists stripe_events_deny_clients on public.stripe_events;
create policy stripe_events_deny_clients on public.stripe_events
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

grant all on public.stripe_events to service_role;

-- ---------------------------------------------------------------------------
-- 3. response_has_content: revoke PUBLIC/anon (internal helper only)
-- ---------------------------------------------------------------------------
create or replace function public.response_has_content(p_answers jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select exists (
    select 1
    from jsonb_each_text(coalesce(p_answers, '{}'::jsonb))
    where btrim(value) <> ''
  );
$$;

revoke all on function public.response_has_content(jsonb) from public, anon, authenticated;
revoke execute on function public.response_has_content(jsonb) from public, anon, authenticated;
-- Owned by postgres; SECURITY DEFINER callers invoke it as owner. No client RPC.

-- ---------------------------------------------------------------------------
-- 4. Harden SECURITY DEFINER helpers (search_path = '', qualified names)
--    Keep authenticated EXECUTE only where RLS policies or app RPCs need it.
-- ---------------------------------------------------------------------------

create or replace function public.is_connection_member(conn uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.connection_members m
    where m.connection_id = conn
      and m.user_id = auth.uid()
      and m.joined_at is not null
  );
$$;

create or replace function public.has_answered(p_instance uuid, p_user uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select case
    when auth.uid() is not null and p_user is distinct from auth.uid() then false
    else exists (
      select 1
      from public.prompt_responses r
      where r.instance_id = p_instance
        and r.user_id = p_user
        and public.response_has_content(r.answers)
    )
  end;
$$;

create or replace function public.has_premium(uid uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select (auth.uid() is null or uid = auth.uid())
     and exists (
       select 1
       from public.subscriptions s
       where s.user_id = uid
         and s.plan = 'premium'
         and s.status in ('active', 'trialing')
     );
$$;

create or replace function public.others_have_answered(p_instance uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select
    public.is_connection_member(
      (select i.connection_id from public.prompt_instances i where i.id = p_instance)
    )
    and exists (
      select 1
      from public.prompt_responses r
      where r.instance_id = p_instance
        and r.user_id is distinct from auth.uid()
        and public.response_has_content(r.answers)
    );
$$;

create or replace function public.accept_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  conn         public.connections%rowtype;
  uid          uuid := auth.uid();
  member_count int;
begin
  if uid is null then raise exception 'not authenticated'; end if;

  select * into conn from public.connections
   where invite_code = p_code
     and invite_expires_at is not null
     and invite_expires_at > now()
   for update;
  if not found then raise exception 'invalid or expired invite'; end if;

  if conn.created_by = uid then raise exception 'cannot accept your own invite'; end if;

  if conn.status in ('archived', 'blocked') then
    raise exception 'invalid or expired invite';
  end if;

  select count(*) into member_count
    from public.connection_members
   where connection_id = conn.id;
  if member_count >= 2 then raise exception 'connection is full'; end if;

  if exists (
    select 1 from public.connection_members
     where connection_id = conn.id and user_id = uid
  ) then
    raise exception 'already a member';
  end if;

  insert into public.connection_members (connection_id, user_id, role, joined_at)
  values (conn.id, uid, 'member', now());

  perform set_config('app.bypass_connection_guards', '1', true);

  update public.connections
     set status = case when status = 'pending' then 'onboarding' else status end,
         invite_code = null,
         invite_expires_at = null,
         updated_at = now()
   where id = conn.id;

  return conn.id;
end;
$$;

create or replace function public.ensure_daily_prompt(p_conn uuid, p_date date default current_date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type public.connection_type;
  v_tmpl public.prompt_templates%rowtype;
  v_id   uuid;
begin
  if auth.uid() is not null and not public.is_connection_member(p_conn) then
    raise exception 'not a member of this connection';
  end if;

  select id into v_id from public.prompt_instances
   where connection_id = p_conn and kind = 'daily' and scheduled_for = p_date;
  if found then return v_id; end if;

  select type into v_type from public.connections where id = p_conn;
  if v_type is null then return null; end if;

  select * into v_tmpl from public.prompt_templates t
   where t.kind = 'daily' and t.active
     and (t.relationship_type = v_type or t.relationship_type is null)
     and not exists (
       select 1 from public.prompt_instances i
        where i.connection_id = p_conn and i.template_id = t.id
     )
   order by (t.relationship_type = v_type) desc, random()
   limit 1;

  if not found then
    select * into v_tmpl from public.prompt_templates t
     where t.kind = 'daily' and t.active
       and (t.relationship_type = v_type or t.relationship_type is null)
     order by (t.relationship_type = v_type) desc, random()
     limit 1;
  end if;
  if not found then return null; end if;

  insert into public.prompt_instances
    (connection_id, template_id, kind, questions, scheduled_for, status)
  values
    (p_conn, v_tmpl.id, 'daily', v_tmpl.questions, p_date, 'open')
  on conflict (connection_id, kind, scheduled_for) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.prompt_instances
     where connection_id = p_conn and kind = 'daily' and scheduled_for = p_date;
  end if;
  return v_id;
end;
$$;

create or replace function public.regenerate_invite(p_conn uuid)
returns text
language plpgsql
security definer
-- public + extensions: gen_random_bytes lives in public (local pgcrypto) or
-- extensions (typical Supabase). Tables are still referenced as public.*.
set search_path = public, extensions
as $$
declare
  uid   uuid := auth.uid();
  conn  public.connections%rowtype;
  n     int;
  code  text;
begin
  if uid is null then raise exception 'not authenticated'; end if;

  select * into conn from public.connections where id = p_conn for update;
  if not found then raise exception 'connection not found'; end if;

  if not exists (
    select 1 from public.connection_members m
     where m.connection_id = p_conn and m.user_id = uid and m.joined_at is not null
  ) then
    raise exception 'not a member of this connection';
  end if;

  if conn.status in ('archived', 'blocked') then
    raise exception 'connection is closed';
  end if;

  select count(*) into n from public.connection_members where connection_id = p_conn;
  if n >= 2 then raise exception 'connection is full'; end if;

  loop
    code := upper(substr(regexp_replace(
              encode(gen_random_bytes(9), 'base64'),
              '[^A-Za-z0-9]', '', 'g'), 1, 8));
    exit when length(code) = 8
      and not exists (select 1 from public.connections c where c.invite_code = code);
  end loop;

  perform set_config('app.bypass_connection_guards', '1', true);
  update public.connections
     set invite_code = code,
         invite_expires_at = null,
         updated_at = now()
   where id = p_conn;

  return code;
end;
$$;

create or replace function public.connection_zodiac_compat(p_conn uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  b1 date;
  b2 date;
  s1 text;
  s2 text;
  e1 text;
  e2 text;
  lvl text;
  blurb text;
begin
  if not public.is_connection_member(p_conn) then
    return null;
  end if;

  select p.birthday into b1
    from public.connection_members m
    join public.profiles p on p.id = m.user_id
   where m.connection_id = p_conn and m.joined_at is not null
   order by m.joined_at, m.user_id
   limit 1;

  select p.birthday into b2
    from public.connection_members m
    join public.profiles p on p.id = m.user_id
   where m.connection_id = p_conn and m.joined_at is not null
   order by m.joined_at, m.user_id
   offset 1 limit 1;

  if b1 is null or b2 is null then
    return null;
  end if;

  s1 := public._sun_sign_name(b1);
  s2 := public._sun_sign_name(b2);
  if s1 is null or s2 is null then
    return null;
  end if;

  e1 := public._sun_sign_element(s1);
  e2 := public._sun_sign_element(s2);

  if e1 = e2 then
    lvl := 'high';
  elsif (e1 = 'Fire' and e2 = 'Air') or (e1 = 'Air' and e2 = 'Fire')
     or (e1 = 'Earth' and e2 = 'Water') or (e1 = 'Water' and e2 = 'Earth') then
    lvl := 'high';
  elsif (e1 = 'Fire' and e2 = 'Water') or (e1 = 'Water' and e2 = 'Fire')
     or (e1 = 'Earth' and e2 = 'Air') or (e1 = 'Air' and e2 = 'Earth') then
    lvl := 'low';
  else
    lvl := 'medium';
  end if;

  blurb := s1 || ' & ' || s2 || ' — ' || case lvl
    when 'high' then 'a naturally easy, complementary vibe ✨'
    when 'low' then 'opposites that keep things interesting'
    else 'different energies that can balance each other'
  end;

  return jsonb_build_object(
    'level', lvl,
    'blurb', blurb,
    'signs', jsonb_build_array(s1, s2)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Re-assert EXECUTE grants (CREATE OR REPLACE resets default PUBLIC grant)
-- ---------------------------------------------------------------------------
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.maybe_reveal_instance() from public, anon, authenticated;
revoke execute on function public.assign_daily_prompts(date) from public, anon, authenticated;
revoke execute on function public.connection_add_creator_member() from public, anon, authenticated;
revoke execute on function public._sun_sign_name(date) from public, anon, authenticated;
revoke execute on function public._sun_sign_element(text) from public, anon, authenticated;

revoke execute on function public.is_connection_member(uuid) from public, anon;
revoke execute on function public.has_answered(uuid, uuid) from public, anon;
revoke execute on function public.has_premium(uuid) from public, anon;
revoke execute on function public.others_have_answered(uuid) from public, anon;
revoke execute on function public.accept_invite(text) from public, anon;
revoke execute on function public.ensure_daily_prompt(uuid, date) from public, anon;
revoke execute on function public.regenerate_invite(uuid) from public, anon;
revoke execute on function public.connection_zodiac_compat(uuid) from public, anon;
revoke execute on function public.partner_profile_rows() from public, anon;

grant execute on function public.is_connection_member(uuid) to authenticated, service_role;
grant execute on function public.has_answered(uuid, uuid) to authenticated, service_role;
grant execute on function public.has_premium(uuid) to authenticated, service_role;
grant execute on function public.others_have_answered(uuid) to authenticated, service_role;
grant execute on function public.accept_invite(text) to authenticated;
grant execute on function public.ensure_daily_prompt(uuid, date) to authenticated, service_role;
grant execute on function public.regenerate_invite(uuid) to authenticated;
grant execute on function public.connection_zodiac_compat(uuid) to authenticated, service_role;
grant execute on function public.partner_profile_rows() to authenticated, service_role;
