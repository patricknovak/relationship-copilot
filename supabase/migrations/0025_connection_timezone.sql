-- "Today" follows the connection's time zone. Roadmap §2 gap 6 / item 4
-- leftover (docs/ROADMAP.md): daily instances were keyed on the UTC date,
-- so a pair in Vancouver got a new question at 4–5 pm and streaks flipped
-- mid-afternoon. Each connection now carries an IANA time zone (set from
-- the creator's browser at creation, adopted from the first visitor when
-- still unset), and the daily functions derive the date from it when the
-- caller passes none. Existing connections default to UTC, so nothing
-- changes for them until a member's browser sets the zone.
--
-- The assigner cron moves from once a day to hourly: ensure_daily_prompt
-- is idempotent, and an hourly pass creates each connection's instance
-- shortly after its local midnight regardless of zone.
--
-- Additive. Does not touch the mutual-reveal gate.

alter table public.connections
  add column if not exists timezone text not null default 'UTC';

-- Validate IANA names by asking Postgres; unknown names raise, which the
-- constraint turns into a rejection.
create or replace function public.is_valid_timezone(p_tz text)
returns boolean
language plpgsql
immutable
as $$
begin
  if p_tz is null or length(p_tz) > 64 then return false; end if;
  perform now() at time zone p_tz;
  return true;
exception when others then
  return false;
end;
$$;

alter table public.connections
  drop constraint if exists connections_timezone_valid;
alter table public.connections
  add constraint connections_timezone_valid check (public.is_valid_timezone(timezone));

comment on column public.connections.timezone is
  'IANA zone the daily question and streak day boundaries follow. UTC until a member''s browser sets it.';

-- Local calendar date for a connection, right now.
create or replace function public.connection_today(p_conn uuid)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select (now() at time zone coalesce(
    (select c.timezone from public.connections c where c.id = p_conn), 'UTC'
  ))::date;
$$;

revoke all on function public.connection_today(uuid) from public, anon;
grant execute on function public.connection_today(uuid) to authenticated, service_role;

-- Same body as 0016, with the date defaulting to the connection's local day.
create or replace function public.ensure_daily_prompt(p_conn uuid, p_date date default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type public.connection_type;
  v_tmpl public.prompt_templates%rowtype;
  v_id   uuid;
  v_date date;
begin
  if auth.uid() is not null and not public.is_connection_member(p_conn) then
    raise exception 'not a member of this connection';
  end if;

  v_date := coalesce(p_date, public.connection_today(p_conn));

  select id into v_id from public.prompt_instances
   where connection_id = p_conn and kind = 'daily' and scheduled_for = v_date;
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
    (p_conn, v_tmpl.id, 'daily', v_tmpl.questions, v_date, 'open')
  on conflict (connection_id, kind, scheduled_for) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.prompt_instances
     where connection_id = p_conn and kind = 'daily' and scheduled_for = v_date;
  end if;
  return v_id;
end;
$$;

-- Assigner: per-connection local date unless a date is forced (tests).
create or replace function public.assign_daily_prompts(p_date date default null)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare c record; n int := 0;
begin
  for c in select id from public.connections where status = 'active' loop
    perform public.ensure_daily_prompt(c.id, coalesce(p_date, public.connection_today(c.id)));
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke execute on function public.assign_daily_prompts(date) from public, anon, authenticated;
grant execute on function public.assign_daily_prompts(date) to service_role;
revoke execute on function public.ensure_daily_prompt(uuid, date) from public, anon;
grant execute on function public.ensure_daily_prompt(uuid, date) to authenticated, service_role;

-- Hourly assigner (idempotent). Guarded for plain Postgres in tests.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.unschedule('assign-daily-prompts');
    exception when others then
      null; -- not scheduled on this instance; nothing to replace
    end;
    perform cron.schedule('assign-daily-prompts', '5 * * * *', 'select assign_daily_prompts();');
  end if;
end
$$;
