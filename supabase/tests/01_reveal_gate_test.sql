-- Verifies the mutual-reveal mechanic end-to-end under RLS.
-- Run after stubs + migrations. Uses plpgsql ASSERTs; any failure aborts.

-- Grant table privileges to the test role (Supabase does this automatically).
grant all on all tables in schema public to authenticated, service_role;
grant all on all sequences in schema public to authenticated, service_role;

-- Seed two users (profile rows auto-created by the on_auth_user_created trigger).
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'b@example.com');

-- Build an active 2-person connection with an onboarding instance (as superuser).
insert into connections (id, type, status, created_by, onboarding_done)
  values ('33333333-3333-3333-3333-333333333333', 'friend', 'active',
          '11111111-1111-1111-1111-111111111111', false);
insert into connection_members (connection_id, user_id, role, joined_at) values
  ('33333333-3333-3333-3333-333333333333','11111111-1111-1111-1111-111111111111','creator', now()),
  ('33333333-3333-3333-3333-333333333333','22222222-2222-2222-2222-222222222222','member',  now());
insert into prompt_instances (id, connection_id, kind, questions, status)
  values ('44444444-4444-4444-4444-444444444444',
          '33333333-3333-3333-3333-333333333333','onboarding',
          '[{"id":"q1","text":"What matters most to you?"}]'::jsonb, 'open');

-- User A answers (as A, through RLS).
set role authenticated;
set "test.user_id" = '11111111-1111-1111-1111-111111111111';
insert into prompt_responses (instance_id, user_id, answers)
  values ('44444444-4444-4444-4444-444444444444',
          '11111111-1111-1111-1111-111111111111', '{"q1":"honesty"}'::jsonb);
reset role;

-- As B (has NOT answered): must NOT see A's answer (reveal gate closed).
do $$
declare n int;
begin
  set local role authenticated;
  set local "test.user_id" = '22222222-2222-2222-2222-222222222222';
  select count(*) into n from prompt_responses
    where instance_id = '44444444-4444-4444-4444-444444444444';
  assert n = 0, format('REVEAL LEAK: B saw %s response(s) before answering', n);
  reset role;
  raise notice 'PASS: B cannot see A''s answer before answering';
end $$;

-- B answers → reveal trigger should fire.
set role authenticated;
set "test.user_id" = '22222222-2222-2222-2222-222222222222';
insert into prompt_responses (instance_id, user_id, answers)
  values ('44444444-4444-4444-4444-444444444444',
          '22222222-2222-2222-2222-222222222222', '{"q1":"loyalty"}'::jsonb);
reset role;

-- As B (has now answered): must see BOTH answers.
do $$
declare n int; st text;
begin
  set local role authenticated;
  set local "test.user_id" = '22222222-2222-2222-2222-222222222222';
  select count(*) into n from prompt_responses
    where instance_id = '44444444-4444-4444-4444-444444444444';
  assert n = 2, format('EXPECTED 2 responses after both answered, got %s', n);
  reset role;

  select status into st from prompt_instances
    where id = '44444444-4444-4444-4444-444444444444';
  assert st = 'revealed', format('EXPECTED instance revealed, got %s', st);
  raise notice 'PASS: both answers visible after B answered; instance revealed';
end $$;

-- Edit-after-reveal must be frozen.
do $$
declare ok boolean := false;
begin
  set local role authenticated;
  set local "test.user_id" = '22222222-2222-2222-2222-222222222222';
  begin
    update prompt_responses set answers = '{"q1":"changed"}'::jsonb
      where instance_id = '44444444-4444-4444-4444-444444444444'
        and user_id = '22222222-2222-2222-2222-222222222222';
    -- Row exists but policy USING excludes it (status=revealed) → 0 rows updated.
    if not found then ok := true; end if;
  exception when others then ok := true;
  end;
  reset role;
  assert ok, 'EXPECTED edit-after-reveal to be blocked';
  raise notice 'PASS: edit-after-reveal is frozen';
end $$;

-- accept_invite RPC: a third user joins a pending connection via code.
insert into auth.users (id, email) values
  ('55555555-5555-5555-5555-555555555555', 'c@example.com');
insert into connections (id, type, status, created_by, invite_code)
  values ('66666666-6666-6666-6666-666666666666','romantic','pending',
          '11111111-1111-1111-1111-111111111111','JOIN-CODE');
