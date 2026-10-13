-- answer_reactions (migration 0023): members react to each other's answers
-- only after reveal; strangers see nothing; you can't react to yourself.

insert into auth.users (id, email) values
  ('d0000000-0000-0000-0000-000000000001', 'r1@example.com'),
  ('d0000000-0000-0000-0000-000000000002', 'r2@example.com'),
  ('d0000000-0000-0000-0000-000000000003', 'r3@example.com');

insert into connections (id, type, status, created_by) values
  ('d0000000-cccc-cccc-cccc-cccccccccccc', 'friend', 'active',
   'd0000000-0000-0000-0000-000000000001');
insert into connection_members (connection_id, user_id, role, joined_at) values
  ('d0000000-cccc-cccc-cccc-cccccccccccc','d0000000-0000-0000-0000-000000000002','member', now());

insert into prompt_instances (id, connection_id, kind, questions, scheduled_for, status) values
  ('d0000000-1111-1111-1111-111111111111', 'd0000000-cccc-cccc-cccc-cccccccccccc', 'daily',
   '[{"id":"q1","text":"t","format":"free_text"}]'::jsonb, '2026-10-14', 'open');

-- Only user 1 has answered: still open.
insert into prompt_responses (instance_id, user_id, answers) values
  ('d0000000-1111-1111-1111-111111111111','d0000000-0000-0000-0000-000000000001','{"q1":"mine"}'::jsonb);

do $$
declare blocked boolean := false;
begin
  set local role authenticated;
  set local "test.user_id" = 'd0000000-0000-0000-0000-000000000002';
  begin
    insert into answer_reactions (instance_id, user_id, target_user_id, question_id, emoji) values
      ('d0000000-1111-1111-1111-111111111111','d0000000-0000-0000-0000-000000000002',
       'd0000000-0000-0000-0000-000000000001','q1','❤️');
  exception when others then blocked := true;
  end;
  reset role; reset "test.user_id";
  assert blocked, 'EXPECTED reaction to be blocked before reveal';
  raise notice 'PASS: no reactions before reveal';
end $$;

-- User 2 answers → trigger reveals.
insert into prompt_responses (instance_id, user_id, answers) values
  ('d0000000-1111-1111-1111-111111111111','d0000000-0000-0000-0000-000000000002','{"q1":"theirs"}'::jsonb);

do $$
declare n int; blocked boolean := false; e text;
begin
  assert (select status from prompt_instances where id = 'd0000000-1111-1111-1111-111111111111') = 'revealed',
    'EXPECTED instance to have revealed';

  set local role authenticated;
  set local "test.user_id" = 'd0000000-0000-0000-0000-000000000002';

  -- React to the other person's answer.
  insert into answer_reactions (instance_id, user_id, target_user_id, question_id, emoji) values
    ('d0000000-1111-1111-1111-111111111111','d0000000-0000-0000-0000-000000000002',
     'd0000000-0000-0000-0000-000000000001','q1','❤️');

  -- Change it: upsert replaces.
  insert into answer_reactions (instance_id, user_id, target_user_id, question_id, emoji) values
    ('d0000000-1111-1111-1111-111111111111','d0000000-0000-0000-0000-000000000002',
     'd0000000-0000-0000-0000-000000000001','q1','😂')
  on conflict (instance_id, user_id, target_user_id, question_id)
  do update set emoji = excluded.emoji, created_at = now();
  select emoji into e from answer_reactions
   where user_id = 'd0000000-0000-0000-0000-000000000002';
  assert e = '😂', format('EXPECTED replaced emoji, got %s', e);
  select count(*) into n from answer_reactions;
  assert n = 1, format('EXPECTED one reaction row, got %s', n);

  -- Can't react to your own answer.
  begin
    insert into answer_reactions (instance_id, user_id, target_user_id, question_id, emoji) values
      ('d0000000-1111-1111-1111-111111111111','d0000000-0000-0000-0000-000000000002',
       'd0000000-0000-0000-0000-000000000002','q1','❤️');
  exception when others then blocked := true;
  end;
  assert blocked, 'EXPECTED self-reaction to be blocked';

  -- Can't write a reaction as someone else.
  blocked := false;
  begin
    insert into answer_reactions (instance_id, user_id, target_user_id, question_id, emoji) values
      ('d0000000-1111-1111-1111-111111111111','d0000000-0000-0000-0000-000000000001',
       'd0000000-0000-0000-0000-000000000002','q1','❤️');
  exception when others then blocked := true;
  end;
  assert blocked, 'EXPECTED impersonated reaction to be blocked';

  -- The other member sees it.
  set local "test.user_id" = 'd0000000-0000-0000-0000-000000000001';
  select count(*) into n from answer_reactions;
  assert n = 1, 'EXPECTED the answer owner to see the reaction';

  -- A stranger sees nothing and can't insert.
  set local "test.user_id" = 'd0000000-0000-0000-0000-000000000003';
  select count(*) into n from answer_reactions;
  assert n = 0, 'EXPECTED a stranger to see no reactions';
  blocked := false;
  begin
    insert into answer_reactions (instance_id, user_id, target_user_id, question_id, emoji) values
      ('d0000000-1111-1111-1111-111111111111','d0000000-0000-0000-0000-000000000003',
       'd0000000-0000-0000-0000-000000000001','q1','❤️');
  exception when others then blocked := true;
  end;
  assert blocked, 'EXPECTED a stranger to be blocked from reacting';

  -- Removing your own reaction works.
  set local "test.user_id" = 'd0000000-0000-0000-0000-000000000002';
  delete from answer_reactions where user_id = 'd0000000-0000-0000-0000-000000000002';
  select count(*) into n from answer_reactions;
  assert n = 0, 'EXPECTED own reaction to be deletable';

  reset role; reset "test.user_id";
  raise notice 'PASS: reactions are member-only, post-reveal, never on your own answer';
end $$;

select 'ALL ANSWER REACTION TESTS PASSED' as result;
