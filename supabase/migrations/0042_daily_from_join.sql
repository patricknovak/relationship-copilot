-- Daily question from the day both people join.
--
-- Until now the daily question unlocked only once a pair had each written
-- all 20 first answers and revealed them (status 'active'). That made the
-- first reveal a 40-answer wall. A pair now gets today's single question as
-- soon as both have joined (status 'onboarding'), so the first reveal can
-- happen in minutes; the first 20 stay open alongside as the deeper set.
--
-- Nothing about the reveal gate changes: each daily instance still reveals
-- only when both members have answered it (maybe_reveal_instance, 0010).
-- The app creates today's question on visit through ensure_daily_prompt,
-- which has never checked status, so the hub works with or without this
-- migration. These three functions are the cron paths that pre-create
-- today's question and send the opt-in "today's question is ready" email;
-- they now include joined-but-not-yet-revealed pairs.
--
-- "Both joined" is checked explicitly rather than inferred from the status,
-- so a connection can never receive a daily with only one person in it.

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
     where c.status in ('onboarding', 'active')
       and (select count(*) from public.connection_members m
             where m.connection_id = c.id and m.joined_at is not null) = 2
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
   where c.status in ('onboarding', 'active')
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

-- The pg_cron assigner (retired in favour of the Worker cron, but kept
-- consistent until it is unscheduled).
create or replace function public.assign_daily_prompts(p_date date default null)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare c record; n int := 0;
begin
  for c in
    select x.id from public.connections x
     where x.status in ('onboarding', 'active')
       and (select count(*) from public.connection_members m
             where m.connection_id = x.id and m.joined_at is not null) = 2
  loop
    perform public.ensure_daily_prompt(c.id, coalesce(p_date, public.connection_today(c.id)));
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke execute on function public.assign_daily_prompts(date) from public, anon, authenticated;
grant execute on function public.assign_daily_prompts(date) to service_role;
