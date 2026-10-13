-- connection_goals (migration 0030): members add/tick/edit/remove, strangers
-- see nothing, ownership columns are frozen, deletion keeps the list.

insert into auth.users (id, email) values
  ('90000000-0000-0000-0000-000000000001', 'g1@example.com'),
  ('90000000-0000-0000-0000-000000000002', 'g2@example.com'),
  ('90000000-0000-0000-0000-000000000003', 'g3@example.com');

insert into connections (id, type, status, created_by) values
  ('90000000-cccc-cccc-cccc-cccccccccccc', 'romantic', 'active',
   '90000000-0000-0000-0000-000000000001');
insert into connection_members (connection_id, user_id, role, joined_at) values
  ('90000000-cccc-cccc-cccc-cccccccccccc','90000000-0000-0000-0000-000000000002','member', now());

do $$
declare n int; gid uuid; blocked boolean := false;
begin
  set local role authenticated;

  -- Member 1 adds a goal.
  set local "test.user_id" = '90000000-0000-0000-0000-000000000001';
  insert into connection_goals (connection_id, created_by, body)
    values ('90000000-cccc-cccc-cccc-cccccccccccc', '90000000-0000-0000-0000-000000000001', 'Sunday walk')
    returning id into gid;

  -- Can't write it as someone else.
  begin
    insert into connection_goals (connection_id, created_by, body)
      values ('90000000-cccc-cccc-cccc-cccccccccccc', '90000000-0000-0000-0000-000000000002', 'nope');
  exception when others then blocked := true;
  end;
  assert blocked, 'EXPECTED created_by to be enforced';

  -- Member 2 sees it and ticks it off.
  set local "test.user_id" = '90000000-0000-0000-0000-000000000002';
  select count(*) into n from connection_goals;
  assert n = 1, 'EXPECTED the other member to see the goal';
  update connection_goals set done_at = now() where id = gid;
  assert (select done_at from connection_goals where id = gid) is not null, 'EXPECTED tick to persist';

  -- Ownership columns are frozen.
  blocked := false;
  begin
    update connection_goals set created_by = '90000000-0000-0000-0000-000000000002' where id = gid;
  exception when others then blocked := true;
  end;
  assert blocked, 'EXPECTED created_by to be frozen';

  -- Body length is bounded.
  blocked := false;
  begin
    update connection_goals set body = repeat('x', 201) where id = gid;
  exception when check_violation then blocked := true;
  end;
  assert blocked, 'EXPECTED a 201-char body to be rejected';

  -- A stranger sees nothing and cannot add.
  set local "test.user_id" = '90000000-0000-0000-0000-000000000003';
  select count(*) into n from connection_goals;
  assert n = 0, 'EXPECTED a stranger to see no goals';
  blocked := false;
  begin
    insert into connection_goals (connection_id, created_by, body)
      values ('90000000-cccc-cccc-cccc-cccccccccccc', '90000000-0000-0000-0000-000000000003', 'intrude');
  exception when others then blocked := true;
  end;
  assert blocked, 'EXPECTED a stranger to be blocked from adding';

  reset role; reset "test.user_id";
  raise notice 'PASS: connection_goals are member-only and both-edit';
end $$;

-- Deleting the author keeps the shared list for the partner.
delete from auth.users where id = '90000000-0000-0000-0000-000000000001';
do $$
declare n int;
begin
  select count(*) into n from connection_goals where created_by is null and body = 'Sunday walk';
  assert n = 1, 'EXPECTED the goal to survive the author''s deletion with created_by null';
  raise notice 'PASS: shared goals survive a member deletion';
end $$;

select 'ALL CONNECTION GOALS TESTS PASSED' as result;
