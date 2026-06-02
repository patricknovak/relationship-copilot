-- Verifies daily-prompt generation is idempotent: one daily instance per
-- connection per day, no matter how many times the assigner runs.

insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'da@example.com'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'db@example.com');

insert into connections (id, type, status, created_by)
  values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'friend', 'active',
          'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
insert into connection_members (connection_id, user_id, role, joined_at) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','creator', now()),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','member',  now());

do $$
declare cnt int; first_id uuid; again_id uuid;
begin
  -- Run the assigner twice (as service-role: auth.uid() is null).
  perform assign_daily_prompts(date '2026-06-02');
  perform assign_daily_prompts(date '2026-06-02');

  select count(*) into cnt from prompt_instances
   where connection_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
     and kind = 'daily' and scheduled_for = '2026-06-02';
  assert cnt = 1, format('EXPECTED exactly 1 daily instance, got %s', cnt);

  -- ensure_daily_prompt is idempotent and returns the same row.
  first_id := ensure_daily_prompt('cccccccc-cccc-cccc-cccc-cccccccccccc', date '2026-06-02');
  again_id := ensure_daily_prompt('cccccccc-cccc-cccc-cccc-cccccccccccc', date '2026-06-02');
  assert first_id = again_id, 'ensure_daily_prompt returned different rows';

  -- A different day gets its own instance.
  perform ensure_daily_prompt('cccccccc-cccc-cccc-cccc-cccccccccccc', date '2026-06-03');
  select count(*) into cnt from prompt_instances
   where connection_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc' and kind = 'daily';
  assert cnt = 2, format('EXPECTED 2 daily instances across two days, got %s', cnt);

  raise notice 'PASS: daily prompt generation is idempotent per day';
end $$;

-- Membership is enforced for app callers (non-null auth.uid()).
do $$
declare blocked boolean := false;
begin
  set local "test.user_id" = '99999999-9999-9999-9999-999999999999';
  begin
    perform ensure_daily_prompt('cccccccc-cccc-cccc-cccc-cccccccccccc', date '2026-06-04');
  exception when others then blocked := true;
  end;
  reset "test.user_id";
  assert blocked, 'EXPECTED non-member to be blocked from ensure_daily_prompt';
  raise notice 'PASS: ensure_daily_prompt enforces membership for app callers';
end $$;

select 'ALL DAILY TESTS PASSED' as result;
