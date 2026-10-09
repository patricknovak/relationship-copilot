-- Track burned / replaced invite codes so the invite landing page can tell
-- "already used" from "unknown / never existed" without guessing.
--
-- Additive. Does not change the mutual-reveal gate. accept_invite and
-- regenerate_invite keep the same success/failure behavior; they additionally
-- record the retiring code before clearing or replacing it.

create table public.retired_invite_codes (
  code text primary key,
  reason text not null check (reason in ('used', 'regenerated')),
  retired_at timestamptz not null default now()
);

comment on table public.retired_invite_codes is
  'Invite codes that were burned on accept (used) or replaced (regenerated). '
  'Lookup-only for the invite landing discriminant; no client DML.';

alter table public.retired_invite_codes enable row level security;

revoke all on public.retired_invite_codes from public, anon, authenticated;

drop policy if exists retired_invite_codes_deny_clients
  on public.retired_invite_codes;
create policy retired_invite_codes_deny_clients
  on public.retired_invite_codes
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

grant all on public.retired_invite_codes to service_role;

-- ---------------------------------------------------------------------------
-- accept_invite: record the code as used before clearing it
-- ---------------------------------------------------------------------------
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
  normalized   text := upper(trim(p_code));
begin
  if uid is null then raise exception 'not authenticated'; end if;

  select * into conn from public.connections
   where invite_code = normalized
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

  insert into public.retired_invite_codes (code, reason)
  values (normalized, 'used')
  on conflict (code) do update
    set reason = excluded.reason,
        retired_at = now();

  update public.connections
     set status = case when status = 'pending' then 'onboarding' else status end,
         invite_code = null,
         invite_expires_at = null,
         updated_at = now()
   where id = conn.id;

  return conn.id;
end;
$$;

revoke all on function public.accept_invite(text) from public, anon;
revoke execute on function public.accept_invite(text) from public, anon;
grant execute on function public.accept_invite(text) to authenticated;

-- ---------------------------------------------------------------------------
-- regenerate_invite: retire the previous code (if any) as regenerated
-- ---------------------------------------------------------------------------
create or replace function public.regenerate_invite(p_conn uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  uid      uuid := auth.uid();
  conn     public.connections%rowtype;
  n        int;
  new_code text;
  old_code text;
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

  old_code := conn.invite_code;

  loop
    new_code := upper(substr(regexp_replace(
                  encode(gen_random_bytes(9), 'base64'),
                  '[^A-Za-z0-9]', '', 'g'), 1, 8));
    exit when length(new_code) = 8
      and not exists (
            select 1 from public.connections c
             where c.invite_code = new_code)
      and not exists (
            select 1 from public.retired_invite_codes r
             where r.code = new_code);
  end loop;

  perform set_config('app.bypass_connection_guards', '1', true);

  if old_code is not null and length(old_code) > 0 then
    insert into public.retired_invite_codes (code, reason)
    values (upper(old_code), 'regenerated')
    on conflict (code) do update
      set reason = excluded.reason,
          retired_at = now();
  end if;

  update public.connections
     set invite_code = new_code,
         invite_expires_at = null,
         updated_at = now()
   where id = p_conn;

  return new_code;
end;
$$;

revoke all on function public.regenerate_invite(uuid) from public, anon;
revoke execute on function public.regenerate_invite(uuid) from public, anon;
grant execute on function public.regenerate_invite(uuid) to authenticated;
