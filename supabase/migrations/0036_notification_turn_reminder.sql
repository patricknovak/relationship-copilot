-- One gentle follow-up when a set has waited on you for a while
-- (app/api/cron/turn-reminder). "your_turn" fires once, the moment the other
-- person submits; if that goes unanswered for 36 hours, one more nudge goes
-- out, inside the recipient connection's local daytime window. Once per
-- instance per person, like every other kind (primary key on
-- instance_id, user_id, kind). Rides on the "your turn" preference.

alter table public.notification_log
  drop constraint if exists notification_log_kind_check;
alter table public.notification_log
  add constraint notification_log_kind_check
  check (kind in (
    'your_turn', 'revealed', 'daily_ready', 'partner_joined',
    'discussion_reply', 'turn_reminder'
  ));

-- Candidates for the follow-up, selected server-side so the cron never ships
-- long id lists in a URL. One row per (set, person still to answer) where:
--   * the set is open and is first questions, a quiz or a challenge;
--   * the connection is live and has exactly two joined members;
--   * the other member answered, and the wait is measured from the later of
--     their answer and the recipient's join (someone who joins days after an
--     answer-first inviter isn't told they've kept anyone waiting);
--   * the wait is between p_min_hours and p_max_hours;
--   * no turn_reminder has gone to that person for that set yet.
-- Ids, a timezone and a first name only; never answer content.
create or replace function public.turn_reminder_candidates(
  p_min_hours int default 36,
  p_max_hours int default 168,
  p_limit int default 2000
)
returns table (
  instance_id uuid,
  connection_id uuid,
  recipient_id uuid,
  answered_by_id uuid,
  answered_by_name text,
  timezone text
)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, i.connection_id, other.user_id, r.user_id, p.display_name, c.timezone
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
     and i.kind in ('onboarding', 'quiz', 'challenge')
     and public.response_has_content(r.answers)
     and (select count(*) from public.connection_members m
           where m.connection_id = i.connection_id and m.joined_at is not null) = 2
     and not exists (
       select 1 from public.prompt_responses mine
        where mine.instance_id = i.id and mine.user_id = other.user_id
     )
     and greatest(r.submitted_at, other.joined_at) <= now() - make_interval(hours => p_min_hours)
     and greatest(r.submitted_at, other.joined_at) >= now() - make_interval(hours => p_max_hours)
     and not exists (
       select 1 from public.notification_log n
        where n.instance_id = i.id and n.user_id = other.user_id and n.kind = 'turn_reminder'
     )
   order by i.id
   limit p_limit;
$$;

revoke all on function public.turn_reminder_candidates(int, int, int) from public, anon, authenticated;
grant execute on function public.turn_reminder_candidates(int, int, int) to service_role;
