-- Privacy-safe signal for the "waiting on you" first-reveal state.
-- Returns whether another connection member has submitted content for this
-- instance — boolean only, never answer text. Members of the instance's
-- connection may call it; everyone else gets false.

create or replace function others_have_answered(p_instance uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    is_connection_member(
      (select connection_id from prompt_instances where id = p_instance)
    )
    and exists (
      select 1
      from prompt_responses r
      where r.instance_id = p_instance
        and r.user_id is distinct from auth.uid()
        and response_has_content(r.answers)
    );
$$;

revoke execute on function others_have_answered(uuid) from public, anon;
grant execute on function others_have_answered(uuid) to authenticated, service_role;
