-- Migration 0031: is_valid_timezone must pin search_path to ''.

do $$
declare
  cfg text[];
begin
  select p.proconfig into cfg
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'is_valid_timezone'
    and pg_get_function_identity_arguments(p.oid) = 'p_tz text';

  assert cfg is not null, 'EXPECTED is_valid_timezone to exist';
  -- Postgres records SET search_path = '' as search_path="".
  assert exists (
    select 1 from unnest(cfg) as c(val)
    where val in ('search_path=', 'search_path=""', 'search_path=''''')
       or val like 'search_path=%'
  ), format('EXPECTED search_path pinned on is_valid_timezone, got %s', cfg);

  assert 'search_path=""' = any (cfg) or 'search_path=' = any (cfg),
    format('EXPECTED empty search_path in proconfig, got %s', cfg);

  -- Behaviour preserved.
  assert public.is_valid_timezone('America/Vancouver'),
    'EXPECTED a real zone to validate after 0031';
  assert not public.is_valid_timezone('Not/AZone'),
    'EXPECTED garbage zones to stay invalid';
  assert not public.is_valid_timezone(null),
    'EXPECTED null to stay invalid';

  raise notice 'PASS: is_valid_timezone search_path is empty and behaviour holds';
end $$;
