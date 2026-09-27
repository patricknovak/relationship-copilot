-- Invite regeneration.
--
-- 0014 gave invite codes a 14-day expiry and blocked client updates to
-- invite_code / invite_expires_at. Both are right, but together they strand a
-- pending connection: once the link expires, the creator has no way to get a
-- new one and the invite page tells the invitee to "ask for a fresh link"
-- that cannot exist. This RPC is that path. Any joined member of a
-- not-yet-full, not-archived connection can mint a new single-use code; the
-- 0014 expiry trigger stamps the new 14-day window.

create or replace function regenerate_invite(p_conn uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid   uuid := auth.uid();
  conn  connections%rowtype;
  n     int;
  code  text;
begin
  if uid is null then raise exception 'not authenticated'; end if;

  select * into conn from connections where id = p_conn for update;
  if not found then raise exception 'connection not found'; end if;

  if not exists (
    select 1 from connection_members m
     where m.connection_id = p_conn and m.user_id = uid and m.joined_at is not null
  ) then
    raise exception 'not a member of this connection';
  end if;

  if conn.status in ('archived', 'blocked') then
    raise exception 'connection is closed';
  end if;

  select count(*) into n from connection_members where connection_id = p_conn;
  if n >= 2 then raise exception 'connection is full'; end if;

  -- 8 upper-case alphanumerics from 9 random bytes (same shape the app used).
  loop
    code := upper(substr(regexp_replace(encode(gen_random_bytes(9), 'base64'), '[^A-Za-z0-9]', '', 'g'), 1, 8));
    exit when length(code) = 8
      and not exists (select 1 from connections c where c.invite_code = code);
  end loop;

  perform set_config('app.bypass_connection_guards', '1', true);
  update connections
     set invite_code = code,
         invite_expires_at = null,   -- trigger re-stamps now() + 14 days
         updated_at = now()
   where id = p_conn;

  return code;
end;
$$;

revoke execute on function regenerate_invite(uuid) from public, anon;
grant execute on function regenerate_invite(uuid) to authenticated;
