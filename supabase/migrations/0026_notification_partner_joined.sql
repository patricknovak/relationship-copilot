-- Fourth notification kind: partner_joined. The inviter is the person most
-- likely to drift away while waiting; tell them the moment the other person
-- accepts. Logged against the connection's onboarding instance so the
-- once-only key works unchanged. Additive.

alter table public.notification_log
  drop constraint if exists notification_log_kind_check;
alter table public.notification_log
  add constraint notification_log_kind_check
  check (kind in ('your_turn', 'revealed', 'daily_ready', 'partner_joined'));
