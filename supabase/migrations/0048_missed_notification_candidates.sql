-- A safety net for the two event-driven notifications that matter most.
--
-- "Your turn" and "you both answered" are sent once, right after a submit
-- (lib/notify.ts). If that one attempt doesn't deliver (the mail provider is
-- down, the Worker is cut off mid-send, or, as happened for the first week of
-- real use, the email secrets aren't set), nothing ever tried again: the
-- other person simply never heard about it.
--
-- missed_notification_candidates lets the hourly turn-reminder cron find
-- those cases from the state of the data rather than from an event that is
-- already gone:
--
--   your_turn  the other member answered after you joined, you haven't, and
--              neither a your_turn nor a turn_reminder was ever logged for
--              you on that set. Only the LATEST such set per connection per
--              person is returned, so someone with a backlog of unanswered
--              daily questions gets one email, not one per question.
--   revealed   the other member's answer opened the reveal in the last
--              p_reveal_max_hours and no "revealed" was logged for you.
--              Short window on purpose: a reveal you have probably already
--              read is not worth an email days later.
--
-- Both skip anything younger than p_min_minutes (the normal send may still
-- be in flight) and anyone who switched that notification off. The route
-- sends through the same once-only claim (notification_log), so the sweep
-- can't double-send with the normal path or with itself.
--
-- Ids, a timezone and a first name only; never answer content. Service role
-- only. Additive: one new function, no table or policy changes. The app
-- tolerates this function being absent (the sweep reports "unavailable"),
-- so the code can deploy before this is applied.

create or replace function public.missed_notification_candidates(
  p_min_minutes int default 10,
  p_turn_max_hours int default 336,
  p_reveal_max_hours int default 24,
  p_limit int default 100
)
returns table (
  kind text,
  instance_id uuid,
  connection_id uuid,
  recipient_id uuid,
  other_name text,
  timezone text
)
language sql
stable
security definer
set search_path = ''
as $$
  with waiting as (
    select i.id as instance_id,
           i.connection_id,
           other.user_id as recipient_id,
           p.display_name as other_name,
           c.timezone,
           r.submitted_at as since,
           row_number() over (
             partition by i.connection_id, other.user_id
             order by r.submitted_at desc, i.id
           ) as rn
      from public.prompt_instances i
      join public.connections c
        on c.id = i.connection_id and c.status in ('onboarding', 'active')
      join public.prompt_responses r
        on r.instance_id = i.id
      join public.connection_members author
        on author.connection_id = i.connection_id
       and author.user_id = r.user_id
       and author.joined_at is not null
      join public.connection_members other
        on other.connection_id = i.connection_id
       and other.user_id <> r.user_id
       and other.joined_at is not null
      left join public.profiles p on p.id = r.user_id
     where i.status = 'open'
       and public.response_has_content(r.answers)
       -- The answer came after the recipient joined, i.e. a "your turn"
       -- really was due. (Answer-first inviters are the 36-hour reminder's
       -- job: a brand-new joiner shouldn't be nudged minutes after arriving.)
       and r.submitted_at >= other.joined_at
       and (select count(*) from public.connection_members m
             where m.connection_id = i.connection_id and m.joined_at is not null) = 2
       and not exists (
         select 1 from public.prompt_responses mine
          where mine.instance_id = i.id and mine.user_id = other.user_id
       )
  ),
  turns as (
    select 'your_turn'::text as kind, w.instance_id, w.connection_id,
           w.recipient_id, w.other_name, w.timezone, w.since
      from waiting w
      join public.profiles mine on mine.id = w.recipient_id
     where w.rn = 1
       and w.since <= now() - make_interval(mins => p_min_minutes)
       and w.since >= now() - make_interval(hours => p_turn_max_hours)
       and coalesce(mine.preferences -> 'notifications' -> 'your_turn', 'true'::jsonb)
           <> 'false'::jsonb
       and not exists (
         select 1 from public.notification_log n
          where n.instance_id = w.instance_id
            and n.user_id = w.recipient_id
            and n.kind in ('your_turn', 'turn_reminder')
       )
  ),
  reveals as (
    select 'revealed'::text as kind, i.id as instance_id, i.connection_id,
           me.user_id as recipient_id, p.display_name as other_name,
           c.timezone, i.revealed_at as since
      from public.prompt_instances i
      join public.connections c
        on c.id = i.connection_id and c.status in ('onboarding', 'active')
      join public.connection_members me
        on me.connection_id = i.connection_id and me.joined_at is not null
      join public.prompt_responses mine
        on mine.instance_id = i.id and mine.user_id = me.user_id
      join public.connection_members other
        on other.connection_id = i.connection_id
       and other.user_id <> me.user_id
       and other.joined_at is not null
      join public.prompt_responses theirs
        on theirs.instance_id = i.id and theirs.user_id = other.user_id
      join public.profiles myp on myp.id = me.user_id
      left join public.profiles p on p.id = other.user_id
     where i.status = 'revealed'
       and i.revealed_at <= now() - make_interval(mins => p_min_minutes)
       and i.revealed_at >= now() - make_interval(hours => p_reveal_max_hours)
       -- The other person's answer is the one that opened it; they saw the
       -- reveal on submit and are never emailed about it.
       and theirs.submitted_at > mine.submitted_at
       and (select count(*) from public.connection_members m
             where m.connection_id = i.connection_id and m.joined_at is not null) = 2
       and coalesce(myp.preferences -> 'notifications' -> 'revealed', 'true'::jsonb)
           <> 'false'::jsonb
       and not exists (
         select 1 from public.notification_log n
          where n.instance_id = i.id and n.user_id = me.user_id and n.kind = 'revealed'
       )
  )
  select u.kind, u.instance_id, u.connection_id, u.recipient_id, u.other_name, u.timezone
    from (select * from turns union all select * from reveals) u
   order by u.since, u.instance_id
   limit p_limit;
$$;

revoke all on function public.missed_notification_candidates(int, int, int, int) from public, anon, authenticated;
grant execute on function public.missed_notification_candidates(int, int, int, int) to service_role;
