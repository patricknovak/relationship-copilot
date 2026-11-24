-- Migration 0046: missed_notification_candidates finds "your turn" and
-- "revealed" notifications that never went out, from state alone. Every
-- query is scoped to this file's connections: earlier tests leave rows behind.

insert into auth.users (id, email) values
  ('d2046000-0000-0000-0000-000000000001', 'missed-a@example.com'),
  ('d2046000-0000-0000-0000-000000000002', 'missed-b@example.com'),
  ('d2046000-0000-0000-0000-000000000003', 'missed-c@example.com'),
  ('d2046000-0000-0000-0000-000000000004', 'missed-d@example.com');
update profiles set display_name = 'Ann' where id = 'd2046000-0000-0000-0000-000000000001';
update profiles set display_name = 'Cal' where id = 'd2046000-0000-0000-0000-000000000003';

-- c1: A + B, both joined long ago.  c2: C + D, D joined an hour ago.
insert into connections (id, type, status, created_by, timezone) values
  ('d2046000-aaaa-aaaa-aaaa-000000000001', 'friend', 'active', 'd2046000-0000-0000-0000-000000000001', 'America/New_York'),
  ('d2046000-aaaa-aaaa-aaaa-000000000002', 'friend', 'onboarding', 'd2046000-0000-0000-0000-000000000003', 'UTC');
update connection_members set joined_at = now() - interval '30 days'
 where connection_id = 'd2046000-aaaa-aaaa-aaaa-000000000001';
insert into connection_members (connection_id, user_id, role, joined_at) values
  ('d2046000-aaaa-aaaa-aaaa-000000000001', 'd2046000-0000-0000-0000-000000000002', 'member', now() - interval '30 days'),
  ('d2046000-aaaa-aaaa-aaaa-000000000002', 'd2046000-0000-0000-0000-000000000004', 'member', now() - interval '1 hour');

insert into prompt_instances (id, connection_id, kind, status, scheduled_for, questions) values
  -- three dailies in c1, each answered by A only, B never told
  ('d2046000-1111-0000-0000-000000000001', 'd2046000-aaaa-aaaa-aaaa-000000000001', 'daily', 'open', current_date - 3, '[{"id":"q1","text":"?"}]'),
  ('d2046000-1111-0000-0000-000000000002', 'd2046000-aaaa-aaaa-aaaa-000000000001', 'daily', 'open', current_date - 2, '[{"id":"q1","text":"?"}]'),
  ('d2046000-1111-0000-0000-000000000003', 'd2046000-aaaa-aaaa-aaaa-000000000001', 'daily', 'open', current_date - 1, '[{"id":"q1","text":"?"}]'),
  -- c2 first questions: C answered before D joined (answer-first)
  ('d2046000-1111-0000-0000-000000000004', 'd2046000-aaaa-aaaa-aaaa-000000000002', 'onboarding', 'open', null, '[{"id":"q1","text":"?"}]');

insert into prompt_responses (instance_id, user_id, answers, submitted_at) values
  ('d2046000-1111-0000-0000-000000000001', 'd2046000-0000-0000-0000-000000000001', '{"q1":"x"}', now() - interval '3 days'),
  ('d2046000-1111-0000-0000-000000000002', 'd2046000-0000-0000-0000-000000000001', '{"q1":"x"}', now() - interval '2 days'),
  ('d2046000-1111-0000-0000-000000000003', 'd2046000-0000-0000-0000-000000000001', '{"q1":"x"}', now() - interval '1 day'),
  ('d2046000-1111-0000-0000-000000000004', 'd2046000-0000-0000-0000-000000000003', '{"q1":"x"}', now() - interval '4 days');

do $$
declare
  n int;
  rec record;
  a constant uuid := 'd2046000-0000-0000-0000-000000000001';
  b constant uuid := 'd2046000-0000-0000-0000-000000000002';
  latest constant uuid := 'd2046000-1111-0000-0000-000000000003';
  revealed_id uuid;
