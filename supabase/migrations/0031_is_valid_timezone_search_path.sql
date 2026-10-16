-- Harden public.is_valid_timezone: pin search_path to '' so the check
-- constraint helper cannot be influenced by a malicious search_path.
-- Mirrors the SECURITY DEFINER hardening in 0016 / 0025's other helpers.
--
-- Additive. Does not change behaviour for valid IANA names.
-- Apply manually in prod (this PR does not run it against live DBs).

create or replace function public.is_valid_timezone(p_tz text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_tz is null or length(p_tz) > 64 then return false; end if;
  perform now() at time zone p_tz;
  return true;
exception when others then
  return false;
end;
$$;

comment on function public.is_valid_timezone(text) is
  'Validates an IANA time zone name. search_path pinned to empty (0031).';
