-- Migration 0034: push subscriptions are written only through the RPCs, each
-- person touches only their own device rows, and rows cascade with the user.

insert into auth.users (id, email) values
  ('a1800000-0000-0000-0000-000000000001', 'push1@example.com'),
  ('a1800000-0000-0000-0000-000000000002', 'push2@example.com');

-- Valid-length key material (base64url of a 65-byte key and 16-byte secret).
\set p256dh '''BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4'''
\set auth '''BTBZMqHH6r4Tts7J_aSIgg'''

-- A saves a device.
set role authenticated;
set "test.user_id" = 'a1800000-0000-0000-0000-000000000001';
select public.save_push_subscription('https://fcm.googleapis.com/fcm/send/dev1', :p256dh, :auth);
reset role;

do $$
declare n int;
begin
  -- Clients cannot read or write the table directly.
  set local role authenticated;
  set local "test.user_id" = 'a1800000-0000-0000-0000-000000000001';
  -- Denied either by privileges (production) or by the restrictive policy
  -- (earlier test files grant all tables to the test role).
  begin
    select count(*) into n from public.push_subscriptions;
    assert n = 0, format('authenticated saw %s push_subscriptions rows', n);
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.push_subscriptions (endpoint, user_id, p256dh, auth)
    values ('https://fcm.googleapis.com/fcm/send/x', 'a1800000-0000-0000-0000-000000000001',
            repeat('A', 87), repeat('A', 22));
    assert false, 'authenticated must not insert push_subscriptions';
  exception when insufficient_privilege then null;
  end;
  reset role;

  select count(*) into n from public.push_subscriptions
   where user_id = 'a1800000-0000-0000-0000-000000000001';
  assert n = 1, format('EXPECTED 1 device for A, got %s', n);
  raise notice 'PASS: RPC saves the device; direct table access is denied';
end $$;

-- B cannot delete A's device; B subscribing on the same browser takes it over.
set role authenticated;
set "test.user_id" = 'a1800000-0000-0000-0000-000000000002';
select public.delete_push_subscription('https://fcm.googleapis.com/fcm/send/dev1');
reset role;

do $$
declare owner uuid;
begin
  select user_id into owner from public.push_subscriptions
   where endpoint = 'https://fcm.googleapis.com/fcm/send/dev1';
  assert owner = 'a1800000-0000-0000-0000-000000000001',
    'B must not be able to delete A''s device';
  raise notice 'PASS: delete only touches your own rows';
end $$;

set role authenticated;
set "test.user_id" = 'a1800000-0000-0000-0000-000000000002';
select public.save_push_subscription('https://fcm.googleapis.com/fcm/send/dev1', :p256dh, :auth);
reset role;

do $$
declare owner uuid;
begin
  select user_id into owner from public.push_subscriptions
   where endpoint = 'https://fcm.googleapis.com/fcm/send/dev1';
  assert owner = 'a1800000-0000-0000-0000-000000000002',
    'the endpoint should follow whoever subscribed on the device last';
  raise notice 'PASS: a shared device follows the latest subscriber';
end $$;

-- At most 10 devices per person.
set role authenticated;
set "test.user_id" = 'a1800000-0000-0000-0000-000000000001';
select public.save_push_subscription('https://fcm.googleapis.com/fcm/send/many' || g, :p256dh, :auth)
  from generate_series(1, 12) g;
reset role;

do $$
declare n int;
begin
  select count(*) into n from public.push_subscriptions
   where user_id = 'a1800000-0000-0000-0000-000000000001';
  assert n = 10, format('EXPECTED 10 devices after 12 saves, got %s', n);

  -- Anonymous callers can't use the RPCs at all.
  begin
    set local role anon;
    perform public.save_push_subscription('https://fcm.googleapis.com/fcm/send/z', 'x', 'y');
    assert false, 'anon must not execute save_push_subscription';
  exception when insufficient_privilege then null;
  end;
  reset role;

  -- Rows cascade with the user (account deletion).
  delete from auth.users where id = 'a1800000-0000-0000-0000-000000000001';
  select count(*) into n from public.push_subscriptions
   where user_id = 'a1800000-0000-0000-0000-000000000001';
  assert n = 0, 'push rows must cascade with the auth user';
  raise notice 'PASS: device cap, anon denied, cascade on account deletion';
end $$;

select 'ALL PUSH SUBSCRIPTION TESTS PASSED' as result;
