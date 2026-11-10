-- Migration 0045: mission_control_counts is passcode-gated, counts only real
-- accounts (test emails and mission_control.test_users excluded), and its
-- tables stay unreadable to clients.

-- On Supabase, pgcrypto lives in the extensions schema; locally it is in
-- public (0001). The function calls extensions.digest, so shim it here.
create schema if not exists extensions;
create or replace function extensions.digest(text, text) returns bytea
  language sql immutable as $$ select public.digest($1, $2) $$;

insert into mission_control.counts_passcode (sha256_hex)
  values (encode(public.digest('test-passcode', 'sha256'), 'hex'));

insert into auth.users (id, email, created_at, email_confirmed_at) values
  ('f2045000-0000-0000-0000-000000000001', 'real-a@gmail.test', now() - interval '2 days', now() - interval '2 days'),
  ('f2045000-0000-0000-0000-000000000002', 'real-b@gmail.test', now() - interval '2 days', null),
  ('f2045000-0000-0000-0000-000000000003', 'someone@example.com', now() - interval '2 days', now() - interval '2 days'),
  ('f2045000-0000-0000-0000-000000000004', 'labelled@gmail.test', now() - interval '2 days', now() - interval '2 days');
insert into mission_control.test_users (user_id, note)
  values ('f2045000-0000-0000-0000-000000000004', 'test account');

do $$
declare
  r record;
  base_all bigint;
begin
  -- Wrong or missing passcode is refused, even for anon.
  set local role anon;
  begin
    perform * from public.mission_control_counts(now() - interval '1 day', now(), now() - interval '7 days', now(), 'wrong');
    assert false, 'a wrong passcode must be refused';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.mission_control_counts(now() - interval '1 day', now(), now() - interval '7 days', now(), null);
    assert false, 'a missing passcode must be refused';
  exception when insufficient_privilege then null;
  end;

  -- Anon cannot read the passcode or test-user tables.
  begin
    perform 1 from mission_control.counts_passcode;
    assert false, 'anon must not read mission_control tables';
  exception when insufficient_privilege then null;
  end;

  -- The right passcode returns counts; only the two real accounts count, and
  -- only the confirmed one counts as a completed sign-up.
  select * into r from public.mission_control_counts(
    now() - interval '3 days', now(), now() - interval '7 days', now(), 'test-passcode');
  reset role;

  assert r.signup_starts_yesterday >= 2, 'both real accounts are sign-up starts in the window';
  assert r.signups_yesterday >= 1, 'the confirmed real account is a completed sign-up';
  assert r.signup_starts_all - r.signups_all >= 1, 'the unconfirmed account is a start, not a completed sign-up';

  -- Excluded accounts never count: removing them changes nothing.
  delete from auth.users where id in ('f2045000-0000-0000-0000-000000000003', 'f2045000-0000-0000-0000-000000000004');
  select signup_starts_all into base_all from public.mission_control_counts(
    now() - interval '3 days', now(), now() - interval '7 days', now(), 'test-passcode');
  assert base_all = r.signup_starts_all, 'example.com and test_users accounts must be excluded';

  raise notice 'PASS: mission_control_counts is passcode-gated and excludes test accounts';
end $$;
