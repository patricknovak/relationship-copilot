-- Migration 0043: one free Blueprint per connection. The primary key makes it
-- once-only; members can see the claim; clients cannot write it.

insert into auth.users (id, email) values
  ('f2043000-0000-0000-0000-000000000001', 'fb-a@example.com'),
  ('f2043000-0000-0000-0000-000000000002', 'fb-b@example.com'),
  ('f2043000-0000-0000-0000-000000000099', 'fb-out@example.com');
insert into connections (id, type, status, created_by)
  values ('f2043000-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'friend', 'active',
          'f2043000-0000-0000-0000-000000000001');
insert into connection_members (connection_id, user_id, role, joined_at) values
  ('f2043000-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'f2043000-0000-0000-0000-000000000002', 'member', now());

do $$
declare n int;
begin
  -- Members cannot claim it themselves.
  set local role authenticated;
  set local "test.user_id" = 'f2043000-0000-0000-0000-000000000001';
  begin
    insert into free_blueprint_claims (connection_id, claimed_by)
      values ('f2043000-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'f2043000-0000-0000-0000-000000000001');
    assert false, 'a member must not write a free Blueprint claim directly';
  exception when insufficient_privilege then null;
  end;
  reset role;

  -- The server claims once; a second claim for the same connection fails.
  set local role service_role;
  insert into free_blueprint_claims (connection_id, claimed_by)
    values ('f2043000-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'f2043000-0000-0000-0000-000000000001');
  begin
    insert into free_blueprint_claims (connection_id, claimed_by)
      values ('f2043000-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'f2043000-0000-0000-0000-000000000002');
    assert false, 'a connection must get only one free Blueprint';
  exception when unique_violation then null;
  end;
  reset role;

  -- Both members see it; an outsider sees nothing.
  set local role authenticated;
  set local "test.user_id" = 'f2043000-0000-0000-0000-000000000002';
  select count(*) into n from free_blueprint_claims
   where connection_id = 'f2043000-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  assert n = 1, format('the other member should see the claim, saw %s', n);
  begin
    delete from free_blueprint_claims;
    get diagnostics n = row_count;
    assert n = 0, 'a member must not be able to reset the claim';
  exception when insufficient_privilege then null;
  end;
  set local "test.user_id" = 'f2043000-0000-0000-0000-000000000099';
  select count(*) into n from free_blueprint_claims;
  assert n = 0, format('outsider saw %s claims', n);
  reset role;

  raise notice 'PASS: free Blueprint is once per connection, server-written, member-visible';
end $$;
