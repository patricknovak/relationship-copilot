-- Migration 0037: only you can grant or revoke your Blueprint intake consent;
-- the other member can see that you did; outsiders see nothing.

grant all on all tables in schema public to authenticated, service_role;

insert into auth.users (id, email) values
  ('b3700000-0000-0000-0000-000000000001', 'bp1@example.com'),
  ('b3700000-0000-0000-0000-000000000002', 'bp2@example.com'),
  ('b3700000-0000-0000-0000-000000000099', 'bp-outsider@example.com');
insert into connections (id, type, status, created_by)
  values ('b3700000-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'romantic', 'active',
          'b3700000-0000-0000-0000-000000000001');
insert into connection_members (connection_id, user_id, role, joined_at) values
  ('b3700000-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'b3700000-0000-0000-0000-000000000002', 'member', now());

-- A opts in.
set role authenticated;
set "test.user_id" = 'b3700000-0000-0000-0000-000000000001';
insert into blueprint_intake_consent (connection_id, user_id)
  values ('b3700000-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'b3700000-0000-0000-0000-000000000001');
reset role;

do $$
declare n int;
begin
  -- B sees that A opted in, and cannot grant or revoke for A.
  set local role authenticated;
  set local "test.user_id" = 'b3700000-0000-0000-0000-000000000002';
  select count(*) into n from blueprint_intake_consent
   where connection_id = 'b3700000-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  assert n = 1, format('B should see A''s consent, saw %s', n);
  delete from blueprint_intake_consent
   where user_id = 'b3700000-0000-0000-0000-000000000001';
  begin
    insert into blueprint_intake_consent (connection_id, user_id)
      values ('b3700000-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'b3700000-0000-0000-0000-000000000001');
    assert false, 'B must not grant consent on A''s behalf';
  exception when insufficient_privilege or unique_violation then null;
  end;
  reset role;
  select count(*) into n from blueprint_intake_consent
   where user_id = 'b3700000-0000-0000-0000-000000000001';
  assert n = 1, 'B must not be able to revoke A''s consent';

  -- An outsider sees nothing and cannot opt into someone else's connection.
  set local role authenticated;
  set local "test.user_id" = 'b3700000-0000-0000-0000-000000000099';
  select count(*) into n from blueprint_intake_consent;
  assert n = 0, format('outsider saw %s consent rows', n);
  begin
    insert into blueprint_intake_consent (connection_id, user_id)
      values ('b3700000-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'b3700000-0000-0000-0000-000000000099');
    assert false, 'outsider must not opt into a connection they are not in';
  exception when insufficient_privilege then null;
  end;
  reset role;

  -- A revokes.
  set local role authenticated;
  set local "test.user_id" = 'b3700000-0000-0000-0000-000000000001';
  delete from blueprint_intake_consent
   where connection_id = 'b3700000-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
     and user_id = 'b3700000-0000-0000-0000-000000000001';
  reset role;
  select count(*) into n from blueprint_intake_consent;
  assert n = 0, 'A must be able to revoke their own consent';

  raise notice 'PASS: Blueprint intake consent is self-only, member-visible, revocable';
end $$;
