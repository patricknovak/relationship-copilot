-- RLS membership + profile visibility tests (migration 0013).
-- Proves strangers cannot self-join or read private profile fields, that
-- responses cannot be added after reveal, and that the happy path still works.

-- ---------------------------------------------------------------------------
-- Seed users with private profile fields
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('a1000000-0000-0000-0000-000000000001', 'creator@example.com'),
  ('a1000000-0000-0000-0000-000000000002', 'partner@example.com'),
  ('a1000000-0000-0000-0000-000000000003', 'stranger@example.com');

update profiles
   set display_name = 'Creator',
       birthday = '1990-04-15',
       birth_time = '08:30',
       birth_place = 'Secret City',
       intake = '{"goals":"private-goals"}'::jsonb,
       preferences = '{"theme":"secret"}'::jsonb
 where id = 'a1000000-0000-0000-0000-000000000001';
update profiles
   set display_name = 'Partner',
       birthday = '1992-09-01',
       intake = '{"goals":"partner-goals"}'::jsonb
 where id = 'a1000000-0000-0000-0000-000000000002';
update profiles
   set display_name = 'Stranger',
       birthday = '1985-01-01',
       intake = '{"goals":"stranger-goals"}'::jsonb
 where id = 'a1000000-0000-0000-0000-000000000003';

-- ---------------------------------------------------------------------------
-- Happy path: create connection (as creator) → invite → accept → answer → reveal
-- ---------------------------------------------------------------------------
do $$
declare
  cid uuid;
  code text;
  exp timestamptz;
  iid uuid;
  n int;
  st text;
  pname text;
  birthday_leak int;
  intake_leak int;
  compat jsonb;
begin
  -- Creator inserts a connection; trigger adds their membership + invite expiry.
  set local role authenticated;
  set local "test.user_id" = 'a1000000-0000-0000-0000-000000000001';
  insert into connections (type, status, created_by, invite_code)
    values ('romantic', 'pending', 'a1000000-0000-0000-0000-000000000001', 'HAPPY001')
    returning id into cid;
  reset role;

  select invite_code, invite_expires_at into code, exp from connections where id = cid;
  assert code = 'HAPPY001', 'EXPECTED invite code preserved';
  assert exp is not null and exp > now(), 'EXPECTED invite_expires_at set on create';
  select count(*) into n from connection_members where connection_id = cid;
  assert n = 1, format('EXPECTED creator auto-membership, got %s', n);

  -- Partner accepts via RPC.
  set local role authenticated;
  set local "test.user_id" = 'a1000000-0000-0000-0000-000000000002';
  perform accept_invite('HAPPY001');
  reset role;

  select count(*) into n from connection_members where connection_id = cid;
  assert n = 2, format('EXPECTED 2 members after accept, got %s', n);
  select invite_code into code from connections where id = cid;
  assert code is null, 'EXPECTED invite burned after accept';

  -- Used invite rejected.
  begin
    set local role authenticated;
    set local "test.user_id" = 'a1000000-0000-0000-0000-000000000003';
    perform accept_invite('HAPPY001');
    reset role;
    raise exception 'EXPECTED used invite to fail';
  exception when others then
    reset role;
    if sqlerrm like '%EXPECTED used%' then raise; end if;
  end;

  -- Open instance + both answer → reveal.
  insert into prompt_instances (id, connection_id, kind, questions, status)
    values ('b1000000-0000-0000-0000-000000000001', cid, 'onboarding',
            '[{"id":"q1","text":"Hello?"}]'::jsonb, 'open');
  iid := 'b1000000-0000-0000-0000-000000000001';

  set local role authenticated;
  set local "test.user_id" = 'a1000000-0000-0000-0000-000000000001';
  insert into prompt_responses (instance_id, user_id, answers)
    values (iid, 'a1000000-0000-0000-0000-000000000001', '{"q1":"hi"}'::jsonb);
  reset role;

  -- Partner cannot read creator response before answering.
  set local role authenticated;
  set local "test.user_id" = 'a1000000-0000-0000-0000-000000000002';
  select count(*) into n from prompt_responses where instance_id = iid;
  assert n = 0, format('REVEAL LEAK before partner answered: %s', n);
  reset role;

  set local role authenticated;
  set local "test.user_id" = 'a1000000-0000-0000-0000-000000000002';
  insert into prompt_responses (instance_id, user_id, answers)
    values (iid, 'a1000000-0000-0000-0000-000000000002', '{"q1":"hey"}'::jsonb);
  reset role;

  select status into st from prompt_instances where id = iid;
  assert st = 'revealed', format('EXPECTED revealed, got %s', st);

  set local role authenticated;
  set local "test.user_id" = 'a1000000-0000-0000-0000-000000000002';
  select count(*) into n from prompt_responses where instance_id = iid;
  assert n = 2, format('EXPECTED both responses after reveal, got %s', n);

  -- Partner sees display name via partner_profiles, not private columns.
  select display_name into pname from partner_profiles
   where id = 'a1000000-0000-0000-0000-000000000001';
  assert pname = 'Creator', format('EXPECTED Creator display name, got %s', pname);

  select count(*) into birthday_leak from profiles
   where id = 'a1000000-0000-0000-0000-000000000001' and birthday is not null;
  assert birthday_leak = 0, 'PARTNER must not read creator birthday via profiles';

  select count(*) into intake_leak from profiles
   where id = 'a1000000-0000-0000-0000-000000000001'
     and intake ? 'goals';
  assert intake_leak = 0, 'PARTNER must not read creator intake via profiles';

  select connection_zodiac_compat(cid) into compat;
  assert compat is not null and compat ? 'blurb', 'EXPECTED zodiac compat payload for members';
  reset role;

  raise notice 'PASS: happy path create → invite → accept → answer → reveal';
