-- Scale fixes for the hourly reminder jobs and invite codes.
--
-- 1. Daily reminder selection moves into SQL. The route used to page every
--    active connection into the Worker, prefetch instances, members,
--    responses and profiles with `.in(...)` lists (URL-length bound), call
--    ensure_daily_prompt once per gap, then notify everyone sequentially —
--    all inside one Worker invocation with its subrequest cap. Now:
--      ensure_daily_prompts_in_window  creates the missing "today" instances
--                                      for connections inside their local
--                                      sending window (one round trip);
--      daily_reminder_candidates       returns at most p_limit people to
--                                      notify: opted in, haven't answered,
--                                      not yet reminded for this instance.
--    Both are service-role only and return ids, a first name, the template
--    question and a time zone — never answer content. Because the once-only
--    claim (notification_log) excludes people already reminded, repeated
--    hourly runs drain any backlog beyond p_limit.
--
-- 2. Invite codes grow from 8 to 12 characters (unambiguous alphabet, 60
--    bits). Existing 8-character codes keep working: nothing validates length
--    in the database, and the app accepts 8–12.

create or replace function public.ensure_daily_prompts_in_window(
  p_from_hour int default 9,
  p_to_hour int default 20,
  p_limit int default 2000
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec record;
  n int := 0;
begin
  for rec in
    select c.id, (now() at time zone coalesce(c.timezone, 'UTC'))::date as today
      from public.connections c
     where c.status = 'active'
       and extract(hour from now() at time zone coalesce(c.timezone, 'UTC'))
           between p_from_hour and p_to_hour
       and not exists (
         select 1 from public.prompt_instances i
          where i.connection_id = c.id
            and i.kind = 'daily'
            and i.scheduled_for = (now() at time zone coalesce(c.timezone, 'UTC'))::date
       )
     order by c.id
     limit p_limit
  loop
    if public.ensure_daily_prompt(rec.id, rec.today) is not null then
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;

revoke all on function public.ensure_daily_prompts_in_window(int, int, int) from public, anon, authenticated;
grant execute on function public.ensure_daily_prompts_in_window(int, int, int) to service_role;

-- The "daily_ready" switch defaults to off (lib/notifications.ts
-- DEFAULT_PREFS); only an explicit true in profiles.preferences counts.
create or replace function public.daily_reminder_candidates(
  p_from_hour int default 9,
  p_to_hour int default 20,
  p_limit int default 100
)
returns table (
  instance_id uuid,
  connection_id uuid,
  recipient_id uuid,
  other_name text,
  question_text text,
  timezone text
)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id,
         c.id,
         me.user_id,
         them.display_name,
         i.questions -> 0 ->> 'text',
         c.timezone
    from public.connections c
    join public.prompt_instances i
      on i.connection_id = c.id
     and i.kind = 'daily'
     and i.status = 'open'
     and i.scheduled_for = (now() at time zone coalesce(c.timezone, 'UTC'))::date
    join public.connection_members me
      on me.connection_id = c.id and me.joined_at is not null
    join public.profiles mine on mine.id = me.user_id
    join public.connection_members other
      on other.connection_id = c.id
     and other.user_id <> me.user_id
     and other.joined_at is not null
    left join public.profiles them on them.id = other.user_id
   where c.status = 'active'
     and extract(hour from now() at time zone coalesce(c.timezone, 'UTC'))
         between p_from_hour and p_to_hour
     and (mine.preferences -> 'notifications' -> 'daily_ready') = 'true'::jsonb
     and (select count(*) from public.connection_members m
           where m.connection_id = c.id and m.joined_at is not null) = 2
     and not exists (
       select 1 from public.prompt_responses r
        where r.instance_id = i.id and r.user_id = me.user_id
     )
     and not exists (
       select 1 from public.notification_log n
        where n.instance_id = i.id and n.user_id = me.user_id and n.kind = 'daily_ready'
     )
   order by i.id, me.user_id
   limit p_limit;
$$;

revoke all on function public.daily_reminder_candidates(int, int, int) from public, anon, authenticated;
grant execute on function public.daily_reminder_candidates(int, int, int) to service_role;

-- Same body as 0019; only the code generator changes (12 chars, 32-symbol
-- alphabet without 0/O/1/I, no modulo bias since 256 = 8 * 32).
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
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes    bytea;
  i        int;
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
    bytes := gen_random_bytes(12);
    new_code := '';
    for i in 0..11 loop
      new_code := new_code || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
    end loop;
    exit when not exists (
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
