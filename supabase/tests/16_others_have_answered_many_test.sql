-- Migration 0032: batch others_have_answered_many matches the single RPC.

insert into auth.users (id, email) values
  ('a1600000-0000-0000-0000-000000000001', 'batch1@example.com'),
  ('a1600000-0000-0000-0000-000000000002', 'batch2@example.com'),
  ('a1600000-0000-0000-0000-000000000099', 'batch-outsider@example.com');

insert into connections (id, type, status, created_by) values
  ('a1600000-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'friend', 'active',
   'a1600000-0000-0000-0000-000000000001');
insert into connection_members (connection_id, user_id, role, joined_at) values
  ('a1600000-aaaa-aaaa-aaaa-aaaaaaaaaaaa','a1600000-0000-0000-0000-000000000002','member', now());

insert into prompt_instances (id, connection_id, kind, status, questions) values
  ('a1600000-1111-1111-1111-111111111111',
   'a1600000-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'daily', 'open',
   '[{"id":"q1","text":"Hi?","format":"free_text"}]'::jsonb),
  ('a1600000-2222-2222-2222-222222222222',
   'a1600000-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'daily', 'open',
   '[{"id":"q1","text":"Bye?","format":"free_text"}]'::jsonb);

-- A answered instance 1 only.
insert into prompt_responses (instance_id, user_id, answers) values
  ('a1600000-1111-1111-1111-111111111111',
   'a1600000-0000-0000-0000-000000000001',
   '{"q1":"hello"}'::jsonb);

do $$
declare
  flag boolean;
  n int;
begin
  -- As B: instance 1 has other's answer; instance 2 does not.
  set local "test.user_id" = 'a1600000-0000-0000-0000-000000000002';

  select answered into flag
  from public.others_have_answered_many(array[
    'a1600000-1111-1111-1111-111111111111'::uuid,
    'a1600000-2222-2222-2222-222222222222'::uuid
  ])
  where instance_id = 'a1600000-1111-1111-1111-111111111111';
  assert flag is true, 'EXPECTED batch answered=true for instance 1 as B';

  select answered into flag
  from public.others_have_answered_many(array[
    'a1600000-1111-1111-1111-111111111111'::uuid,
    'a1600000-2222-2222-2222-222222222222'::uuid
  ])
  where instance_id = 'a1600000-2222-2222-2222-222222222222';
  assert flag is false, 'EXPECTED batch answered=false for instance 2 as B';

  -- Matches the single-instance RPC.
  select public.others_have_answered('a1600000-1111-1111-1111-111111111111')
    into flag;
  assert flag is true, 'EXPECTED single RPC true for instance 1 as B';

  -- Outsider sees false (not a member).
  set local "test.user_id" = 'a1600000-0000-0000-0000-000000000099';
  select count(*) into n
  from public.others_have_answered_many(array[
    'a1600000-1111-1111-1111-111111111111'::uuid
  ])
  where answered;
  assert n = 0, 'EXPECTED outsider to get answered=false';

  raise notice 'PASS: others_have_answered_many matches single RPC and is member-scoped';
end $$;
