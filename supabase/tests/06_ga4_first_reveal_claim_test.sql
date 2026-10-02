-- Once-only GA4 first-reveal claim under concurrent final submits.
-- Does not weaken the reveal gate; 01_reveal_gate_test.sql still owns that.

grant all on all tables in schema public to authenticated, service_role;
grant all on all sequences in schema public to authenticated, service_role;
grant execute on function public.claim_first_mutual_reveal_ga4(uuid)
  to authenticated, service_role;
-- Re-assert migration intent after the suite-wide grant (same pattern as 05).
revoke all on public.connection_first_reveal_ga4 from public, anon, authenticated;

-- Fresh pair + open onboarding instance.
insert into auth.users (id, email) values
  ('a7000000-0000-0000-0000-000000000001', 'ga4-a@example.com'),
  ('a7000000-0000-0000-0000-000000000002', 'ga4-b@example.com');

insert into connections (id, type, status, created_by, onboarding_done)
  values ('a7000000-0000-0000-0000-000000000010', 'friend', 'active',
          'a7000000-0000-0000-0000-000000000001', false);
insert into connection_members (connection_id, user_id, role, joined_at) values
  ('a7000000-0000-0000-0000-000000000010',
   'a7000000-0000-0000-0000-000000000002', 'member', now());

insert into prompt_instances (id, connection_id, kind, questions, status)
  values ('a7000000-0000-0000-0000-000000000020',
          'a7000000-0000-0000-0000-000000000010', 'onboarding',
          '[{"id":"q1","text":"What matters?"}]'::jsonb, 'open');

-- Both answer → reveal (same path as production concurrent final submits).
set role authenticated;
set "test.user_id" = 'a7000000-0000-0000-0000-000000000001';
insert into prompt_responses (instance_id, user_id, answers)
  values ('a7000000-0000-0000-0000-000000000020',
          'a7000000-0000-0000-0000-000000000001', '{"q1":"trust"}'::jsonb);
reset role;

set role authenticated;
set "test.user_id" = 'a7000000-0000-0000-0000-000000000002';
insert into prompt_responses (instance_id, user_id, answers)
  values ('a7000000-0000-0000-0000-000000000020',
          'a7000000-0000-0000-0000-000000000002', '{"q1":"care"}'::jsonb);
reset role;

do $$
declare st text;
begin
  select status into st from prompt_instances
   where id = 'a7000000-0000-0000-0000-000000000020';
  assert st = 'revealed', format('EXPECTED revealed after both answered, got %s', st);
  raise notice 'PASS: instance revealed for GA4 claim fixture';
end $$;

-- Simulate both partners' submitResponse seeing revealed and claiming:
-- only one claim wins.
do $$
declare
  a_won boolean;
  b_won boolean;
  n int;
begin
  set local role authenticated;
  set local "test.user_id" = 'a7000000-0000-0000-0000-000000000001';
  select public.claim_first_mutual_reveal_ga4(
    'a7000000-0000-0000-0000-000000000010'
  ) into a_won;
  reset role;

  set local role authenticated;
  set local "test.user_id" = 'a7000000-0000-0000-0000-000000000002';
  select public.claim_first_mutual_reveal_ga4(
    'a7000000-0000-0000-0000-000000000010'
  ) into b_won;
  reset role;

  assert (a_won and not b_won) or (b_won and not a_won),
    format('EXPECTED exactly one claim winner, got a=%s b=%s', a_won, b_won);

  select count(*) into n from connection_first_reveal_ga4
   where connection_id = 'a7000000-0000-0000-0000-000000000010';
  assert n = 1, format('EXPECTED one marker row, got %s', n);

  -- Repeat claim (same as a second submit after reveal) stays false.
  set local role authenticated;
  set local "test.user_id" = 'a7000000-0000-0000-0000-000000000001';
  select public.claim_first_mutual_reveal_ga4(
    'a7000000-0000-0000-0000-000000000010'
  ) into a_won;
  reset role;
  assert a_won is false, 'EXPECTED repeat claim to be false';

  raise notice 'PASS: concurrent first-reveal claims are once-only';
end $$;

-- Second revealed instance on the same connection must not claim again.
insert into prompt_instances (id, connection_id, kind, questions, status, revealed_at)
  values ('a7000000-0000-0000-0000-000000000021',
          'a7000000-0000-0000-0000-000000000010', 'daily',
          '[{"id":"q1","text":"Today?"}]'::jsonb, 'revealed', now());

do $$
declare won boolean;
begin
  -- Clear the marker to prove the count=1 guard (not only the PK) blocks
  -- non-first reveals.
  delete from connection_first_reveal_ga4
   where connection_id = 'a7000000-0000-0000-0000-000000000010';

  set local role authenticated;
  set local "test.user_id" = 'a7000000-0000-0000-0000-000000000001';
  select public.claim_first_mutual_reveal_ga4(
    'a7000000-0000-0000-0000-000000000010'
  ) into won;
  reset role;

  assert won is false,
    'EXPECTED claim false when more than one revealed instance exists';
  raise notice 'PASS: non-first reveal cannot claim GA4 marker';
end $$;

-- Non-member cannot claim.
insert into auth.users (id, email)
  values ('a7000000-0000-0000-0000-000000000099', 'ga4-outsider@example.com');

do $$
declare won boolean;
begin
  set local role authenticated;
  set local "test.user_id" = 'a7000000-0000-0000-0000-000000000099';
  select public.claim_first_mutual_reveal_ga4(
    'a7000000-0000-0000-0000-000000000010'
  ) into won;
  reset role;
  assert won is false, 'EXPECTED non-member claim to be false';
  raise notice 'PASS: non-member cannot claim first-reveal GA4 marker';
end $$;

-- Clients cannot DML the marker table directly (revoke + deny policy).
do $$
declare
  ok boolean;
  n int;
begin
  insert into connection_first_reveal_ga4 (connection_id)
    values ('a7000000-0000-0000-0000-000000000010')
    on conflict do nothing;

  set local role authenticated;
  set local "test.user_id" = 'a7000000-0000-0000-0000-000000000001';

  ok := false;
  begin
    insert into connection_first_reveal_ga4 (connection_id)
      values ('a7000000-0000-0000-0000-000000000010');
  exception when others then
    ok := true;
  end;
  assert ok, 'EXPECTED authenticated insert into connection_first_reveal_ga4 to fail';

  ok := false;
  begin
    select count(*) into n from connection_first_reveal_ga4;
    assert n = 0, 'EXPECTED authenticated to see zero claim rows';
    ok := true;
  exception when insufficient_privilege then
    ok := true;
  when others then
    if sqlerrm ilike '%permission denied%' then ok := true; else raise; end if;
  end;
  assert ok, 'EXPECTED authenticated SELECT on claim table denied or empty';
  reset role;

  assert not has_table_privilege(
    'authenticated', 'public.connection_first_reveal_ga4', 'INSERT'),
    'EXPECTED authenticated to lack INSERT on connection_first_reveal_ga4';
  assert not has_table_privilege(
    'authenticated', 'public.connection_first_reveal_ga4', 'SELECT'),
    'EXPECTED authenticated to lack SELECT on connection_first_reveal_ga4';

  raise notice 'PASS: claim table is client-inaccessible';
end $$;

-- Reveal gate still closed to partner before they answer (sanity on this fixture
-- pattern is covered by 01; here we only assert marker never leaked answers).
select 'ALL GA4 FIRST-REVEAL CLAIM TESTS PASSED' as result;