end $$;

-- ---------------------------------------------------------------------------
-- Stranger cannot self-join a connection
-- ---------------------------------------------------------------------------
do $$
declare
  ok boolean := false;
  cid uuid := 'c1000000-0000-0000-0000-000000000001';
begin
  insert into connections (id, type, status, created_by, invite_code, invite_expires_at)
    values (cid, 'friend', 'pending',
            'a1000000-0000-0000-0000-000000000001', 'SOLOCODE',
            now() + interval '14 days');

  set local role authenticated;
  set local "test.user_id" = 'a1000000-0000-0000-0000-000000000003';
  begin
    insert into connection_members (connection_id, user_id, role, joined_at)
      values (cid, 'a1000000-0000-0000-0000-000000000003', 'member', now());
  exception when others then
    ok := true;
  end;
  reset role;
  assert ok, 'EXPECTED stranger self-join insert to be denied';
  raise notice 'PASS: stranger cannot self-join via connection_members insert';
end $$;

-- ---------------------------------------------------------------------------
-- Stranger cannot read another user's private profile fields
-- ---------------------------------------------------------------------------
do $$
declare n int;
begin
  set local role authenticated;
  set local "test.user_id" = 'a1000000-0000-0000-0000-000000000003';

  select count(*) into n from profiles
   where id = 'a1000000-0000-0000-0000-000000000001';
  assert n = 0, 'STRANGER must not read creator profile row';

  select count(*) into n from partner_profiles
   where id = 'a1000000-0000-0000-0000-000000000001';
  assert n = 0, 'STRANGER must not see creator in partner_profiles';

  -- Own full profile still readable.
  select count(*) into n from profiles
   where id = 'a1000000-0000-0000-0000-000000000003' and birthday is not null;
  assert n = 1, 'EXPECTED stranger to read own birthday';

  reset role;
  raise notice 'PASS: stranger cannot read others'' private profile fields';
end $$;

-- ---------------------------------------------------------------------------
-- Cannot answer a revealed prompt; cannot change invite_code as a member
-- ---------------------------------------------------------------------------
do $$
declare
  cid uuid := 'd1000000-0000-0000-0000-000000000001';
  iid uuid := 'd1000000-0000-0000-0000-000000000002';
  ok boolean := false;
  n int;
begin
  insert into connections (id, type, status, created_by)
    values (cid, 'friend', 'active', 'a1000000-0000-0000-0000-000000000001');
  insert into connection_members (connection_id, user_id, role, joined_at)
    values (cid, 'a1000000-0000-0000-0000-000000000002', 'member', now());
  insert into prompt_instances (id, connection_id, kind, questions, status, revealed_at)
    values (iid, cid, 'daily',
            '[{"id":"q1","text":"?"}]'::jsonb, 'revealed', now());

  set local role authenticated;
  set local "test.user_id" = 'a1000000-0000-0000-0000-000000000003';
  -- Stranger answering should fail (not a member / not open for them).
  begin
    insert into prompt_responses (instance_id, user_id, answers)
      values (iid, 'a1000000-0000-0000-0000-000000000003', '{"q1":"nope"}'::jsonb);
  exception when others then
    ok := true;
  end;
  assert ok, 'EXPECTED stranger insert on revealed instance to fail';
  ok := false;

  set local "test.user_id" = 'a1000000-0000-0000-0000-000000000001';
  begin
    insert into prompt_responses (instance_id, user_id, answers)
      values (iid, 'a1000000-0000-0000-0000-000000000001', '{"q1":"late"}'::jsonb);
  exception when others then
    ok := true;
  end;
  -- If no exception, RLS WITH CHECK may silently block (0 rows) — count instead.
  select count(*) into n from prompt_responses where instance_id = iid;
  reset role;
  assert ok or n = 0, 'EXPECTED no response insert on revealed instance';

  -- Member cannot rewrite invite_code.
  ok := false;
  set local role authenticated;
  set local "test.user_id" = 'a1000000-0000-0000-0000-000000000001';
  begin
    update connections set invite_code = 'HACKED001' where id = cid;
  exception when others then
    ok := true;
  end;
  reset role;
  assert ok, 'EXPECTED invite_code update to be blocked';
  raise notice 'PASS: revealed responses locked; invite_code protected';
end $$;

-- ---------------------------------------------------------------------------
-- Expired invite rejected
-- ---------------------------------------------------------------------------
do $$
declare
  ok boolean := false;
begin
  insert into connections (id, type, status, created_by, invite_code, invite_expires_at)
    values ('e1000000-0000-0000-0000-000000000001', 'friend', 'pending',
            'a1000000-0000-0000-0000-000000000001', 'EXPIRED1',
            now() - interval '1 hour');

  set local role authenticated;
  set local "test.user_id" = 'a1000000-0000-0000-0000-000000000002';
  begin
    perform accept_invite('EXPIRED1');
  exception when others then
    ok := true;
  end;
  reset role;
  assert ok, 'EXPECTED expired invite to be rejected';
  raise notice 'PASS: expired invite rejected';
end $$;

select 'ALL MEMBERSHIP/PROFILE RLS TESTS PASSED' as result;
