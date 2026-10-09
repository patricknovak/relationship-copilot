-- Retired invite codes (migration 0019): accept burns as 'used'; regenerate
-- retires the old code as 'regenerated'; clients cannot read or write the table.
-- Discriminant for the invite landing: used vs unknown must not collapse.

-- ---------------------------------------------------------------------------
-- Seed
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('b8000000-0000-0000-0000-000000000001', 'retire-creator@example.com'),
  ('b8000000-0000-0000-0000-000000000002', 'retire-partner@example.com'),
  ('b8000000-0000-0000-0000-000000000003', 'retire-stranger@example.com');

update profiles set display_name = 'RetireCreator'
 where id = 'b8000000-0000-0000-0000-000000000001';
update profiles set display_name = 'RetirePartner'
 where id = 'b8000000-0000-0000-0000-000000000002';

-- ---------------------------------------------------------------------------
-- accept_invite records the burned code as reason = 'used'
-- ---------------------------------------------------------------------------
insert into connections (id, type, status, created_by, invite_code, invite_expires_at)
  values ('c8000000-0000-0000-0000-000000000001', 'romantic', 'pending',
          'b8000000-0000-0000-0000-000000000001', 'USEDCODE',
          now() + interval '14 days');

do $$
declare
  cid uuid;
  r text;
  n int;
begin
  set local role authenticated;
  set local "test.user_id" = 'b8000000-0000-0000-0000-000000000002';
  cid := accept_invite('USEDCODE');
  reset role;

  assert cid = 'c8000000-0000-0000-0000-000000000001',
    'accept_invite returned wrong connection';

  select reason into r from retired_invite_codes where code = 'USEDCODE';
  assert r = 'used', format('EXPECTED reason used, got %s', r);

  select count(*) into n from connections
   where id = cid and invite_code is null;
  assert n = 1, 'EXPECTED invite_code cleared after accept';

  raise notice 'PASS: accept_invite retires code as used';
end $$;

-- ---------------------------------------------------------------------------
-- regenerate_invite retires the previous code as 'regenerated'
-- ---------------------------------------------------------------------------
insert into connections (id, type, status, created_by, invite_code, invite_expires_at)
  values ('c8000000-0000-0000-0000-000000000002', 'friend', 'pending',
          'b8000000-0000-0000-0000-000000000001', 'OLDINV01',
          now() - interval '1 day');

do $$
declare
  fresh text;
  r text;
  failed boolean := false;
begin
  set local role authenticated;
  set local "test.user_id" = 'b8000000-0000-0000-0000-000000000001';
  fresh := regenerate_invite('c8000000-0000-0000-0000-000000000002');
  reset role;

  assert fresh ~ '^[A-Z0-9]{8}$', format('EXPECTED fresh 8-char code, got %s', fresh);
  assert fresh <> 'OLDINV01', 'EXPECTED a different code after regenerate';

  select reason into r from retired_invite_codes ric where ric.code = 'OLDINV01';
  assert r = 'regenerated', format('EXPECTED reason regenerated, got %s', r);

  -- Old code is dead; new code works.
  set local role authenticated;
  set local "test.user_id" = 'b8000000-0000-0000-0000-000000000003';
  begin
    perform accept_invite('OLDINV01');
  exception when others then
    failed := true;
  end;
  assert failed, 'EXPECTED old regenerated code to be rejected';
  perform accept_invite(fresh);
  reset role;

  select reason into r from retired_invite_codes ric where ric.code = upper(fresh);
  assert r = 'used', format('EXPECTED new code retired as used, got %s', r);

  raise notice 'PASS: regenerate_invite retires old code as regenerated';
end $$;

-- ---------------------------------------------------------------------------
-- Clients (anon / authenticated) cannot read or write retired_invite_codes
-- ---------------------------------------------------------------------------
do $$
declare
  ok boolean;
  n int;
begin
  -- Anon: no SELECT
  ok := false;
  set local role anon;
  begin
    select count(*) into n from retired_invite_codes;
    -- If SELECT is allowed but RLS denies all rows, count is 0 — still a leak
    -- surface we revoke. Prefer privilege failure.
    if n = 0 then ok := true; end if;
  exception when insufficient_privilege then
    ok := true;
  when undefined_table then
    ok := true;
  end;
  reset role;
  assert ok, 'ANON must not freely read retired_invite_codes';

  -- Authenticated: RLS deny-all (or revoke) — no rows, no insert
  ok := false;
  set local role authenticated;
  set local "test.user_id" = 'b8000000-0000-0000-0000-000000000001';
  begin
    insert into retired_invite_codes (code, reason) values ('HACKED01', 'used');
  exception when insufficient_privilege then
    ok := true;
  when others then
    -- RLS with check false / policy deny
    ok := true;
  end;
  reset role;
  assert ok, 'AUTHENTICATED must not insert into retired_invite_codes';

  -- Confirm the hack row did not land (service-role / table owner can check)
  select count(*) into n from retired_invite_codes where code = 'HACKED01';
  assert n = 0, 'EXPECTED no client-written retired row';

  raise notice 'PASS: retired_invite_codes is client-inaccessible';
end $$;