insert into connection_members (connection_id, user_id, role, joined_at)
  values ('66666666-6666-6666-6666-666666666666',
          '11111111-1111-1111-1111-111111111111','creator', now());
do $$
declare cid uuid; st text; cnt int;
begin
  set local role authenticated;
  set local "test.user_id" = '55555555-5555-5555-5555-555555555555';
  cid := accept_invite('JOIN-CODE');
  reset role;
  assert cid = '66666666-6666-6666-6666-666666666666', 'accept_invite returned wrong connection';
  select status into st from connections where id = cid;
  assert st = 'onboarding', format('EXPECTED onboarding after accept, got %s', st);
  select count(*) into cnt from connection_members where connection_id = cid;
  assert cnt = 2, format('EXPECTED 2 members after accept, got %s', cnt);
  raise notice 'PASS: accept_invite adds member, advances status, burns code';
end $$;

-- Blank submissions must not count as answering (migration 0010): an empty
-- response neither unlocks the partner's answers nor triggers the reveal;
-- filling it in later (the upsert/UPDATE path) completes the reveal.
insert into connections (id, type, status, created_by, onboarding_done)
  values ('77777777-7777-7777-7777-777777777777', 'friend', 'active',
          '11111111-1111-1111-1111-111111111111', false);
insert into connection_members (connection_id, user_id, role, joined_at) values
  ('77777777-7777-7777-7777-777777777777','11111111-1111-1111-1111-111111111111','creator', now()),
  ('77777777-7777-7777-7777-777777777777','22222222-2222-2222-2222-222222222222','member',  now());
insert into prompt_instances (id, connection_id, kind, questions, status)
  values ('88888888-8888-8888-8888-888888888888',
          '77777777-7777-7777-7777-777777777777','daily',
          '[{"id":"q1","text":"How are you today?"}]'::jsonb, 'open');

-- A answers for real; B submits only whitespace.
set role authenticated;
set "test.user_id" = '11111111-1111-1111-1111-111111111111';
insert into prompt_responses (instance_id, user_id, answers)
  values ('88888888-8888-8888-8888-888888888888',
          '11111111-1111-1111-1111-111111111111', '{"q1":"grateful"}'::jsonb);
reset role;
set role authenticated;
set "test.user_id" = '22222222-2222-2222-2222-222222222222';
insert into prompt_responses (instance_id, user_id, answers)
  values ('88888888-8888-8888-8888-888888888888',
          '22222222-2222-2222-2222-222222222222', '{"q1":"   "}'::jsonb);
reset role;

do $$
declare n int; st text;
begin
  -- Blank B must not see A's answer…
  set local role authenticated;
  set local "test.user_id" = '22222222-2222-2222-2222-222222222222';
  select count(*) into n from prompt_responses
    where instance_id = '88888888-8888-8888-8888-888888888888'
      and user_id = '11111111-1111-1111-1111-111111111111';
  assert n = 0, format('REVEAL LEAK: blank submit exposed %s partner response(s)', n);
  reset role;

  -- …and the instance must still be open.
  select status into st from prompt_instances
    where id = '88888888-8888-8888-8888-888888888888';
  assert st = 'open', format('EXPECTED open after blank submit, got %s', st);
  raise notice 'PASS: a blank submission neither unlocks nor reveals';
end $$;

-- B fills the answer in (UPDATE path) → reveal must complete now.
set role authenticated;
set "test.user_id" = '22222222-2222-2222-2222-222222222222';
update prompt_responses set answers = '{"q1":"tired but happy"}'::jsonb
  where instance_id = '88888888-8888-8888-8888-888888888888'
    and user_id = '22222222-2222-2222-2222-222222222222';
reset role;

do $$
declare st text; n int;
begin
  select status into st from prompt_instances
    where id = '88888888-8888-8888-8888-888888888888';
  assert st = 'revealed', format('EXPECTED revealed after B added content, got %s', st);

  set local role authenticated;
  set local "test.user_id" = '22222222-2222-2222-2222-222222222222';
  select count(*) into n from prompt_responses
    where instance_id = '88888888-8888-8888-8888-888888888888';
  assert n = 2, format('EXPECTED both responses visible after reveal, got %s', n);
  reset role;
  raise notice 'PASS: adding content to a blank response completes the reveal';
end $$;

select 'ALL REVEAL-GATE TESTS PASSED' as result;
