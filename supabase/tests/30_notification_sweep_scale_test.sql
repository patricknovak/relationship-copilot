-- Migration 0049: the sweep's scale rewrite keeps 0048's behaviour (test 29
-- runs against the 0049 body) and its index changes are in place. This file
-- covers what the rewrite touched: the "exactly two joined members" rule and
-- the window bound.

insert into auth.users (id, email) values
  ('d2049000-0000-0000-0000-000000000001', 'sweep-a@example.com'),
  ('d2049000-0000-0000-0000-000000000002', 'sweep-b@example.com'),
  ('d2049000-0000-0000-0000-000000000003', 'sweep-c@example.com');

insert into connections (id, type, status, created_by, timezone) values
  ('d2049000-aaaa-aaaa-aaaa-000000000001', 'friend', 'active', 'd2049000-0000-0000-0000-000000000001', 'UTC');
update connection_members set joined_at = now() - interval '30 days'
 where connection_id = 'd2049000-aaaa-aaaa-aaaa-000000000001';
insert into connection_members (connection_id, user_id, role, joined_at) values
  ('d2049000-aaaa-aaaa-aaaa-000000000001', 'd2049000-0000-0000-0000-000000000002', 'member', now() - interval '30 days');

insert into prompt_instances (id, connection_id, kind, status, scheduled_for, questions) values
  ('d2049000-1111-0000-0000-000000000001', 'd2049000-aaaa-aaaa-aaaa-000000000001', 'daily', 'open', current_date - 20, '[{"id":"q1","text":"?"}]'),
  ('d2049000-1111-0000-0000-000000000002', 'd2049000-aaaa-aaaa-aaaa-000000000001', 'daily', 'open', current_date - 1, '[{"id":"q1","text":"?"}]');
insert into prompt_responses (instance_id, user_id, answers, submitted_at) values
  ('d2049000-1111-0000-0000-000000000001', 'd2049000-0000-0000-0000-000000000001', '{"q1":"x"}', now() - interval '20 days'),
  ('d2049000-1111-0000-0000-000000000002', 'd2049000-0000-0000-0000-000000000001', '{"q1":"x"}', now() - interval '1 day');

do $$
declare
  n int;
  rec record;
begin
  -- Indexes the sweep reads through, and the two duplicates gone.
  assert to_regclass('public.prompt_responses_submitted_at_idx') is not null, 'missing submitted_at index';
  assert to_regclass('public.prompt_instances_revealed_at_idx') is not null, 'missing revealed_at index';
  assert to_regclass('public.prompt_instances_conn_kind_scheduled_idx') is null, 'duplicate index still present';
  assert to_regclass('public.prompt_responses_instance_idx') is null, 'prefix index still present';
  -- The unique indexes that made them redundant are still there.
  assert to_regclass('public.prompt_instances_connection_id_kind_scheduled_for_key') is not null, 'unique instance index missing';
  assert to_regclass('public.prompt_responses_instance_id_user_id_key') is not null, 'unique response index missing';

  -- Latest waiting set inside the window: one candidate, the latest.
  select count(*) into n from public.missed_notification_candidates() where connection_id::text like 'd2049000%';
  assert n = 1, format('EXPECTED 1 candidate, got %s', n);
  select * into rec from public.missed_notification_candidates() where connection_id::text like 'd2049000%';
  assert rec.instance_id = 'd2049000-1111-0000-0000-000000000002', 'expected the latest set';
  assert rec.timezone = 'UTC', 'expected the connection time zone';

  -- The latest set is logged: the 20-day-old one (outside the window, and
  -- not the latest) must not surface instead.
  insert into notification_log (instance_id, user_id, kind)
  values ('d2049000-1111-0000-0000-000000000002', 'd2049000-0000-0000-0000-000000000002', 'your_turn');
  select count(*) into n from public.missed_notification_candidates() where connection_id::text like 'd2049000%';
  assert n = 0, format('EXPECTED nothing once the latest is logged, got %s', n);
  -- Even with a window wide enough to hold the old one, it is not the latest.
  select count(*) into n from public.missed_notification_candidates(p_turn_max_hours => 24 * 60) where connection_id::text like 'd2049000%';
  assert n = 0, format('EXPECTED nothing for an older set in a wide window, got %s', n);
  delete from notification_log where instance_id = 'd2049000-1111-0000-0000-000000000002';

  -- A third joined member: not a pair, never a candidate.
  insert into connection_members (connection_id, user_id, role, joined_at)
  values ('d2049000-aaaa-aaaa-aaaa-000000000001', 'd2049000-0000-0000-0000-000000000003', 'member', now() - interval '30 days');
  select count(*) into n from public.missed_notification_candidates() where connection_id::text like 'd2049000%';
  assert n = 0, format('EXPECTED nothing with three joined members, got %s', n);
  -- A third member who has not joined does not count.
  update connection_members set joined_at = null
   where connection_id = 'd2049000-aaaa-aaaa-aaaa-000000000001' and user_id = 'd2049000-0000-0000-0000-000000000003';
  select count(*) into n from public.missed_notification_candidates() where connection_id::text like 'd2049000%';
  assert n = 1, format('EXPECTED 1 candidate with an unjoined third row, got %s', n);

  raise notice 'PASS: notification sweep scale rewrite (indexes, window bound, two-member rule)';
end $$;
