-- Batch form of others_have_answered for the connections list badge.
-- One round-trip instead of N per-daily RPCs. Same privacy contract: boolean
-- only, never answer text; members of each instance's connection only.
--
-- Apply manually in prod with 0031 (this PR does not run it against live DBs).

create or replace function public.others_have_answered_many(p_instances uuid[])
returns table (instance_id uuid, answered boolean)
language sql
security definer
stable
set search_path = ''
as $$
  select
    i.id as instance_id,
    (
      public.is_connection_member(i.connection_id)
      and exists (
        select 1
        from public.prompt_responses r
        where r.instance_id = i.id
          and r.user_id is distinct from auth.uid()
          and public.response_has_content(r.answers)
      )
    ) as answered
  from public.prompt_instances i
  where i.id = any (p_instances);
$$;

comment on function public.others_have_answered_many(uuid[]) is
  'Batch boolean-only signal: for each instance, whether another member has '
  'answered. Same gate as others_have_answered(uuid); never returns text.';

revoke all on function public.others_have_answered_many(uuid[])
  from public, anon;
revoke execute on function public.others_have_answered_many(uuid[])
  from public, anon;
grant execute on function public.others_have_answered_many(uuid[])
  to authenticated, service_role;
