-- Migration 0042: a pair gets today's question as soon as both have joined
-- (status 'onboarding'), not only after the first 20 reveal. A connection
-- with one person in it never gets one, whatever its status.

insert into auth.users (id, email) values
  ('d2042000-0000-0000-0000-000000000001', 'dj-a@example.com'),
  ('d2042000-0000-0000-0000-000000000002', 'dj-b@example.com'),
  ('d2042000-0000-0000-0000-000000000003', 'dj-c@example.com');
update profiles set display_name = 'Ada',
       preferences = '{"notifications":{"daily_ready":true}}'
 where id = 'd2042000-0000-0000-0000-000000000001';
update profiles set preferences = '{"notifications":{"daily_ready":true}}'
 where id = 'd2042000-0000-0000-0000-000000000003';

insert into connections (id, type, status, created_by, timezone) values
  -- Both joined, first 20 still open.
  ('d2042000-aaaa-aaaa-aaaa-000000000001', 'sibling', 'onboarding', 'd2042000-0000-0000-0000-000000000001', 'UTC'),
  -- Marked onboarding but only the creator is in it (must never get a daily).
  ('d2042000-aaaa-aaaa-aaaa-000000000002', 'friend', 'onboarding', 'd2042000-0000-0000-0000-000000000003', 'UTC');
insert into connection_members (connection_id, user_id, role, joined_at) values
  ('d2042000-aaaa-aaaa-aaaa-000000000001', 'd2042000-0000-0000-0000-000000000002', 'member', now() - interval '1 hour');

do $$
declare
  n int;
  created int;
  h int := extract(hour from now() at time zone 'UTC');
begin
  select public.ensure_daily_prompts_in_window(h, h) into created;
  assert exists (
    select 1 from prompt_instances
     where connection_id = 'd2042000-aaaa-aaaa-aaaa-000000000001' and kind = 'daily'
       and scheduled_for = (now() at time zone 'UTC')::date
  ), 'expected today''s daily for a joined pair still on their first 20';
  assert not exists (
    select 1 from prompt_instances
     where connection_id = 'd2042000-aaaa-aaaa-aaaa-000000000002' and kind = 'daily'
  ), 'a connection with one joined member must not get a daily';

  -- The opted-in member of the joined pair is a reminder candidate; the
  -- solo creator is not.
  select count(*) into n from public.daily_reminder_candidates(h, h)
   where recipient_id = 'd2042000-0000-0000-0000-000000000001';
  assert n = 1, format('EXPECTED the joined member as a candidate, got %s', n);
  select count(*) into n from public.daily_reminder_candidates(h, h)
   where recipient_id = 'd2042000-0000-0000-0000-000000000003';
  assert n = 0, 'a solo member must not be reminded';

  -- The pg_cron assigner follows the same rule.
  delete from prompt_instances
   where connection_id in ('d2042000-aaaa-aaaa-aaaa-000000000001',
                           'd2042000-aaaa-aaaa-aaaa-000000000002');
  perform public.assign_daily_prompts();
  assert exists (
    select 1 from prompt_instances
     where connection_id = 'd2042000-aaaa-aaaa-aaaa-000000000001' and kind = 'daily'
  ), 'assign_daily_prompts must include joined pairs on their first 20';
  assert not exists (
    select 1 from prompt_instances
     where connection_id = 'd2042000-aaaa-aaaa-aaaa-000000000002'
  ), 'assign_daily_prompts must skip a connection with one member';

  -- The reveal gate is unchanged: one answer leaves the daily open.
  set local role authenticated;
  set local "test.user_id" = 'd2042000-0000-0000-0000-000000000001';
  insert into prompt_responses (instance_id, user_id, answers)
  select i.id, 'd2042000-0000-0000-0000-000000000001', '{"q1":"Mine"}'::jsonb
    from prompt_instances i
   where i.connection_id = 'd2042000-aaaa-aaaa-aaaa-000000000001' and i.kind = 'daily';
  reset role;
  assert exists (
    select 1 from prompt_instances
     where connection_id = 'd2042000-aaaa-aaaa-aaaa-000000000001' and kind = 'daily'
       and status = 'open'
  ), 'one answer must not reveal the daily';

  raise notice 'PASS: daily question from the day both people join';
end $$;
