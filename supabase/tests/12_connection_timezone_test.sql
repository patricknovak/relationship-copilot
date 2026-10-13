-- connection timezone (migration 0025): validated IANA zone, local "today",
-- and ensure_daily_prompt defaulting to the connection's local date.

insert into auth.users (id, email) values
  ('c0000000-0000-0000-0000-000000000001', 'tz1@example.com'),
  ('c0000000-0000-0000-0000-000000000002', 'tz2@example.com');

-- Two zones that are never on the same calendar date (+14 vs -12).
insert into connections (id, type, status, created_by, timezone) values
  ('c0000000-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'friend', 'active',
   'c0000000-0000-0000-0000-000000000001', 'Pacific/Kiritimati'),
  ('c0000000-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'friend', 'active',
   'c0000000-0000-0000-0000-000000000001', 'Etc/GMT+12');
insert into connection_members (connection_id, user_id, role, joined_at) values
  ('c0000000-aaaa-aaaa-aaaa-aaaaaaaaaaaa','c0000000-0000-0000-0000-000000000002','member', now()),
  ('c0000000-bbbb-bbbb-bbbb-bbbbbbbbbbbb','c0000000-0000-0000-0000-000000000002','member', now());

do $$
declare blocked boolean := false; da date; db date; ia uuid; ib uuid; sa date; sb date;
begin
  -- Garbage zones are rejected; the default is UTC.
  begin
    update connections set timezone = 'Not/AZone' where id = 'c0000000-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  exception when check_violation then blocked := true;
  end;
  assert blocked, 'EXPECTED an unknown time zone to be rejected';
  assert is_valid_timezone('America/Vancouver'), 'EXPECTED a real zone to validate';
  assert not is_valid_timezone(null), 'EXPECTED null to be invalid';

  -- connection_today is member-gated for app callers.
  set local "test.user_id" = '99999999-9999-9999-9999-999999999999';
  assert connection_today('c0000000-aaaa-aaaa-aaaa-aaaaaaaaaaaa') is null,
    'EXPECTED a non-member to get null from connection_today';
  reset "test.user_id";

  -- Local dates differ across the date line.
  da := connection_today('c0000000-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  db := connection_today('c0000000-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
  assert da > db, format('EXPECTED +14 date (%s) after -12 date (%s)', da, db);
  assert da - db between 1 and 2, 'EXPECTED the two dates to be one or two days apart';

  -- ensure_daily_prompt without a date uses the connection''s local day.
  ia := ensure_daily_prompt('c0000000-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  ib := ensure_daily_prompt('c0000000-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
  select scheduled_for into sa from prompt_instances where id = ia;
  select scheduled_for into sb from prompt_instances where id = ib;
  assert sa = da, format('EXPECTED instance dated %s, got %s', da, sa);
  assert sb = db, format('EXPECTED instance dated %s, got %s', db, sb);

  -- Idempotent with the default date; an explicit date still works.
  assert ensure_daily_prompt('c0000000-aaaa-aaaa-aaaa-aaaaaaaaaaaa') = ia,
    'EXPECTED the same instance on a second call';
  assert ensure_daily_prompt('c0000000-aaaa-aaaa-aaaa-aaaaaaaaaaaa', date '2026-01-01') <> ia,
    'EXPECTED an explicit other date to create another instance';

  -- The assigner uses each connection''s own date.
  perform assign_daily_prompts();
  assert (select count(*) from prompt_instances
           where connection_id in ('c0000000-aaaa-aaaa-aaaa-aaaaaaaaaaaa','c0000000-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
             and kind = 'daily' and scheduled_for in (da, db)) = 2,
    'EXPECTED assigner to be idempotent per local day';

  -- A member can set the zone (not in the 0014 guarded column list).
  set local role authenticated;
  set local "test.user_id" = 'c0000000-0000-0000-0000-000000000002';
  update connections set timezone = 'America/Vancouver'
   where id = 'c0000000-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  reset role; reset "test.user_id";
  assert (select timezone from connections where id = 'c0000000-bbbb-bbbb-bbbb-bbbbbbbbbbbb') = 'America/Vancouver',
    'EXPECTED a member to be able to set the time zone';

  raise notice 'PASS: connection time zone drives the daily date';
end $$;

select 'ALL CONNECTION TIMEZONE TESTS PASSED' as result;
