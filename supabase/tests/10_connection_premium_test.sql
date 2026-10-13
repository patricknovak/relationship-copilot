-- connection_has_premium (migration 0022): one paying member unlocks the
-- connection for both; strangers learn nothing; no payer → false.

insert into auth.users (id, email) values
  ('e0000000-0000-0000-0000-000000000001', 'payer@example.com'),
  ('e0000000-0000-0000-0000-000000000002', 'free@example.com'),
  ('e0000000-0000-0000-0000-000000000003', 'stranger@example.com'),
  ('e0000000-0000-0000-0000-000000000004', 'solo@example.com');

insert into connections (id, type, status, created_by) values
  ('e0000000-cccc-cccc-cccc-cccccccccccc', 'romantic', 'active',
   'e0000000-0000-0000-0000-000000000001'),
  ('e0000000-dddd-dddd-dddd-dddddddddddd', 'friend', 'active',
   'e0000000-0000-0000-0000-000000000004');
insert into connection_members (connection_id, user_id, role, joined_at) values
  ('e0000000-cccc-cccc-cccc-cccccccccccc','e0000000-0000-0000-0000-000000000002','member', now());

-- Nobody pays yet.
do $$
begin
  set local "test.user_id" = 'e0000000-0000-0000-0000-000000000002';
  assert not connection_has_premium('e0000000-cccc-cccc-cccc-cccccccccccc'),
    'EXPECTED false when no member is premium';
  reset "test.user_id";
end $$;

-- The creator subscribes.
insert into subscriptions (user_id, plan, status) values
  ('e0000000-0000-0000-0000-000000000001', 'premium', 'active');

do $$
begin
  -- The free partner is covered.
  set local "test.user_id" = 'e0000000-0000-0000-0000-000000000002';
  assert connection_has_premium('e0000000-cccc-cccc-cccc-cccccccccccc'),
    'EXPECTED the free member to be covered by the payer';
  assert not has_premium('e0000000-0000-0000-0000-000000000002'),
    'EXPECTED has_premium to stay per-user (free member is still free)';

  -- The payer is covered too.
  set local "test.user_id" = 'e0000000-0000-0000-0000-000000000001';
  assert connection_has_premium('e0000000-cccc-cccc-cccc-cccccccccccc'),
    'EXPECTED the payer to be covered';

  -- A stranger gets false, not the answer.
  set local "test.user_id" = 'e0000000-0000-0000-0000-000000000003';
  assert not connection_has_premium('e0000000-cccc-cccc-cccc-cccccccccccc'),
    'EXPECTED a non-member to get false';

  -- A connection with no premium member stays false for its own member.
  set local "test.user_id" = 'e0000000-0000-0000-0000-000000000004';
  assert not connection_has_premium('e0000000-dddd-dddd-dddd-dddddddddddd'),
    'EXPECTED an all-free connection to be false';

  reset "test.user_id";
  -- Service role (no auth.uid()) may ask about any connection.
  assert connection_has_premium('e0000000-cccc-cccc-cccc-cccccccccccc'),
    'EXPECTED service role to see the premium connection';
  raise notice 'PASS: connection_has_premium covers both members and nobody else';
end $$;

-- Cancellation (status past_due/canceled) withdraws coverage.
update subscriptions set status = 'canceled'
 where user_id = 'e0000000-0000-0000-0000-000000000001';
do $$
begin
  set local "test.user_id" = 'e0000000-0000-0000-0000-000000000002';
  assert not connection_has_premium('e0000000-cccc-cccc-cccc-cccccccccccc'),
    'EXPECTED coverage to end with the subscription';
  reset "test.user_id";
  raise notice 'PASS: coverage follows subscription status';
end $$;

select 'ALL CONNECTION PREMIUM TESTS PASSED' as result;
