-- Verifies the deletion semantics introduced in 0007 ("redact, partner keeps
-- theirs"): deleting a user's auth row cascades away their own content but
-- must NOT take down a shared connection or the partner's answers.
-- Run after stubs + migrations (and after 01/02, which it does not depend on).

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'del-a@example.com'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'del-b@example.com');

insert into connections (id, type, status, created_by)
  values ('bbbbbbbb-0000-0000-0000-000000000001', 'romantic', 'active',
          'aaaaaaaa-0000-0000-0000-000000000001');
insert into connection_members (connection_id, user_id, role, joined_at) values
  ('bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','creator', now()),
  ('bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000002','member',  now());
insert into prompt_instances (id, connection_id, kind, questions, status)
  values ('cccccccc-0000-0000-0000-000000000001',
          'bbbbbbbb-0000-0000-0000-000000000001','onboarding',
          '[{"id":"q1","text":"?"}]'::jsonb, 'revealed');
insert into prompt_responses (instance_id, user_id, answers) values
  ('cccccccc-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','{"q1":"mine"}'::jsonb),
  ('cccccccc-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000002','{"q1":"theirs"}'::jsonb);
insert into safety_events (user_id, category)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'abuse');
insert into audit_log (user_id, action)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'connection.create');

-- Simulate account deletion of user A (the app deletes the auth user; the
-- cascade does the rest).
delete from auth.users where id = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
declare n int; cb uuid;
begin
  -- A's own content is gone.
  select count(*) into n from profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001';
  assert n = 0, 'EXPECTED profile to cascade away';
  select count(*) into n from prompt_responses where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  assert n = 0, 'EXPECTED deleted user''s answers to cascade away';
  select count(*) into n from safety_events where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  assert n = 0, 'EXPECTED safety events to cascade away';

  -- The shared connection survives (created_by set to null, not cascaded).
  select count(*) into n from connections where id = 'bbbbbbbb-0000-0000-0000-000000000001';
  assert n = 1, 'CONNECTION LOST: partner''s connection was cascade-deleted';
  select created_by into cb from connections where id = 'bbbbbbbb-0000-0000-0000-000000000001';
  assert cb is null, 'EXPECTED created_by to become null';

  -- The partner keeps their own answer.
  select count(*) into n from prompt_responses
    where user_id = 'aaaaaaaa-0000-0000-0000-000000000002';
  assert n = 1, 'PARTNER DATA LOST: their answer was deleted';

  -- The audit trail survives, detached from the deleted user.
  select count(*) into n from audit_log
    where action = 'connection.create' and user_id is null;
  assert n = 1, 'EXPECTED audit row to survive with user_id null';

  raise notice 'PASS: deletion removes the user''s content, partner keeps theirs';
end $$;

select 'ALL ACCOUNT-LIFECYCLE TESTS PASSED' as result;
