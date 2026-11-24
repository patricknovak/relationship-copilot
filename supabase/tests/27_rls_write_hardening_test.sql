-- Write-side RLS hardening (migration 0046): outsiders cannot post into a
-- discussion, re-point a response or reaction at someone else's instance, or
-- trigger someone else's reveal; a closed connection stays closed for
-- clients; the free-plan connection cap holds against direct inserts.

insert into auth.users (id, email) values
  ('e7000000-0000-0000-0000-000000000001', 'w1@example.com'),
  ('e7000000-0000-0000-0000-000000000002', 'w2@example.com'),
  ('e7000000-0000-0000-0000-000000000003', 'outsider@example.com'),
  ('e7000000-0000-0000-0000-000000000004', 'capped@example.com');

-- Couple A (users 1 + 2), and the outsider's own solo connection.
insert into connections (id, type, status, created_by) values
  ('e7000000-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'romantic', 'active',
   'e7000000-0000-0000-0000-000000000001'),
  ('e7000000-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'friend', 'pending',
   'e7000000-0000-0000-0000-000000000003');
insert into connection_members (connection_id, user_id, role, joined_at) values
  ('e7000000-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'e7000000-0000-0000-0000-000000000002', 'member', now());

insert into prompt_instances (id, connection_id, kind, questions, scheduled_for, status) values
  -- Couple A: one revealed below, one still waiting on user 2.
  ('e7000000-1111-1111-1111-111111111111', 'e7000000-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'daily',
   '[{"id":"q1","text":"t","format":"free_text"}]'::jsonb, '2026-11-01', 'open'),
  ('e7000000-2222-2222-2222-222222222222', 'e7000000-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'daily',
   '[{"id":"q1","text":"t","format":"free_text"}]'::jsonb, '2026-11-02', 'open'),
  -- The outsider's own open instance, with their own answer.
  ('e7000000-3333-3333-3333-333333333333', 'e7000000-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'daily',
   '[{"id":"q1","text":"t","format":"free_text"}]'::jsonb, '2026-11-01', 'open');

insert into prompt_responses (instance_id, user_id, answers) values
  ('e7000000-1111-1111-1111-111111111111', 'e7000000-0000-0000-0000-000000000001', '{"q1":"a"}'::jsonb),
  ('e7000000-1111-1111-1111-111111111111', 'e7000000-0000-0000-0000-000000000002', '{"q1":"b"}'::jsonb),
  ('e7000000-2222-2222-2222-222222222222', 'e7000000-0000-0000-0000-000000000001', '{"q1":"private"}'::jsonb),
  ('e7000000-3333-3333-3333-333333333333', 'e7000000-0000-0000-0000-000000000003', '{"q1":"mine"}'::jsonb);

do $$
declare st text;
begin
  select status into st from prompt_instances where id = 'e7000000-1111-1111-1111-111111111111';
  assert st = 'revealed', format('EXPECTED first instance revealed, got %s', st);
  select status into st from prompt_instances where id = 'e7000000-2222-2222-2222-222222222222';
  assert st = 'open', format('EXPECTED second instance open, got %s', st);
end $$;

-- 1. Discussions: an outsider with the instance id cannot post; a member can.
do $$
declare blocked boolean := false; n int;
begin
  set local role authenticated;
  set local "test.user_id" = 'e7000000-0000-0000-0000-000000000003';
  begin
    insert into prompt_discussions (instance_id, user_id, body) values
      ('e7000000-1111-1111-1111-111111111111', 'e7000000-0000-0000-0000-000000000003', 'hello from outside');
  exception when others then blocked := true;
  end;
  reset role; reset "test.user_id";
  assert blocked, 'EXPECTED outsider discussion post to be blocked';

  set local role authenticated;
  set local "test.user_id" = 'e7000000-0000-0000-0000-000000000002';
  insert into prompt_discussions (instance_id, user_id, body) values
    ('e7000000-1111-1111-1111-111111111111', 'e7000000-0000-0000-0000-000000000002', 'from a member');
  reset role; reset "test.user_id";
  select count(*) into n from prompt_discussions
   where instance_id = 'e7000000-1111-1111-1111-111111111111';
  assert n = 1, format('EXPECTED exactly the member post, got %s', n);
  raise notice 'PASS: discussions are members-only';
end $$;

-- 2. Responses: an outsider cannot re-point their own answer at couple A's
--    open instance, so couple A's reveal cannot be forced from outside.
do $$
declare blocked boolean := false; st text; n int;
begin
  set local role authenticated;
  set local "test.user_id" = 'e7000000-0000-0000-0000-000000000003';
  begin
    update prompt_responses
       set instance_id = 'e7000000-2222-2222-2222-222222222222'
     where instance_id = 'e7000000-3333-3333-3333-333333333333'
       and user_id = 'e7000000-0000-0000-0000-000000000003';
  exception when others then blocked := true;
  end;
  reset role; reset "test.user_id";
  assert blocked, 'EXPECTED re-pointing a response at another connection to be blocked';
  select status into st from prompt_instances where id = 'e7000000-2222-2222-2222-222222222222';
  assert st = 'open', format('EXPECTED couple A instance to stay open, got %s', st);

  -- An ordinary edit of your own open answer still works.
  set local role authenticated;
  set local "test.user_id" = 'e7000000-0000-0000-0000-000000000003';
  update prompt_responses set answers = '{"q1":"edited"}'::jsonb
   where instance_id = 'e7000000-3333-3333-3333-333333333333'
     and user_id = 'e7000000-0000-0000-0000-000000000003';
  get diagnostics n = row_count;
  reset role; reset "test.user_id";
  assert n = 1, 'EXPECTED editing your own open answer to keep working';
  raise notice 'PASS: responses cannot be re-pointed at another connection';
end $$;

-- 3. Reveal trigger: even a non-member row written with full privileges does
--    not count toward the reveal.
do $$
declare st text;
begin
  insert into prompt_responses (instance_id, user_id, answers) values
    ('e7000000-2222-2222-2222-222222222222', 'e7000000-0000-0000-0000-000000000003', '{"q1":"x"}'::jsonb);
  select status into st from prompt_instances where id = 'e7000000-2222-2222-2222-222222222222';
  assert st = 'open', format('EXPECTED non-member answer not to reveal, got %s', st);
  delete from prompt_responses
   where instance_id = 'e7000000-2222-2222-2222-222222222222'
     and user_id = 'e7000000-0000-0000-0000-000000000003';

  -- The real second member answering still reveals.
  set local role authenticated;
  set local "test.user_id" = 'e7000000-0000-0000-0000-000000000002';
  insert into prompt_responses (instance_id, user_id, answers) values
    ('e7000000-2222-2222-2222-222222222222', 'e7000000-0000-0000-0000-000000000002', '{"q1":"y"}'::jsonb);
  reset role; reset "test.user_id";
  select status into st from prompt_instances where id = 'e7000000-2222-2222-2222-222222222222';
  assert st = 'revealed', format('EXPECTED member answer to reveal, got %s', st);
  raise notice 'PASS: only joined members count toward the reveal';
end $$;

-- 4. Reactions: cannot be re-pointed at an instance you are not a member of.
do $$
declare blocked boolean := false;
begin
  -- Outsider gets a second member and a revealed instance of their own, so
  -- they hold a legitimate reaction row to try to move.
  update connections set status = 'active' where id = 'e7000000-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  insert into connection_members (connection_id, user_id, role, joined_at) values
    ('e7000000-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'e7000000-0000-0000-0000-000000000004', 'member', now());
  insert into prompt_responses (instance_id, user_id, answers) values
    ('e7000000-3333-3333-3333-333333333333', 'e7000000-0000-0000-0000-000000000004', '{"q1":"z"}'::jsonb);

  set local role authenticated;
  set local "test.user_id" = 'e7000000-0000-0000-0000-000000000003';
  insert into answer_reactions (instance_id, user_id, target_user_id, question_id, emoji) values
    ('e7000000-3333-3333-3333-333333333333', 'e7000000-0000-0000-0000-000000000003',
     'e7000000-0000-0000-0000-000000000004', 'q1', '❤️');
  -- Changing the emoji on your own reaction still works.
  update answer_reactions set emoji = '😂'
   where instance_id = 'e7000000-3333-3333-3333-333333333333'
     and user_id = 'e7000000-0000-0000-0000-000000000003';
  begin
    update answer_reactions
       set instance_id = 'e7000000-1111-1111-1111-111111111111',
           target_user_id = 'e7000000-0000-0000-0000-000000000001'
     where instance_id = 'e7000000-3333-3333-3333-333333333333'
       and user_id = 'e7000000-0000-0000-0000-000000000003';
  exception when others then blocked := true;
  end;
  reset role; reset "test.user_id";
  assert blocked, 'EXPECTED re-pointing a reaction at another connection to be blocked';
  raise notice 'PASS: reactions cannot be re-pointed at another connection';
end $$;

-- 5. A closed connection stays closed for clients; server code can still act.
do $$
declare blocked boolean := false; st text;
begin
  set local role authenticated;
  set local "test.user_id" = 'e7000000-0000-0000-0000-000000000002';
  update connections set status = 'archived' where id = 'e7000000-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  reset role; reset "test.user_id";
  select status into st from connections where id = 'e7000000-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  assert st = 'archived', format('EXPECTED a member to be able to leave, got %s', st);

  set local role authenticated;
  set local "test.user_id" = 'e7000000-0000-0000-0000-000000000001';
  begin
    update connections set status = 'active' where id = 'e7000000-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  exception when others then blocked := true;
  end;
  reset role; reset "test.user_id";
  assert blocked, 'EXPECTED the other member not to reopen an archived connection';
  select status into st from connections where id = 'e7000000-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  assert st = 'archived', format('EXPECTED still archived, got %s', st);

  -- No auth.uid(): the service role / migrations are not restricted.
  update connections set status = 'active' where id = 'e7000000-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  select status into st from connections where id = 'e7000000-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  assert st = 'active', format('EXPECTED server-side status change to work, got %s', st);
  raise notice 'PASS: closed connections cannot be reopened by clients';
end $$;

-- 6. Free-plan cap holds against direct inserts, single-row and multi-row;
--    archived connections do not count; Premium lifts it.
do $$
declare blocked boolean := false; n int;
begin
  -- User 4 is already a joined member of one live connection (bbbb).
  set local role authenticated;
  set local "test.user_id" = 'e7000000-0000-0000-0000-000000000004';
  insert into connections (type, created_by, invite_code) values
    ('friend', 'e7000000-0000-0000-0000-000000000004', 'CAPTEST00001'),
    ('friend', 'e7000000-0000-0000-0000-000000000004', 'CAPTEST00002');
  begin
    insert into connections (type, created_by, invite_code) values
      ('friend', 'e7000000-0000-0000-0000-000000000004', 'CAPTEST00003');
  exception when others then blocked := true;
  end;
  reset role; reset "test.user_id";
  assert blocked, 'EXPECTED the fourth live connection to be blocked on the free plan';

  -- Archiving one frees a slot; a two-row insert may then add only one.
  set local role authenticated;
  set local "test.user_id" = 'e7000000-0000-0000-0000-000000000004';
  update connections set status = 'archived' where invite_code = 'CAPTEST00001';
  blocked := false;
  begin
    insert into connections (type, created_by, invite_code) values
      ('friend', 'e7000000-0000-0000-0000-000000000004', 'CAPTEST00004'),
      ('friend', 'e7000000-0000-0000-0000-000000000004', 'CAPTEST00005');
  exception when others then blocked := true;
  end;
  reset role; reset "test.user_id";
  assert blocked, 'EXPECTED a multi-row insert not to slip past the cap';

  set local role authenticated;
  set local "test.user_id" = 'e7000000-0000-0000-0000-000000000004';
  insert into connections (type, created_by, invite_code) values
    ('friend', 'e7000000-0000-0000-0000-000000000004', 'CAPTEST00004');
  reset role; reset "test.user_id";

  -- Premium: no cap.
  insert into subscriptions (user_id, plan, status) values
    ('e7000000-0000-0000-0000-000000000004', 'premium', 'active');
  set local role authenticated;
  set local "test.user_id" = 'e7000000-0000-0000-0000-000000000004';
  insert into connections (type, created_by, invite_code) values
    ('friend', 'e7000000-0000-0000-0000-000000000004', 'CAPTEST00006');
  select count(*) into n from connections where status <> 'archived';
  reset role; reset "test.user_id";
  assert n = 4, format('EXPECTED 4 live connections for the Premium user, got %s', n);
  raise notice 'PASS: free-plan connection cap is enforced by RLS';
end $$;

-- (0046 also revokes TRUNCATE/REFERENCES/TRIGGER from the API roles. That is
-- not asserted here: tests 01 and 21 re-grant ALL to authenticated so the
-- suite can run on plain Postgres, which would mask it.)
