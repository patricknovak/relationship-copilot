-- Tighten EXECUTE grants on SECURITY DEFINER functions (Supabase security
-- advisor 0028/0029). Functions get EXECUTE for PUBLIC by default, which
-- exposes them all at /rest/v1/rpc/*.
--
-- Internal-only (triggers, cron): callable by no client role.
-- Client RPCs + RLS helpers: authenticated only — RLS policies evaluate these
-- helpers as the querying role, so authenticated must keep EXECUTE on them.

revoke execute on function handle_new_user() from public, anon, authenticated;
revoke execute on function maybe_reveal_instance() from public, anon, authenticated;
revoke execute on function assign_daily_prompts(date) from public, anon, authenticated;

revoke execute on function is_connection_member(uuid) from public, anon;
revoke execute on function has_answered(uuid, uuid) from public, anon;
revoke execute on function has_premium(uuid) from public, anon;
revoke execute on function accept_invite(text) from public, anon;
revoke execute on function ensure_daily_prompt(uuid, date) from public, anon;

grant execute on function is_connection_member(uuid) to authenticated, service_role;
grant execute on function has_answered(uuid, uuid) to authenticated, service_role;
grant execute on function has_premium(uuid) to authenticated, service_role;
grant execute on function accept_invite(text) to authenticated;
grant execute on function ensure_daily_prompt(uuid, date) to authenticated, service_role;
