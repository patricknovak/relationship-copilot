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