begin
  -- A backlog of three unanswered dailies is ONE candidate: the latest.
  -- The answer-first set in c2 is not a candidate at all.
  select count(*) into n from public.missed_notification_candidates() where connection_id::text like 'd2046000%';
  assert n = 1, format('EXPECTED exactly 1 candidate, got %s', n);
  select * into rec from public.missed_notification_candidates() where connection_id::text like 'd2046000%';
  assert rec.kind = 'your_turn', 'expected a your_turn candidate';
  assert rec.instance_id = latest, 'expected the latest waiting set';
  assert rec.recipient_id = b, 'wrong recipient';
  assert rec.other_name = 'Ann', 'expected the answerer''s display name';
  assert rec.timezone = 'America/New_York', 'expected the connection time zone';

  -- Too fresh: the normal send may still be in flight.
  select count(*) into n from public.missed_notification_candidates(p_min_minutes => 2 * 24 * 60) where connection_id::text like 'd2046000%';
  assert n = 0, format('EXPECTED none younger than the minimum age, got %s', n);
  -- Too old: given up.
  select count(*) into n from public.missed_notification_candidates(p_turn_max_hours => 12) where connection_id::text like 'd2046000%';
  assert n = 0, format('EXPECTED none older than the window, got %s', n);

  -- Switched off by the recipient: never a candidate.
  update profiles set preferences = '{"notifications":{"your_turn":false}}' where id = b;
  select count(*) into n from public.missed_notification_candidates() where connection_id::text like 'd2046000%';
  assert n = 0, 'EXPECTED no candidate when "your turn" is off';
  update profiles set preferences = '{}' where id = b;

  -- Once the latest set is logged, the older ones are NOT picked up next:
  -- no drip of stale emails.
  insert into notification_log (instance_id, user_id, kind) values (latest, b, 'your_turn');
  select count(*) into n from public.missed_notification_candidates() where connection_id::text like 'd2046000%';
  assert n = 0, format('EXPECTED nothing after the latest set was notified, got %s', n);
  delete from notification_log where instance_id = latest and user_id = b;

  -- A 36-hour reminder already covers it too.
  insert into notification_log (instance_id, user_id, kind) values (latest, b, 'turn_reminder');
  select count(*) into n from public.missed_notification_candidates() where connection_id::text like 'd2046000%';
  assert n = 0, 'EXPECTED nothing when a turn_reminder was already sent';
  delete from notification_log where instance_id = latest and user_id = b;

  -- B answers the latest: it reveals. The reveal is due to A (first to
  -- answer), never to B (who opened it), and only once it is 10+ minutes old.
  insert into prompt_responses (instance_id, user_id, answers) values (latest, b, '{"q1":"y"}');
  select id into revealed_id from prompt_instances where id = latest and status = 'revealed';
  assert revealed_id is not null, 'expected the reveal trigger to open the set';

  select count(*) into n from public.missed_notification_candidates() where connection_id::text like 'd2046000%' and kind = 'revealed';
  assert n = 0, 'EXPECTED no reveal candidate in the first 10 minutes';

  update prompt_instances set revealed_at = now() - interval '2 hours' where id = latest;
  select count(*) into n from public.missed_notification_candidates() where connection_id::text like 'd2046000%' and kind = 'revealed';
  assert n = 1, format('EXPECTED 1 reveal candidate, got %s', n);
  select * into rec from public.missed_notification_candidates() where connection_id::text like 'd2046000%' and kind = 'revealed';
  assert rec.recipient_id = a, 'the reveal goes to the first answerer';
  assert rec.instance_id = latest, 'wrong reveal';

  -- With the latest answered, the next-latest waiting set becomes B's turn.
  select count(*) into n from public.missed_notification_candidates() where connection_id::text like 'd2046000%' and kind = 'your_turn';
  assert n = 1, format('EXPECTED 1 your_turn candidate, got %s', n);

  -- Logged: gone.
  insert into notification_log (instance_id, user_id, kind) values (latest, a, 'revealed');
  select count(*) into n from public.missed_notification_candidates() where connection_id::text like 'd2046000%' and kind = 'revealed';
  assert n = 0, 'EXPECTED no reveal candidate once logged';
  delete from notification_log where instance_id = latest and user_id = a;

  -- A day-old reveal is stale: not worth an email.
  update prompt_instances set revealed_at = now() - interval '30 hours' where id = latest;
  select count(*) into n from public.missed_notification_candidates() where connection_id::text like 'd2046000%' and kind = 'revealed';
  assert n = 0, 'EXPECTED no candidate for a stale reveal';

  -- An archived connection is never notified.
  update prompt_instances set revealed_at = now() - interval '2 hours' where id = latest;
  perform set_config('app.bypass_connection_guards', '1', true);
  update connections set status = 'archived' where id = 'd2046000-aaaa-aaaa-aaaa-000000000001';
  select count(*) into n from public.missed_notification_candidates() where connection_id::text like 'd2046000%';
  assert n = 0, format('EXPECTED nothing for an archived connection, got %s', n);

  -- Browsers can't call the selector.
  begin
    set local role authenticated;
    perform public.missed_notification_candidates();
    assert false, 'authenticated must not execute missed_notification_candidates';
  exception when insufficient_privilege then null;
  end;
  reset role;

  raise notice 'PASS: missed notification candidates (latest only, windows, prefs, once-only, reveal to first answerer)';
end $$;
