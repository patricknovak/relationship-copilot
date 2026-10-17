-- Fifth notification kind: discussion_reply. The post-reveal conversation is
-- where the loop pays off, and a reply nobody sees is a dead thread. Sent to
-- the other member the first time someone replies on an instance (once per
-- instance per recipient via the existing once-only key, so it never turns
-- into a message-by-message stream). Additive.

alter table public.notification_log
  drop constraint if exists notification_log_kind_check;
alter table public.notification_log
  add constraint notification_log_kind_check
  check (kind in ('your_turn', 'revealed', 'daily_ready', 'partner_joined', 'discussion_reply'));
