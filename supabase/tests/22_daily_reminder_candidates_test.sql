-- Migration 0040: daily reminder selection in SQL. Candidates are exactly the
-- opted-in members of active two-person connections, inside their local
-- window, with today's daily open, who haven't answered or been reminded.

insert into auth.users (id, email) values
  ('d2040000-0000-0000-0000-000000000001', 'dr-a@example.com'),
  ('d2040000-0000-0000-0000-000000000002', 'dr-b@example.com'),
  ('d2040000-0000-0000-0000-000000000003', 'dr-c@example.com'),
  ('d2040000-0000-0000-0000-000000000004', 'dr-d@example.com');
update profiles set display_name = 'Ann',
       preferences = '{"notifications":{"daily_ready":true}}'
 where id = 'd2040000-0000-0000-0000-000000000001';
update profiles set display_name = 'Ben',
       preferences = '{"notifications":{"daily_ready":true}}'
 where id = 'd2040000-0000-0000-0000-000000000002';
-- C never opted in (default off); D opted in but their connection is pending.
update profiles set preferences = '{"notifications":{"daily_ready":true}}'
 where id = 'd2040000-0000-0000-0000-000000000004';

insert into connections (id, type, status, created_by, timezone) values
  ('d2040000-aaaa-aaaa-aaaa-000000000001', 'friend', 'active', 'd2040000-0000-0000-0000-000000000001', 'UTC'),
  ('d2040000-aaaa-aaaa-aaaa-000000000002', 'friend', 'pending', 'd2040000-0000-0000-0000-000000000003', 'UTC');
insert into connection_members (connection_id, user_id, role, joined_at) values
  ('d2040000-aaaa-aaaa-aaaa-000000000001', 'd2040000-0000-0000-0000-000000000002', 'member', now() - interval '30 days'),
  ('d2040000-aaaa-aaaa-aaaa-000000000002', 'd2040000-0000-0000-0000-000000000004', 'member', now() - interval '1 day');

do $$
declare
  n int;
  created int;
  rec record;
  h int := extract(hour from now() at time zone 'UTC');
begin
  -- Outside the window: nothing is created or selected.
  select public.ensure_daily_prompts_in_window(h + 2, h + 3) into created;
  assert created = 0, format('EXPECTED nothing created outside the window, got %s', created);
  select count(*) into n from public.daily_reminder_candidates(h + 2, h + 3)
   where recipient_id in (select id from auth.users where email like 'dr-%@example.com');
  assert n = 0, 'EXPECTED no candidates outside the window';

  -- Inside the window: today's daily is created for the active connection only
  -- (other tests' active connections share this database, so count ours).
  select public.ensure_daily_prompts_in_window(h, h) into created;
  assert created >= 1, format('EXPECTED at least one daily created, got %s', created);
  assert exists (
    select 1 from prompt_instances
     where connection_id = 'd2040000-aaaa-aaaa-aaaa-000000000001' and kind = 'daily'
       and scheduled_for = (now() at time zone 'UTC')::date
  ), 'expected today''s daily for the active connection';
  select public.ensure_daily_prompts_in_window(h, h) into created;
  assert created = 0, 'EXPECTED ensure to be idempotent';
  assert not exists (
    select 1 from prompt_instances where connection_id = 'd2040000-aaaa-aaaa-aaaa-000000000002'
  ), 'pending connections get no daily';

  -- Both opted-in members of the active connection are candidates.
  select count(*) into n from public.daily_reminder_candidates(h, h)
   where recipient_id in (select id from auth.users where email like 'dr-%@example.com');
  assert n = 2, format('EXPECTED 2 candidates, got %s', n);
  select * into rec from public.daily_reminder_candidates(h, h)
   where recipient_id = 'd2040000-0000-0000-0000-000000000002';
  assert rec.other_name = 'Ann', 'expected the other member''s display name';
  assert rec.question_text is not null and rec.question_text <> '', 'expected the template question';
  assert rec.timezone = 'UTC', 'expected the connection time zone';

  -- p_limit bounds the batch.
  select count(*) into n from public.daily_reminder_candidates(0, 23, 1);
  assert n = 1, 'EXPECTED p_limit to cap the batch';

  -- Opting out removes a person.
  update profiles set preferences = '{"notifications":{"daily_ready":false}}'
   where id = 'd2040000-0000-0000-0000-000000000002';
  select count(*) into n from public.daily_reminder_candidates(h, h)
   where recipient_id in (select id from auth.users where email like 'dr-%@example.com');
  assert n = 1, 'EXPECTED opt-out to remove Ben';
  update profiles set preferences = '{"notifications":{"daily_ready":true}}'
   where id = 'd2040000-0000-0000-0000-000000000002';

  -- Answering removes a person; a logged reminder removes a person.
  insert into prompt_responses (instance_id, user_id, answers)
    select id, 'd2040000-0000-0000-0000-000000000001', '{"q1":"x"}'
      from prompt_instances where connection_id = 'd2040000-aaaa-aaaa-aaaa-000000000001' and kind = 'daily';
  select count(*) into n from public.daily_reminder_candidates(h, h)
   where recipient_id in (select id from auth.users where email like 'dr-%@example.com');
  assert n = 1, 'EXPECTED the answerer to drop out';
  insert into notification_log (instance_id, user_id, kind)
    select id, 'd2040000-0000-0000-0000-000000000002', 'daily_ready'
      from prompt_instances where connection_id = 'd2040000-aaaa-aaaa-aaaa-000000000001' and kind = 'daily';
  select count(*) into n from public.daily_reminder_candidates(h, h)
   where recipient_id in (select id from auth.users where email like 'dr-%@example.com');
  assert n = 0, 'EXPECTED no candidates once reminded';

  -- Browsers can't call either function.
  begin
    set local role authenticated;
    perform public.daily_reminder_candidates();
    assert false, 'authenticated must not execute daily_reminder_candidates';
  exception when insufficient_privilege then null;
  end;
  reset role;
  begin
    set local role authenticated;
    perform public.ensure_daily_prompts_in_window();
    assert false, 'authenticated must not execute ensure_daily_prompts_in_window';
  exception when insufficient_privilege then null;
  end;
  reset role;

  raise notice 'PASS: daily reminder candidates (window, opt-in, answered, once-only, limit)';
end $$;

-- regenerate_invite now mints 12-character codes from the unambiguous alphabet.
do $$
declare
  fresh text;
begin
  -- A fresh pending connection with only its creator (the insert trigger adds them).
  insert into connections (id, type, status, created_by, timezone) values
    ('d2040000-aaaa-aaaa-aaaa-000000000003', 'friend', 'pending', 'd2040000-0000-0000-0000-000000000003', 'UTC');
  perform set_config('test.user_id', 'd2040000-0000-0000-0000-000000000003', true);
  fresh := public.regenerate_invite('d2040000-aaaa-aaaa-aaaa-000000000003');
  assert length(fresh) = 12, format('EXPECTED a 12-char code, got %s', fresh);
  assert fresh ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{12}$', format('unexpected alphabet in %s', fresh);
  perform set_config('test.user_id', '', true);
  raise notice 'PASS: regenerate_invite mints 12-char codes';
end $$;
