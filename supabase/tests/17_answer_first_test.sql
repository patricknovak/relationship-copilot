-- Answer first, while you wait (0033 + existing gate): the inviter answers the
-- onboarding set alone; nothing reveals and nothing leaks until the invitee
-- joins AND answers.

grant all on all tables in schema public to authenticated, service_role;

insert into auth.users (id, email) values
  ('a1700000-0000-0000-0000-000000000001', 'inviter17@example.com'),
  ('a1700000-0000-0000-0000-000000000002', 'invitee17@example.com'),
  ('a1700000-0000-0000-0000-000000000099', 'outsider17@example.com');

-- A pending connection: only the creator is a member (trg_connection_add_creator).
insert into connections (id, type, status, created_by, invite_code, invite_expires_at)
  values ('a1700000-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'sibling', 'pending',
          'a1700000-0000-0000-0000-000000000001', 'ANSWER17', now() + interval '14 days');

-- A creates the onboarding instance and answers, through RLS, before anyone joins.
set role authenticated;
set "test.user_id" = 'a1700000-0000-0000-0000-000000000001';
insert into prompt_instances (id, connection_id, kind, questions, status, scheduled_for)
  values ('a1700000-1111-1111-1111-111111111111',
          'a1700000-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'onboarding',
          '[{"id":"q1","text":"Favourite memory?"}]'::jsonb, 'open', '1970-01-01');
insert into prompt_responses (instance_id, user_id, answers)
  values ('a1700000-1111-1111-1111-111111111111',
          'a1700000-0000-0000-0000-000000000001', '{"q1":"the lake"}'::jsonb);
reset role;

do $$
declare
  st text;
  flag boolean;
begin
  select status into st from prompt_instances
   where id = 'a1700000-1111-1111-1111-111111111111';
  assert st = 'open', format('SOLO REVEAL: instance is %s with one member', st);

  -- Invite page lookup (service role): true for the live code, any case.
  set local role service_role;
  select public.invite_inviter_has_answered('answer17') into flag;
  assert flag is true, 'EXPECTED inviter_has_answered=true for the live code';
  select public.invite_inviter_has_answered('NOPE0000') into flag;
  assert flag is false, 'EXPECTED false for an unknown code';
  reset role;

  raise notice 'PASS: a solo answer stays open and the invite lookup sees it';
end $$;

-- Browsers cannot call the lookup.
do $$
begin
  begin
    set local role anon;
    perform public.invite_inviter_has_answered('ANSWER17');
    assert false, 'anon must not execute invite_inviter_has_answered';
  exception when insufficient_privilege then null;
  end;
  reset role;
  begin
    set local role authenticated;
    set local "test.user_id" = 'a1700000-0000-0000-0000-000000000099';
    perform public.invite_inviter_has_answered('ANSWER17');
    assert false, 'authenticated must not execute invite_inviter_has_answered';
  exception when insufficient_privilege then null;
  end;
  reset role;
  raise notice 'PASS: only the service role can call the invite lookup';
end $$;

-- B joins through the real invite RPC.
set role authenticated;
set "test.user_id" = 'a1700000-0000-0000-0000-000000000002';
select public.accept_invite('ANSWER17');
reset role;

do $$
declare
  st text;
  n int;
  flag boolean;
begin
  select status into st from prompt_instances
   where id = 'a1700000-1111-1111-1111-111111111111';
  assert st = 'open', format('JOIN REVEALED: instance is %s before B answered', st);

  -- The code is consumed on join, so the invite lookup goes false.
  set local role service_role;
  select public.invite_inviter_has_answered('ANSWER17') into flag;
  assert flag is false, 'EXPECTED false once the invite is used';
  reset role;

  set local role authenticated;
  set local "test.user_id" = 'a1700000-0000-0000-0000-000000000002';
  select count(*) into n from prompt_responses
   where instance_id = 'a1700000-1111-1111-1111-111111111111';
  assert n = 0, format('REVEAL LEAK: B saw %s response(s) before answering', n);
  select public.others_have_answered('a1700000-1111-1111-1111-111111111111') into flag;
  assert flag is true, 'EXPECTED B to learn (boolean) that A answered';
  reset role;

  raise notice 'PASS: joining reveals nothing; B only learns that A answered';
end $$;

-- B answers: now, and only now, it reveals.
set role authenticated;
set "test.user_id" = 'a1700000-0000-0000-0000-000000000002';
insert into prompt_responses (instance_id, user_id, answers)
  values ('a1700000-1111-1111-1111-111111111111',
          'a1700000-0000-0000-0000-000000000002', '{"q1":"the treehouse"}'::jsonb);
reset role;

do $$
declare
  st text;
  n int;
begin
  select status into st from prompt_instances
   where id = 'a1700000-1111-1111-1111-111111111111';
  assert st = 'revealed', format('EXPECTED revealed after both answered, got %s', st);

  set local role authenticated;
  set local "test.user_id" = 'a1700000-0000-0000-0000-000000000002';
  select count(*) into n from prompt_responses
   where instance_id = 'a1700000-1111-1111-1111-111111111111';
  assert n = 2, format('EXPECTED B to see both answers after reveal, saw %s', n);
  reset role;

  raise notice 'PASS: answer-first reveals only after the invitee answers';
end $$;

select 'ALL ANSWER-FIRST TESTS PASSED' as result;
