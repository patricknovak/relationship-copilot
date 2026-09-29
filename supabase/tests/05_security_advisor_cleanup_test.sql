-- Security-advisor cleanup tests (migration 0016).
-- Partner profile reads stay limited to safe display fields; write path through
-- partner_profiles is gone; stripe_events is client-inaccessible; revoked
-- functions are not callable by anon; zodiac compat still works for members.

-- ---------------------------------------------------------------------------
-- Seed
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('a2000000-0000-0000-0000-000000000001', 'creator2@example.com'),
  ('a2000000-0000-0000-0000-000000000002', 'partner2@example.com'),
  ('a2000000-0000-0000-0000-000000000003', 'stranger2@example.com'),
  ('a2000000-0000-0000-0000-000000000004', 'pending2@example.com');

update profiles
   set display_name = 'CreatorTwo',
       username = 'creator_two',
       avatar_url = 'https://example.com/c.png',
       birthday = '1990-04-15',
       birth_time = '08:30',
       birth_place = 'Secret City',
       intake = '{"goals":"private-goals"}'::jsonb,
       preferences = '{"theme":"secret"}'::jsonb
 where id = 'a2000000-0000-0000-0000-000000000001';
update profiles
   set display_name = 'PartnerTwo',
       username = 'partner_two',
       birthday = '1992-09-01'
 where id = 'a2000000-0000-0000-0000-000000000002';
update profiles
   set display_name = 'StrangerTwo',
       birthday = '1985-01-01'
 where id = 'a2000000-0000-0000-0000-000000000003';
update profiles
   set display_name = 'PendingTwo',
       birthday = '1988-06-01'
 where id = 'a2000000-0000-0000-0000-000000000004';

-- Test 01 opens with `grant all on all tables … to authenticated`, which
-- re-applies write privileges onto partner_profiles / stripe_events. Re-assert
-- the 0016 ACLs so this file validates the intended production grants.
revoke all on public.partner_profiles from public, anon, authenticated;
grant select on public.partner_profiles to authenticated, service_role;
revoke all on public.stripe_events from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Joined partners: safe fields only; private columns never via partner_profiles
-- ---------------------------------------------------------------------------
do $$
declare
  cid uuid := 'c2000000-0000-0000-0000-000000000001';
  n int;
  r record;
  compat jsonb;
  ok boolean;
begin
  insert into connections (id, type, status, created_by)
    values (cid, 'romantic', 'active', 'a2000000-0000-0000-0000-000000000001');
  -- Creator membership comes from trigger; add partner as joined.
  insert into connection_members (connection_id, user_id, role, joined_at)
    values (cid, 'a2000000-0000-0000-0000-000000000002', 'member', now());

  set local role authenticated;
  set local "test.user_id" = 'a2000000-0000-0000-0000-000000000002';

  select count(*) into n from partner_profiles
   where id = 'a2000000-0000-0000-0000-000000000001';
  assert n = 1, 'PARTNER must see joined co-member in partner_profiles';

  select * into r from partner_profiles
   where id = 'a2000000-0000-0000-0000-000000000001';
  assert r.display_name = 'CreatorTwo', 'EXPECTED display_name';
  assert r.username = 'creator_two', 'EXPECTED username';
  assert r.avatar_url = 'https://example.com/c.png', 'EXPECTED avatar_url';

  -- View exposes only the four safe columns (no birthday/intake/etc.).
  begin
    execute 'select birthday from partner_profiles limit 1';
    raise exception 'EXPECTED partner_profiles to lack birthday column';
  exception when undefined_column then
    null;
  end;

  select connection_zodiac_compat(cid) into compat;
  assert compat is not null and compat ? 'blurb' and compat ? 'level' and compat ? 'signs',
    'EXPECTED zodiac compat payload for joined members';

  reset role;

  -- Non-member gets nothing from partner_profiles and null zodiac.
  set local role authenticated;
  set local "test.user_id" = 'a2000000-0000-0000-0000-000000000003';
  select count(*) into n from partner_profiles
   where id = 'a2000000-0000-0000-0000-000000000001';
  assert n = 0, 'STRANGER must not see creator in partner_profiles';

  select connection_zodiac_compat(cid) into compat;
  assert compat is null, 'EXPECTED null zodiac compat for non-member';
  reset role;

  raise notice 'PASS: joined partner sees safe fields; stranger sees nothing';
end $$;

-- ---------------------------------------------------------------------------
-- Invited-but-not-joined (joined_at null) sees nothing / is not visible
-- ---------------------------------------------------------------------------
do $$
declare
  cid uuid := 'c2000000-0000-0000-0000-000000000002';
  n int;
