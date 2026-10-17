-- Migration 0036: notification_log accepts turn_reminder, once per instance
-- per person, and still rejects unknown kinds.

insert into auth.users (id, email) values
  ('d2036000-0000-0000-0000-000000000001', 'turn1@example.com');
insert into connections (id, type, status, created_by)
  values ('d2036000-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'friend', 'active',
          'd2036000-0000-0000-0000-000000000001');
insert into prompt_instances (id, connection_id, kind, status, questions)
  values ('d2036000-1111-1111-1111-111111111111',
          'd2036000-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'quiz', 'open',
          '[{"id":"q1","text":"?"}]'::jsonb);

do $$
begin
  insert into notification_log (instance_id, user_id, kind)
    values ('d2036000-1111-1111-1111-111111111111',
            'd2036000-0000-0000-0000-000000000001', 'turn_reminder');
  begin
    insert into notification_log (instance_id, user_id, kind)
      values ('d2036000-1111-1111-1111-111111111111',
              'd2036000-0000-0000-0000-000000000001', 'turn_reminder');
    assert false, 'turn_reminder must be once per instance per person';
  exception when unique_violation then null;
  end;
  begin
    insert into notification_log (instance_id, user_id, kind)
      values ('d2036000-1111-1111-1111-111111111111',
              'd2036000-0000-0000-0000-000000000001', 'nag');
    assert false, 'unknown kinds must still be rejected';
  exception when check_violation then null;
  end;
  raise notice 'PASS: turn_reminder is a once-only notification kind';
end $$;
