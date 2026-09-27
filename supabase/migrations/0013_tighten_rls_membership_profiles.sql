-- Tighten RLS for connection membership and profiles.
--
-- Membership joins go only through SECURITY DEFINER RPCs (accept_invite) or the
-- creator auto-membership trigger — not direct client inserts.
-- Partner profile reads are limited to display fields via partner_profiles.
-- Invite codes get a 14-day expiry (confirm with product owner after review).

-- ---------------------------------------------------------------------------
-- 1. response_has_content: pin search_path
-- ---------------------------------------------------------------------------
create or replace function response_has_content(p_answers jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select exists (
    select 1 from jsonb_each_text(coalesce(p_answers, '{}'::jsonb))
    where btrim(value) <> ''
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. Membership helper: require a completed join (joined_at set)
-- ---------------------------------------------------------------------------
create or replace function is_connection_member(conn uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from connection_members m
    where m.connection_id = conn
      and m.user_id = auth.uid()
      and m.joined_at is not null
  );
$$;

-- ---------------------------------------------------------------------------
-- 3. has_answered / has_premium: only answer about the caller
--    (RLS policies already pass auth.uid(); this blocks cross-user RPC probes.)
-- ---------------------------------------------------------------------------
create or replace function has_answered(p_instance uuid, p_user uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select case
    when auth.uid() is not null and p_user is distinct from auth.uid() then false
    else exists (
      select 1 from prompt_responses r
      where r.instance_id = p_instance
        and r.user_id = p_user
        and response_has_content(r.answers)
    )
  end;
$$;

create or replace function has_premium(uid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select case
    when auth.uid() is not null and uid is distinct from auth.uid() then false
    else exists (
      select 1 from subscriptions s
      where s.user_id = uid
        and s.plan = 'premium'
        and s.status in ('active', 'trialing')
    )
  end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Creator auto-membership on connection create (replaces client insert)
-- ---------------------------------------------------------------------------
create or replace function connection_add_creator_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is not null then
    insert into connection_members (connection_id, user_id, role, joined_at)
    values (new.id, new.created_by, 'creator', now())
    on conflict (connection_id, user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_connection_add_creator on connections;
create trigger trg_connection_add_creator
  after insert on connections
  for each row execute function connection_add_creator_member();

revoke execute on function connection_add_creator_member() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Invite expiry: backfill open invites; set default when a code is assigned
-- ---------------------------------------------------------------------------
update connections
   set invite_expires_at = greatest(
         created_at + interval '14 days',
         now() + interval '1 day'
       )
 where invite_code is not null
   and invite_expires_at is null;

create or replace function connections_set_invite_expiry()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.invite_code is null then
    new.invite_expires_at := null;
  elsif tg_op = 'INSERT' then
    if new.invite_expires_at is null then
      new.invite_expires_at := now() + interval '14 days';
    end if;
  elsif new.invite_code is distinct from old.invite_code
        or new.invite_expires_at is null then
    new.invite_expires_at := now() + interval '14 days';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_connections_invite_expiry on connections;
create trigger trg_connections_invite_expiry
  before insert or update on connections
  for each row execute function connections_set_invite_expiry();

-- ---------------------------------------------------------------------------
-- 6. Guard client updates on connections (status / onboarding_done only)
--    RPCs set app.bypass_connection_guards for invite burn, etc.
-- ---------------------------------------------------------------------------
create or replace function connections_protect_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null
     and current_setting('app.bypass_connection_guards', true) is distinct from '1'
  then
    if new.id is distinct from old.id
       or new.type is distinct from old.type
       or new.created_by is distinct from old.created_by
       or new.invite_code is distinct from old.invite_code
       or new.invite_expires_at is distinct from old.invite_expires_at
       or new.sub_type is distinct from old.sub_type
       or new.life_stage is distinct from old.life_stage
       or new.start_date is distinct from old.start_date
       or new.metadata is distinct from old.metadata
       or new.created_at is distinct from old.created_at
    then
      raise exception 'connections: column update not permitted';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_connections_protect_columns on connections;
create trigger trg_connections_protect_columns
  before update on connections
  for each row execute function connections_protect_columns();

-- ---------------------------------------------------------------------------
-- 7. accept_invite: validate expiry, member cap, server-side joined_at
-- ---------------------------------------------------------------------------
create or replace function accept_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  conn         connections%rowtype;
  uid          uuid := auth.uid();
  member_count int;
begin
  if uid is null then raise exception 'not authenticated'; end if;

  select * into conn from connections
   where invite_code = p_code
     and invite_expires_at is not null
     and invite_expires_at > now()
   for update;
  if not found then raise exception 'invalid or expired invite'; end if;

  if conn.created_by = uid then raise exception 'cannot accept your own invite'; end if;

  select count(*) into member_count
    from connection_members
   where connection_id = conn.id;
  if member_count >= 2 then raise exception 'connection is full'; end if;

  if exists (
    select 1 from connection_members
     where connection_id = conn.id and user_id = uid
  ) then
    raise exception 'already a member';
  end if;

  insert into connection_members (connection_id, user_id, role, joined_at)
  values (conn.id, uid, 'member', now());

  perform set_config('app.bypass_connection_guards', '1', true);

  update connections
     set status = case when status = 'pending' then 'onboarding' else status end,
         invite_code = null,
         invite_expires_at = null,
         updated_at = now()
   where id = conn.id;

  return conn.id;
end;
$$;

revoke execute on function accept_invite(text) from public, anon;
grant execute on function accept_invite(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. connection_members: no direct client insert/update
-- ---------------------------------------------------------------------------
drop policy if exists members_insert on connection_members;
drop policy if exists members_update on connection_members;

drop policy if exists members_select on connection_members;
create policy members_select on connection_members for select to authenticated
  using (is_connection_member(connection_id));

-- ---------------------------------------------------------------------------
-- 9. prompt_instances: members insert/select only; no client updates
--    (reveal transitions are SECURITY DEFINER triggers)
-- ---------------------------------------------------------------------------
drop policy if exists instances_update on prompt_instances;

create or replace function prompt_instances_protect_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null
     and current_setting('app.bypass_instance_guards', true) is distinct from '1'
  then
    raise exception 'prompt_instances: client update not permitted';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prompt_instances_protect on prompt_instances;
create trigger trg_prompt_instances_protect
  before update on prompt_instances
  for each row execute function prompt_instances_protect_columns();

create or replace function maybe_reveal_instance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  member_count   int;
  response_count int;
  conn_id        uuid;
begin
  select connection_id into conn_id
    from prompt_instances where id = new.instance_id for update;

  select count(*) into member_count
    from connection_members
   where connection_id = conn_id and joined_at is not null;
  select count(*) into response_count
    from prompt_responses
   where instance_id = new.instance_id and response_has_content(answers);

  if member_count > 1 and response_count >= member_count then
    perform set_config('app.bypass_instance_guards', '1', true);
    update prompt_instances
       set status = 'revealed', revealed_at = now()
     where id = new.instance_id and status = 'open';
  end if;
  return new;
end;
$$;

revoke execute on function maybe_reveal_instance() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 10. prompt_responses: insert only while instance is open (not revealed)
-- ---------------------------------------------------------------------------
drop policy if exists responses_insert on prompt_responses;
create policy responses_insert on prompt_responses for insert to authenticated
  with check (
    user_id = auth.uid()
    and is_connection_member(
      (select i.connection_id from prompt_instances i where i.id = instance_id)
    )
    and exists (
      select 1 from prompt_instances i
       where i.id = instance_id and i.status = 'open'
    )
  );

-- ---------------------------------------------------------------------------
-- 11. Profiles: own full row; partners see display fields only
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles for select to authenticated
  using (id = auth.uid());

-- Partner-visible subset. security_invoker=false so the view owner reads
-- underlying rows; the WHERE clause is the access control. Omits birthday,
-- birth_time, birth_place, intake, and preferences.
create or replace view public.partner_profiles
with (security_invoker = false)
as
select
  p.id,
  p.display_name,
  p.avatar_url,
  p.username
from public.profiles p
where exists (
  select 1
  from connection_members me
  join connection_members them
    on them.connection_id = me.connection_id
   and them.user_id = p.id
   and them.joined_at is not null
  where me.user_id = auth.uid()
    and me.joined_at is not null
);

revoke all on public.partner_profiles from public, anon;
grant select on public.partner_profiles to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 12. Zodiac compatibility without exposing partner birth columns
-- ---------------------------------------------------------------------------
create or replace function _sun_sign_name(b date)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when b is null then null
    when (extract(month from b), extract(day from b)) >= (1, 20)
     and (extract(month from b), extract(day from b)) < (2, 19) then 'Aquarius'
    when (extract(month from b), extract(day from b)) >= (2, 19)
     and (extract(month from b), extract(day from b)) < (3, 21) then 'Pisces'
    when (extract(month from b), extract(day from b)) >= (3, 21)
     and (extract(month from b), extract(day from b)) < (4, 20) then 'Aries'
    when (extract(month from b), extract(day from b)) >= (4, 20)
     and (extract(month from b), extract(day from b)) < (5, 21) then 'Taurus'
    when (extract(month from b), extract(day from b)) >= (5, 21)
     and (extract(month from b), extract(day from b)) < (6, 21) then 'Gemini'
    when (extract(month from b), extract(day from b)) >= (6, 21)
     and (extract(month from b), extract(day from b)) < (7, 23) then 'Cancer'
    when (extract(month from b), extract(day from b)) >= (7, 23)
     and (extract(month from b), extract(day from b)) < (8, 23) then 'Leo'
    when (extract(month from b), extract(day from b)) >= (8, 23)
     and (extract(month from b), extract(day from b)) < (9, 23) then 'Virgo'
    when (extract(month from b), extract(day from b)) >= (9, 23)
     and (extract(month from b), extract(day from b)) < (10, 23) then 'Libra'
    when (extract(month from b), extract(day from b)) >= (10, 23)
     and (extract(month from b), extract(day from b)) < (11, 22) then 'Scorpio'
    when (extract(month from b), extract(day from b)) >= (11, 22)
     and (extract(month from b), extract(day from b)) < (12, 22) then 'Sagittarius'
    else 'Capricorn'
  end;
$$;

create or replace function _sun_sign_element(sign text)
returns text
language sql
immutable
set search_path = public
as $$
  select case sign
    when 'Aries' then 'Fire' when 'Leo' then 'Fire' when 'Sagittarius' then 'Fire'
    when 'Taurus' then 'Earth' when 'Virgo' then 'Earth' when 'Capricorn' then 'Earth'
    when 'Gemini' then 'Air' when 'Libra' then 'Air' when 'Aquarius' then 'Air'
    when 'Cancer' then 'Water' when 'Scorpio' then 'Water' when 'Pisces' then 'Water'
    else null
  end;
$$;

create or replace function connection_zodiac_compat(p_conn uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
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
  if not is_connection_member(p_conn) then
    return null;
  end if;

  select p.birthday into b1
    from connection_members m
    join profiles p on p.id = m.user_id
   where m.connection_id = p_conn and m.joined_at is not null
   order by m.joined_at, m.user_id
   limit 1;

  select p.birthday into b2
    from connection_members m
    join profiles p on p.id = m.user_id
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

revoke execute on function _sun_sign_name(date) from public, anon, authenticated;
revoke execute on function _sun_sign_element(text) from public, anon, authenticated;
revoke execute on function connection_zodiac_compat(uuid) from public, anon;
grant execute on function connection_zodiac_compat(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 13. Re-assert EXECUTE grants on helpers used by RLS / clients
-- ---------------------------------------------------------------------------
revoke execute on function is_connection_member(uuid) from public, anon;
revoke execute on function has_answered(uuid, uuid) from public, anon;
revoke execute on function has_premium(uuid) from public, anon;
grant execute on function is_connection_member(uuid) to authenticated, service_role;
grant execute on function has_answered(uuid, uuid) to authenticated, service_role;
grant execute on function has_premium(uuid) to authenticated, service_role;
