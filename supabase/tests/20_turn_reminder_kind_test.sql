-- Migration 0036: the turn_reminder kind is once-only, and
-- turn_reminder_candidates picks exactly the sets that have waited 36h+ on
-- one person, measured from the later of the answer and the recipient's join.

insert into auth.users (id, email) values
  ('d2036000-0000-0000-0000-000000000001', 'turn-a@example.com'),
  ('d2036000-0000-0000-0000-000000000002', 'turn-b@example.com'),
  ('d2036000-0000-0000-0000-000000000003', 'turn-c@example.com'),
  ('d2036000-0000-0000-0000-000000000004', 'turn-d@example.com');
update profiles set display_name = 'Ann' where id = 'd2036000-0000-0000-0000-000000000001';

-- c1: A + B, B joined long ago.  c2: C + D, D joined an hour ago.
insert into connections (id, type, status, created_by) values
  ('d2036000-aaaa-aaaa-aaaa-000000000001', 'friend', 'active', 'd2036000-0000-0000-0000-000000000001'),
  ('d2036000-aaaa-aaaa-aaaa-000000000002', 'friend', 'onboarding', 'd2036000-0000-0000-0000-000000000003');
insert into connection_members (connection_id, user_id, role, joined_at) values
  ('d2036000-aaaa-aaaa-aaaa-000000000001', 'd2036000-0000-0000-0000-000000000002', 'member', now() - interval '30 days'),
  ('d2036000-aaaa-aaaa-aaaa-000000000002', 'd2036000-0000-0000-0000-000000000004', 'member', now() - interval '1 hour');

insert into prompt_instances (id, connection_id, kind, status, questions) values
  ('d2036000-1111-0000-0000-000000000001', 'd2036000-aaaa-aaaa-aaaa-000000000001', 'quiz', 'open', '[{"id":"q1","text":"?"}]'),
  ('d2036000-1111-0000-0000-000000000002', 'd2036000-aaaa-aaaa-aaaa-000000000001', 'daily', 'open', '[{"id":"q1","text":"?"}]'),
  ('d2036000-1111-0000-0000-000000000003', 'd2036000-aaaa-aaaa-aaaa-000000000001', 'challenge', 'open', '[{"id":"q1","text":"?"}]'),
  ('d2036000-1111-0000-0000-000000000004', 'd2036000-aaaa-aaaa-aaaa-000000000001', 'quiz', 'open', '[{"id":"q1","text":"?"}]'),
  ('d2036000-1111-0000-0000-000000000005', 'd2036000-aaaa-aaaa-aaaa-000000000002', 'onboarding', 'open', '[{"id":"q1","text":"?"}]');

insert into prompt_responses (instance_id, user_id, answers, submitted_at) values
  -- waited 40h: candidate
  ('d2036000-1111-0000-0000-000000000001', 'd2036000-0000-0000-0000-000000000001', '{"q1":"x"}', now() - interval '40 hours'),
  -- daily: never
  ('d2036000-1111-0000-0000-000000000002', 'd2036000-0000-0000-0000-000000000001', '{"q1":"x"}', now() - interval '40 hours'),
  -- older than a week: given up
  ('d2036000-1111-0000-0000-000000000003', 'd2036000-0000-0000-0000-000000000001', '{"q1":"x"}', now() - interval '9 days'),
  -- only 10h: not yet
  ('d2036000-1111-0000-0000-000000000004', 'd2036000-0000-0000-0000-000000000001', '{"q1":"x"}', now() - interval '10 hours'),
  -- answer-first: C answered 4 days ago, D joined an hour ago: not yet
  ('d2036000-1111-0000-0000-000000000005', 'd2036000-0000-0000-0000-000000000003', '{"q1":"x"}', now() - interval '4 days');

do $$
declare
  n int;
  rec record;
begin
  select count(*) into n from public.turn_reminder_candidates();
  assert n = 1, format('EXPECTED exactly 1 candidate, got %s', n);
  select * into rec from public.turn_reminder_candidates();
  assert rec.instance_id = 'd2036000-1111-0000-0000-000000000001', 'wrong candidate set';
  assert rec.recipient_id = 'd2036000-0000-0000-0000-000000000002', 'wrong recipient';
  assert rec.answered_by_name = 'Ann', 'expected the answerer''s display name';

  -- Once B answers, the set drops out.
  insert into prompt_responses (instance_id, user_id, answers)
    values ('d2036000-1111-0000-0000-000000000001', 'd2036000-0000-0000-0000-000000000002', '{"q1":"y"}');
  select count(*) into n from public.turn_reminder_candidates();
  assert n = 0, format('EXPECTED none after both answered, got %s', n);
  delete from prompt_responses
   where instance_id = 'd2036000-1111-0000-0000-000000000001'
     and user_id = 'd2036000-0000-0000-0000-000000000002';

  -- Once reminded, never again.
  insert into notification_log (instance_id, user_id, kind)
    values ('d2036000-1111-0000-0000-000000000001', 'd2036000-0000-0000-0000-000000000002', 'turn_reminder');
  select count(*) into n from public.turn_reminder_candidates();
  assert n = 0, 'EXPECTED no candidate after the reminder was logged';
  begin
    insert into notification_log (instance_id, user_id, kind)
      values ('d2036000-1111-0000-0000-000000000001', 'd2036000-0000-0000-0000-000000000002', 'turn_reminder');
    assert false, 'turn_reminder must be once per instance per person';
  exception when unique_violation then null;
  end;
  begin
    insert into notification_log (instance_id, user_id, kind)
      values ('d2036000-1111-0000-0000-000000000001', 'd2036000-0000-0000-0000-000000000002', 'nag');
    assert false, 'unknown kinds must still be rejected';
  exception when check_violation then null;
  end;

  -- Browsers can't call the selector.
  begin
    set local role authenticated;
    perform public.turn_reminder_candidates();
    assert false, 'authenticated must not execute turn_reminder_candidates';
  exception when insufficient_privilege then null;
  end;
  reset role;

  raise notice 'PASS: turn_reminder candidates (36h, a week, joined_at, once-only, dailies excluded)';
end $$;
