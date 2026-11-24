-- Scale pass 2: keep the hourly notification sweep fast as history grows.
--
-- Measured on a local Postgres 16 loaded with 20,000 joined pairs and 120
-- days of daily questions each (2.4M prompt_instances, 2.6M
-- prompt_responses):
--
--   missed_notification_candidates (0048)   164 s  ->  3.5 s
--
-- Three causes, each fixed below and marked "0049" in the body:
--   a. The "your turn" half ranked every open set ever created, and every
--      unanswered daily question stays open for good, so the work grew with
--      the whole history rather than the two-week window the route asks
--      about. Now only answers inside the window are read.
--   b. "(select count(*) ...) = 2" made the planner expect a single row, so
--      it joined by scanning every connection (and every member) once per
--      candidate. Written as "no third joined member", which it can
--      estimate. Same rule.
--   c. The "revealed" half had no index on revealed_at and read the whole
--      table to find the last 24 hours.
--
-- 1. missed_notification_candidates: the three changes above; the rest is
--    the 0048 body. Results are the same rows: test 29 (0048's own test)
--    runs against this body, test 30 covers the rewritten parts, and the old
--    and new functions were compared row for row on the load-test data.
-- 2. Two indexes for it: answers by time, reveals by time.
-- 3. Two redundant indexes dropped. Each is a strict duplicate or prefix of
--    a unique index on the same table, so every insert paid for it twice:
--      prompt_instances_conn_kind_scheduled_idx  = the unique
--        (connection_id, kind, scheduled_for) constraint index
--      prompt_responses_instance_idx (instance_id) = prefix of the unique
--        (instance_id, user_id) constraint index
--
-- No table, column, policy or grant changes. The reveal gate is untouched.
-- Re-runnable. Safe to apply before or after 0046-0048; if 0048 is not
-- applied yet this creates the function in its final form.

create index if not exists prompt_responses_submitted_at_idx
  on public.prompt_responses (submitted_at);

create index if not exists prompt_instances_revealed_at_idx
  on public.prompt_instances (revealed_at)
  where status = 'revealed';

drop index if exists public.prompt_instances_conn_kind_scheduled_idx;
drop index if exists public.prompt_responses_instance_idx;

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
           (select c.timezone from public.connections c where c.id = i.connection_id) as timezone,
           r.submitted_at as since,
           row_number() over (
             partition by i.connection_id, other.user_id
             order by r.submitted_at desc, i.id
           ) as rn
      from public.prompt_instances i
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
       -- 0049: the connection is looked up by primary key per row rather
       -- than joined, so the planner can never choose to scan every
       -- connection for each candidate (it did, at 20,000 pairs).
       and (select c.status from public.connections c where c.id = i.connection_id)
           in ('onboarding', 'active')
       -- The answer came after the recipient joined, i.e. a "your turn"
       -- really was due. (Answer-first inviters are the 36-hour reminder's
       -- job: a brand-new joiner shouldn't be nudged minutes after arriving.)
       and r.submitted_at >= other.joined_at
       -- 0049: only answers inside the window can produce a candidate, so
       -- read just those (prompt_responses_submitted_at_idx) instead of
       -- every open set since launch. Same result: the latest waiting set
       -- per person is either inside the window (still ranked first here)
       -- or older than it (dropped below either way).
       and r.submitted_at >= now() - make_interval(hours => p_turn_max_hours)
       -- 0049: "exactly two joined members", written as "no third one".
       -- author and other are already two different joined members, so this
       -- is the same test, and the planner can estimate it (count(*) = 2
       -- made it expect one row and pick scan-everything joins).
       and not exists (
         select 1 from public.connection_members m
          where m.connection_id = i.connection_id
            and m.joined_at is not null
            and m.user_id <> author.user_id
            and m.user_id <> other.user_id
       )
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
           (select c.timezone from public.connections c where c.id = i.connection_id) as timezone,
           i.revealed_at as since
      from public.prompt_instances i
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
       -- 0049: primary-key lookup, as above.
       and (select c.status from public.connections c where c.id = i.connection_id)
           in ('onboarding', 'active')
       and i.revealed_at <= now() - make_interval(mins => p_min_minutes)
       and i.revealed_at >= now() - make_interval(hours => p_reveal_max_hours)
       -- The other person's answer is the one that opened it; they saw the
       -- reveal on submit and are never emailed about it.
       and theirs.submitted_at > mine.submitted_at
       -- 0049: no third joined member, as above.
       and not exists (
         select 1 from public.connection_members m
          where m.connection_id = i.connection_id
            and m.joined_at is not null
            and m.user_id <> me.user_id
            and m.user_id <> other.user_id
       )
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
