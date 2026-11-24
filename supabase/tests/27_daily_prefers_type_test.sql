-- 0046: ensure_daily_prompt prefers questions written for the connection's
-- relationship type, and falls back to generic ones only when those run out.

insert into auth.users (id, email) values
  ('a4600000-0000-0000-0000-000000000001', 'tp-a@example.com'),
  ('a4600000-0000-0000-0000-000000000002', 'tp-b@example.com');

insert into connections (id, type, status, created_by)
  values ('c4600000-0000-0000-0000-000000000001', 'sibling', 'active',
          'a4600000-0000-0000-0000-000000000001');
insert into connection_members (connection_id, user_id, role, joined_at) values
  ('c4600000-0000-0000-0000-000000000001', 'a4600000-0000-0000-0000-000000000002', 'member', now());

do $$
declare
  conn constant uuid := 'c4600000-0000-0000-0000-000000000001';
  typed_total int;
  generic_total int;
  typed_used int;
  generic_used int;
  d date := date '2031-01-01';
  n int;
begin
  select count(*) into typed_total from prompt_templates
   where kind = 'daily' and active and relationship_type = 'sibling';
  select count(*) into generic_total from prompt_templates
   where kind = 'daily' and active and relationship_type is null;
  assert typed_total >= 3, format('test needs sibling dailies in the seed, found %s', typed_total);
  assert generic_total >= 1, format('test needs generic dailies in the seed, found %s', generic_total);

  -- One day per sibling question: every one must be a sibling question.
  -- (With NULLs sorting first, all of these were generic.)
  for n in 1..typed_total loop
    perform ensure_daily_prompt(conn, d);
    d := d + 1;
  end loop;

  select count(*) filter (where t.relationship_type = 'sibling'),
         count(*) filter (where t.relationship_type is null)
    into typed_used, generic_used
    from prompt_instances i join prompt_templates t on t.id = i.template_id
   where i.connection_id = conn and i.kind = 'daily';
  assert typed_used = typed_total and generic_used = 0,
    format('EXPECTED %s sibling dailies and 0 generic first, got %s sibling / %s generic',
           typed_total, typed_used, generic_used);
  assert (select count(distinct template_id) from prompt_instances
           where connection_id = conn and kind = 'daily') = typed_total,
    'EXPECTED no repeats while unseen sibling questions remain';
  raise notice 'PASS: typed daily questions come before generic ones';

  -- Typed pool exhausted: the generic pool is the unseen fallback.
  perform ensure_daily_prompt(conn, d);
  d := d + 1;
  select count(*) filter (where t.relationship_type is null) into generic_used
    from prompt_instances i join prompt_templates t on t.id = i.template_id
   where i.connection_id = conn and i.kind = 'daily';
  assert generic_used = 1,
    format('EXPECTED the next daily to be generic once sibling ones are used, got %s generic', generic_used);
  raise notice 'PASS: generic questions are the fallback once typed ones are used';

  -- Everything seen: repeats also prefer the pair's own type.
  for n in 2..generic_total loop
    perform ensure_daily_prompt(conn, d);
    d := d + 1;
  end loop;
  perform ensure_daily_prompt(conn, d);
  assert (select t.relationship_type::text
            from prompt_instances i join prompt_templates t on t.id = i.template_id
           where i.connection_id = conn and i.kind = 'daily' and i.scheduled_for = d) = 'sibling',
    'EXPECTED a repeat to come from the sibling pool';
  raise notice 'PASS: repeats prefer the relationship type too';
end $$;

select 'ALL DAILY TYPE-PREFERENCE TESTS PASSED' as result;
