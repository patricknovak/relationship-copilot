-- notification_log (migration 0021): once-only per (instance, user, kind),
-- invisible and unwritable for clients, writable for the service role.

insert into auth.users (id, email) values
  ('f0000000-0000-0000-0000-000000000001', 'n1@example.com'),
  ('f0000000-0000-0000-0000-000000000002', 'n2@example.com');

insert into connections (id, type, status, created_by)
  values ('f0000000-cccc-cccc-cccc-cccccccccccc', 'friend', 'active',
          'f0000000-0000-0000-0000-000000000001');
insert into connection_members (connection_id, user_id, role, joined_at) values
  ('f0000000-cccc-cccc-cccc-cccccccccccc','f0000000-0000-0000-0000-000000000002','member', now());

insert into prompt_instances (id, connection_id, kind, questions, scheduled_for, status) values
  ('f0000000-1111-1111-1111-111111111111', 'f0000000-cccc-cccc-cccc-cccccccccccc', 'daily',
   '[{"id":"q1","text":"t","format":"free_text"}]'::jsonb, '2026-10-13', 'open');

-- Service role (auth.uid() null, bypassrls): first insert wins, second conflicts.
do $$
declare n int;
begin
  insert into notification_log (instance_id, user_id, kind)
    values ('f0000000-1111-1111-1111-111111111111', 'f0000000-0000-0000-0000-000000000002', 'your_turn');
  insert into notification_log (instance_id, user_id, kind)
    values ('f0000000-1111-1111-1111-111111111111', 'f0000000-0000-0000-0000-000000000002', 'your_turn')
    on conflict do nothing;
  select count(*) into n from notification_log;
  assert n = 1, format('EXPECTED one log row, got %s', n);

  begin
    insert into notification_log (instance_id, user_id, kind)
      values ('f0000000-1111-1111-1111-111111111111', 'f0000000-0000-0000-0000-000000000002', 'bogus');
    raise exception 'EXPECTED kind check to reject bogus';
  exception when check_violation then null;
  end;
  raise notice 'PASS: notification_log is once-only per instance/user/kind';
end $$;

-- Clients: a member of the connection can neither read nor write the log.
do $$
declare n int; blocked boolean := false;
begin
  set local role authenticated;
  set local "test.user_id" = 'f0000000-0000-0000-0000-000000000002';

  select count(*) into n from notification_log;
  assert n = 0, format('EXPECTED client to see 0 log rows, got %s', n);

  begin
    insert into notification_log (instance_id, user_id, kind)
      values ('f0000000-1111-1111-1111-111111111111', 'f0000000-0000-0000-0000-000000000002', 'revealed');
  exception when others then blocked := true;
  end;
  assert blocked, 'EXPECTED client insert into notification_log to be blocked';

  reset role;
  reset "test.user_id";
  raise notice 'PASS: notification_log is client-inaccessible';
end $$;

-- Deleting the instance cascades the log row.
do $$
declare n int;
begin
  delete from prompt_instances where id = 'f0000000-1111-1111-1111-111111111111';
  select count(*) into n from notification_log;
  assert n = 0, format('EXPECTED cascade to clear log rows, got %s', n);
  raise notice 'PASS: notification_log cascades with its instance';
end $$;

select 'ALL NOTIFICATION LOG TESTS PASSED' as result;