begin
  insert into connections (id, type, status, created_by, invite_code, invite_expires_at)
    values (cid, 'friend', 'pending',
            'a2000000-0000-0000-0000-000000000001', 'PENDCODE',
            now() + interval '14 days');
  -- Pending invitee row without joined_at (historical / edge shape).
  insert into connection_members (connection_id, user_id, role, joined_at)
    values (cid, 'a2000000-0000-0000-0000-000000000004', 'member', null);

  set local role authenticated;
  set local "test.user_id" = 'a2000000-0000-0000-0000-000000000004';
  select count(*) into n from partner_profiles
   where id = 'a2000000-0000-0000-0000-000000000001';
  assert n = 0, 'PENDING (joined_at null) must not see creator via partner_profiles';
  reset role;

  set local role authenticated;
  set local "test.user_id" = 'a2000000-0000-0000-0000-000000000001';
  select count(*) into n from partner_profiles
   where id = 'a2000000-0000-0000-0000-000000000004';
  assert n = 0, 'Creator must not see pending invitee (joined_at null) via partner_profiles';
  reset role;

  raise notice 'PASS: invited-but-not-joined cannot use partner_profiles';
end $$;

-- ---------------------------------------------------------------------------
-- Anon: no SELECT on partner_profiles; cannot execute revoked RPCs
-- ---------------------------------------------------------------------------
do $$
declare
  n int;
  ok boolean := false;
begin
  set local role anon;
  set local "test.user_id" = '';

  begin
    select count(*) into n from partner_profiles;
  exception when insufficient_privilege then
    ok := true;
  when others then
    if sqlerrm ilike '%permission denied%' then ok := true; else raise; end if;
  end;
  assert ok, 'ANON must not SELECT partner_profiles';
  ok := false;

  begin
    perform public.accept_invite('NOPE');
  exception when insufficient_privilege then
    ok := true;
  when others then
    -- permission denied for function also surfaces as insufficient_privilege
    -- or a generic privilege error depending on PG version.
    if sqlerrm ilike '%permission denied%' or sqlerrm ilike '%must be owner%' then
      ok := true;
    else
      raise;
    end if;
  end;
  assert ok, 'ANON must not EXECUTE accept_invite';
  ok := false;

  begin
    perform public.has_premium('a2000000-0000-0000-0000-000000000001');
  exception when insufficient_privilege then
    ok := true;
  when others then
    if sqlerrm ilike '%permission denied%' then ok := true; else raise; end if;
  end;
  assert ok, 'ANON must not EXECUTE has_premium';
  ok := false;

  begin
    perform public.partner_profile_rows();
  exception when insufficient_privilege then
    ok := true;
  when others then
    if sqlerrm ilike '%permission denied%' then ok := true; else raise; end if;
  end;
  assert ok, 'ANON must not EXECUTE partner_profile_rows';
  ok := false;

  begin
    perform public.response_has_content('{"a":"x"}'::jsonb);
  exception when insufficient_privilege then
    ok := true;
  when others then
    if sqlerrm ilike '%permission denied%' then ok := true; else raise; end if;
  end;
  assert ok, 'ANON must not EXECUTE response_has_content';

  reset role;
  raise notice 'PASS: anon cannot select partner_profiles or call revoked functions';
end $$;

-- ---------------------------------------------------------------------------
-- No write path through partner_profiles (insert / update / delete)
-- ---------------------------------------------------------------------------
do $$
declare
  ok boolean;
  n int;
  before_name text;
