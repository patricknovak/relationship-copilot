-- Notification log + one content fix. Roadmap item 3 (docs/ROADMAP.md).
--
-- 1. notification_log: once-only markers for transactional emails ("they
--    answered, your turn", "you both revealed", "today's question is
--    ready"). The app inserts a row before sending; a conflict means the
--    email already went out, so retries, double submits and overlapping cron
--    runs cannot send twice. Service-role only: clients never read or write
--    it, and it stores no addresses or answer text. Preferences live in
--    profiles.preferences->'notifications' (the user's own row).
-- 2. The love-languages quiz said "pick any that resonate" but the answer
--    form renders a single choice. Reword rather than change the format, so
--    existing answers stay valid.
--
-- Additive. Does not touch the mutual-reveal gate.

create table public.notification_log (
  instance_id uuid not null
    references public.prompt_instances (id) on delete cascade,
  user_id uuid not null
    references auth.users (id) on delete cascade,
  kind text not null
    check (kind in ('your_turn', 'revealed', 'daily_ready')),
  sent_at timestamptz not null default now(),
  primary key (instance_id, user_id, kind)
);

comment on table public.notification_log is
  'Once-only markers for transactional notification emails. No client DML; '
  'written by the app with the service role before a send. Holds ids only.';

alter table public.notification_log enable row level security;

revoke all on public.notification_log from public, anon, authenticated;

drop policy if exists notification_log_deny_clients on public.notification_log;
create policy notification_log_deny_clients
  on public.notification_log
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

grant all on public.notification_log to service_role;

-- Content fix (idempotent: only rewrites the exact old wording).
update public.prompt_templates
   set questions = jsonb_set(
         questions,
         '{0,text}',
         to_jsonb('Which of these makes you feel most cared for? (pick the one that resonates most)'::text)
       )
 where kind = 'quiz'
   and framework = 'love_languages'
   and questions->0->>'text' = 'Which of these make you feel most cared for? (pick any that resonate)';
