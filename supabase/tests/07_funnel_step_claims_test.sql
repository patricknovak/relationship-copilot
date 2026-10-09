-- Once-only funnel step claims (invite_sent / partner_joined).
-- Does not weaken the reveal gate; 01_reveal_gate_test.sql still owns that.

grant all on all tables in schema public to authenticated, service_role;
grant all on all sequences in schema public to authenticated, service_role;
grant execute on function public.claim_funnel_step(uuid, text)
  to authenticated, service_role;
-- Re-assert migration intent after the suite-wide grant (same pattern as 05/06).
revoke all on public.connection_funnel_steps from public, anon, authenticated;

-- Creator alone (one joined member).
insert into auth.users (id, email) values
  ('a8000000-0000-0000-0000-000000000001', 'funnel-a@example.com'),
  ('a8000000-0000-0000-0000-000000000002', 'funnel-b@example.com'),
  ('a8000000-0000-0000-0000-000000000099', 'funnel-outsider@example.com');

insert into connections (id, type, status, created_by, onboarding_done)
  values ('a8000000-0000-0000-0000-000000000010', 'friend', 'pending',
          'a8000000-0000-0000-0000-000000000001', false);
-- Creator membership is normally added by trigger; insert explicitly for the
-- stubbed test DB when the trigger path is already exercised elsewhere.
insert into connection_members (connection_id, user_id, role, joined_at)
  values ('a8000000-0000-0000-0000-000000000010',
          'a8000000-0000-0000-0000-000000000001', 'creator', now())
  on conflict do nothing;

-- Solo creator can claim invite_sent once; partner_joined requires 2 members.
do $$
declare
  won boolean;
  n int;
begin
  set local role authenticated;
  set local "test.user_id" = 'a8000000-0000-0000-0000-000000000001';

  select public.claim_funnel_step(
    'a8000000-0000-0000-0000-000000000010', 'invite_sent'
  ) into won;
  assert won is true, 'EXPECTED first invite_sent claim to win';

  select public.claim_funnel_step(
    'a8000000-0000-0000-0000-000000000010', 'invite_sent'
  ) into won;
  assert won is false, 'EXPECTED repeat invite_sent claim to be false';

  select public.claim_funnel_step(
    'a8000000-0000-0000-0000-000000000010', 'partner_joined'
  ) into won;
  assert won is false,
    'EXPECTED partner_joined false with only one joined member';

  reset role;

  select count(*) into n from connection_funnel_steps
   where connection_id = 'a8000000-0000-0000-0000-000000000010'
     and step = 'invite_sent';
  assert n = 1, format('EXPECTED one invite_sent row, got %s', n);

  raise notice 'PASS: invite_sent once-only; partner_joined needs 2 members';
end $$;

-- Second member joins → partner_joined claimable once.
insert into connection_members (connection_id, user_id, role, joined_at)
  values ('a8000000-0000-0000-0000-000000000010',
          'a8000000-0000-0000-0000-000000000002', 'member', now());

do $$
declare
  a_won boolean;
  b_won boolean;
  n int;
begin
  set local role authenticated;
  set local "test.user_id" = 'a8000000-0000-0000-0000-000000000002';
  select public.claim_funnel_step(
    'a8000000-0000-0000-0000-000000000010', 'partner_joined'
  ) into a_won;
  reset role;

  set local role authenticated;
  set local "test.user_id" = 'a8000000-0000-0000-0000-000000000001';
  select public.claim_funnel_step(
    'a8000000-0000-0000-0000-000000000010', 'partner_joined'
  ) into b_won;
  reset role;

  assert (a_won and not b_won) or (b_won and not a_won),
    format('EXPECTED exactly one partner_joined winner, got a=%s b=%s', a_won, b_won);

  select count(*) into n from connection_funnel_steps
   where connection_id = 'a8000000-0000-0000-0000-000000000010'
     and step = 'partner_joined';
  assert n = 1, format('EXPECTED one partner_joined row, got %s', n);

  raise notice 'PASS: partner_joined once-only with two members';
end $$;

-- Non-member cannot claim.
do $$
declare won boolean;
begin
  set local role authenticated;
  set local "test.user_id" = 'a8000000-0000-0000-0000-000000000099';
  select public.claim_funnel_step(
    'a8000000-0000-0000-0000-000000000010', 'invite_sent'
  ) into won;
  reset role;
  assert won is false, 'EXPECTED non-member claim to be false';
  raise notice 'PASS: non-member cannot claim funnel step';
end $$;

-- Anon / null auth cannot claim.
do $$
declare won boolean;
begin
  -- No authenticated role / no test.user_id ⇒ auth.uid() null via stub.
  reset role;
  perform set_config('test.user_id', '', true);
  select public.claim_funnel_step(
    'a8000000-0000-0000-0000-000000000010', 'invite_sent'
  ) into won;
  assert won is false, 'EXPECTED anon/null auth claim to be false';
  raise notice 'PASS: anon/null auth cannot claim funnel step';
end $$;

-- Invalid step name is rejected.
do $$
declare won boolean;
begin
  set local role authenticated;
  set local "test.user_id" = 'a8000000-0000-0000-0000-000000000001';
  select public.claim_funnel_step(
    'a8000000-0000-0000-0000-000000000010', 'not_a_step'
  ) into won;
  reset role;
  assert won is false, 'EXPECTED invalid step to return false';
  raise notice 'PASS: invalid step rejected';
end $$;

-- Clients cannot DML the marker table directly.
do $$
declare
  ok boolean;
  n int;
begin
  set local role authenticated;
  set local "test.user_id" = 'a8000000-0000-0000-0000-000000000001';

  ok := false;
  begin
    insert into connection_funnel_steps (connection_id, step)
      values ('a8000000-0000-0000-0000-000000000010', 'invite_sent');
  exception when others then
    ok := true;
  end;
  assert ok, 'EXPECTED authenticated insert into connection_funnel_steps to fail';

  ok := false;
  begin
    select count(*) into n from connection_funnel_steps;
    assert n = 0, 'EXPECTED authenticated to see zero funnel rows';
    ok := true;
  exception when insufficient_privilege then
    ok := true;
  when others then
    if sqlerrm ilike '%permission denied%' then ok := true; else raise; end if;
  end;
  assert ok, 'EXPECTED authenticated SELECT on funnel table denied or empty';
  reset role;

  assert not has_table_privilege(
    'authenticated', 'public.connection_funnel_steps', 'INSERT'),
    'EXPECTED authenticated to lack INSERT on connection_funnel_steps';
  assert not has_table_privilege(
    'authenticated', 'public.connection_funnel_steps', 'SELECT'),
    'EXPECTED authenticated to lack SELECT on connection_funnel_steps';

  raise notice 'PASS: funnel claim table is client-inaccessible';
end $$;

select 'ALL FUNNEL STEP CLAIM TESTS PASSED' as result;
