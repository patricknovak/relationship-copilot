-- Migration 0035: only the creator of a pending connection writes its invite
-- note; nobody else reads it through RLS; it cascades with the author.

grant all on all tables in schema public to authenticated, service_role;

insert into auth.users (id, email) values
  ('a1900000-0000-0000-0000-000000000001', 'note-creator@example.com'),
  ('a1900000-0000-0000-0000-000000000002', 'note-invitee@example.com'),
  ('a1900000-0000-0000-0000-000000000099', 'note-outsider@example.com');

insert into connections (id, type, status, created_by, invite_code, invite_expires_at)
  values ('a1900000-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'friend', 'pending',
          'a1900000-0000-0000-0000-000000000001', 'NOTE1900', now() + interval '14 days');

-- The creator writes a note through RLS.
set role authenticated;
set "test.user_id" = 'a1900000-0000-0000-0000-000000000001';
insert into invite_notes (connection_id, author_id, note)
  values ('a1900000-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          'a1900000-0000-0000-0000-000000000001', 'I miss our late-night talks.');
update invite_notes set note = 'I miss our talks.'
 where connection_id = 'a1900000-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
reset role;

do $$
declare n int;
begin
  -- An outsider can neither read nor write it.
  set local role authenticated;
  set local "test.user_id" = 'a1900000-0000-0000-0000-000000000099';
  select count(*) into n from invite_notes;
  assert n = 0, format('outsider read %s invite notes', n);
  begin
    insert into invite_notes (connection_id, author_id, note)
      values ('a1900000-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
              'a1900000-0000-0000-0000-000000000099', 'hijack');
    assert false, 'outsider must not write a note on someone else''s connection';
  exception when insufficient_privilege or unique_violation then null;
  end;
  reset role;
  raise notice 'PASS: creator writes; outsiders cannot read or write';
end $$;

-- The invitee joins; they still can't read the note through RLS (the invite
-- page shows it server-side while the code is valid), and the creator can no
-- longer change it once the connection has moved on.
set role authenticated;
set "test.user_id" = 'a1900000-0000-0000-0000-000000000002';
select public.accept_invite('NOTE1900');
reset role;

do $$
declare n int; t text;
begin
  set local role authenticated;
  set local "test.user_id" = 'a1900000-0000-0000-0000-000000000002';
  select count(*) into n from invite_notes;
  assert n = 0, format('invitee read %s notes through RLS', n);
  reset role;

  set local role authenticated;
  set local "test.user_id" = 'a1900000-0000-0000-0000-000000000001';
  begin
    update invite_notes set note = 'changed after join'
     where connection_id = 'a1900000-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    assert false, 'creator must not edit the note after the invite is used';
  exception when insufficient_privilege then null;
  end;
  reset role;
  select note into t from invite_notes
   where connection_id = 'a1900000-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  assert t = 'I miss our talks.', format('note changed after join: %s', t);

  -- Length is bounded.
  begin
    insert into invite_notes (connection_id, author_id, note)
      values ('a1900000-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
              'a1900000-0000-0000-0000-000000000001', repeat('x', 281));
    assert false, 'a 281-character note must be rejected';
  exception when check_violation or unique_violation then null;
  end;

  -- Cascades with the author's account (deleted server-side, no user context).
  perform set_config('test.user_id', '', true);
  delete from auth.users where id = 'a1900000-0000-0000-0000-000000000001';
  select count(*) into n from invite_notes;
  assert n = 0, 'invite note must go with its author';
  raise notice 'PASS: note frozen after join, bounded, and cascades with the author';
end $$;

select 'ALL INVITE NOTE TESTS PASSED' as result;