begin
  select display_name into before_name from profiles
   where id = 'a2000000-0000-0000-0000-000000000001';

  set local role authenticated;
  set local "test.user_id" = 'a2000000-0000-0000-0000-000000000002';

  ok := false;
  begin
    insert into partner_profiles (id, display_name, avatar_url, username)
      values ('a2000000-0000-0000-0000-000000000099', 'Hacked', null, 'hacked');
  exception when others then
    ok := true;
  end;
  assert ok, 'EXPECTED insert into partner_profiles to fail';

  ok := false;
  begin
    update partner_profiles
       set display_name = 'HACKED'
     where id = 'a2000000-0000-0000-0000-000000000001';
  exception when others then
    ok := true;
  end;
  -- Non-updatable view may raise, or privilege revoke may raise, or 0-row update.
  select display_name into before_name from profiles
   where id = 'a2000000-0000-0000-0000-000000000001';
  -- Switch to a role that can read the underlying row for the assertion.
  reset role;
  select display_name into before_name from profiles
   where id = 'a2000000-0000-0000-0000-000000000001';
  assert before_name = 'CreatorTwo', 'EXPECTED creator display_name unchanged after update attempt';

  set local role authenticated;
  set local "test.user_id" = 'a2000000-0000-0000-0000-000000000002';
  ok := false;
  begin
    delete from partner_profiles
     where id = 'a2000000-0000-0000-0000-000000000001';
  exception when others then
    ok := true;
  end;
  reset role;
  select count(*) into n from profiles
   where id = 'a2000000-0000-0000-0000-000000000001';
  assert n = 1, 'EXPECTED creator profile row to survive delete-through-view attempt';

  -- Privilege check: authenticated must not hold write privileges on the view.
  assert not has_table_privilege('authenticated', 'public.partner_profiles', 'INSERT'),
    'EXPECTED authenticated to lack INSERT on partner_profiles';
  assert not has_table_privilege('authenticated', 'public.partner_profiles', 'UPDATE'),
    'EXPECTED authenticated to lack UPDATE on partner_profiles';
  assert not has_table_privilege('authenticated', 'public.partner_profiles', 'DELETE'),
    'EXPECTED authenticated to lack DELETE on partner_profiles';
  assert not has_table_privilege('authenticated', 'public.partner_profiles', 'TRUNCATE'),
    'EXPECTED authenticated to lack TRUNCATE on partner_profiles';
  assert has_table_privilege('authenticated', 'public.partner_profiles', 'SELECT'),
    'EXPECTED SELECT grant on partner_profiles for authenticated';

  -- View must not be auto-updatable.
  assert pg_relation_is_updatable('public.partner_profiles'::regclass, false) = 0,
    'EXPECTED partner_profiles to be non-updatable';

  raise notice 'PASS: no write path through partner_profiles';
end $$;

-- ---------------------------------------------------------------------------
-- stripe_events inaccessible to anon / authenticated
-- ---------------------------------------------------------------------------
do $$
declare
  ok boolean;
  n int;
begin
  insert into stripe_events (id, type) values ('evt_test_service', 'test.event');

  set local role authenticated;
  set local "test.user_id" = 'a2000000-0000-0000-0000-000000000001';

  ok := false;
  begin
    insert into stripe_events (id, type) values ('evt_test_auth', 'test.event');
  exception when others then
    ok := true;
  end;
  assert ok, 'EXPECTED authenticated insert into stripe_events to fail';

  ok := false;
  begin
    select count(*) into n from stripe_events;
    -- If SELECT were allowed, RLS deny policy must still hide rows.
    assert n = 0, 'EXPECTED authenticated to see zero stripe_events rows';
    ok := true; -- saw zero rows under RLS
  exception when insufficient_privilege then
    ok := true; -- revoke-all path
  when others then
    if sqlerrm ilike '%permission denied%' then ok := true; else raise; end if;
  end;
  assert ok, 'EXPECTED authenticated SELECT on stripe_events to be denied or empty';

  ok := false;
  begin
    delete from stripe_events where id = 'evt_test_service';
  exception when others then
    ok := true;
  end;
  reset role;
  select count(*) into n from stripe_events where id = 'evt_test_service';
  assert n = 1, 'EXPECTED service-inserted stripe_events row to survive client delete';

  set local role anon;
  set local "test.user_id" = '';
  begin
    select count(*) into n from stripe_events;
    -- If SELECT is somehow allowed, must still see zero via RLS deny.
    assert n = 0, 'EXPECTED anon to see zero stripe_events rows';
  exception when insufficient_privilege then
    null; -- revoke-all path: no SELECT privilege
  when others then
    if sqlerrm ilike '%permission denied%' then null; else raise; end if;
  end;
  ok := false;
  begin
    insert into stripe_events (id, type) values ('evt_test_anon', 'test.event');
  exception when others then
    ok := true;
  end;
  assert ok, 'EXPECTED anon insert into stripe_events to fail';
  reset role;

  assert not has_table_privilege('anon', 'public.stripe_events', 'SELECT'),
    'EXPECTED anon to lack SELECT on stripe_events';
  assert not has_table_privilege('anon', 'public.stripe_events', 'INSERT'),
    'EXPECTED anon to lack INSERT on stripe_events';
  assert not has_table_privilege('authenticated', 'public.stripe_events', 'SELECT'),
    'EXPECTED authenticated to lack SELECT on stripe_events';
  assert not has_table_privilege('authenticated', 'public.stripe_events', 'INSERT'),
    'EXPECTED authenticated to lack INSERT on stripe_events';

  raise notice 'PASS: stripe_events is inaccessible to anon/authenticated';
end $$;

select 'ALL SECURITY-ADVISOR CLEANUP TESTS PASSED' as result;
