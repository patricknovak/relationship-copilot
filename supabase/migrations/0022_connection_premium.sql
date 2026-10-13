-- Premium covers the connection. Roadmap item 7 (docs/ROADMAP.md).
--
-- The AI Blueprint and weekly digest are shared insights about two people,
-- so one paying member should unlock them for the pair (the norm in the
-- category). connection_has_premium(p_conn) answers "does any joined member
-- of this connection hold an active premium plan?", and only for callers who
-- are members themselves (service role, with no auth.uid(), may ask about
-- any connection). It never reveals which member pays.
--
-- has_premium(uid) is unchanged and still drives the per-user connection cap
-- and the premium library rows. Additive; no RLS or reveal-gate change.

create or replace function public.connection_has_premium(p_conn uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select (auth.uid() is null or is_connection_member(p_conn))
     and exists (
       select 1
       from connection_members m
       join subscriptions s on s.user_id = m.user_id
       where m.connection_id = p_conn
         and m.joined_at is not null
         and s.plan = 'premium'
         and s.status in ('active', 'trialing')
     );
$$;

revoke all on function public.connection_has_premium(uuid) from public, anon;
grant execute on function public.connection_has_premium(uuid) to authenticated, service_role;
