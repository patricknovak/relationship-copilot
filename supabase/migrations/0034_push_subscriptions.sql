-- Web push subscriptions (roadmap item 11).
--
-- One row per browser/device that opted in. Holds the push service endpoint
-- and the two public keys the browser handed us; nothing about answers.
-- Clients never read or write the table directly:
--   * save_push_subscription upserts the caller's device. A device's endpoint
--     follows whoever subscribed on it last (shared browser, second account),
--     which a plain RLS insert could not express without letting users
--     overwrite each other's rows.
--   * delete_push_subscription removes the caller's own row for an endpoint.
--   * The server reads rows with the service role only after the notifying
--     event is authorized (lib/notify.ts), like notification_log.
-- Rows cascade with the auth user (account deletion, invariant 6).

create table public.push_subscriptions (
  endpoint     text primary key
    check (endpoint ~ '^https://' and length(endpoint) <= 1024),
  user_id      uuid not null references auth.users (id) on delete cascade,
  p256dh       text not null check (length(p256dh) between 80 and 100),
  auth         text not null check (length(auth) between 16 and 32),
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

comment on table public.push_subscriptions is
  'Browser push subscriptions (endpoint + public keys). No client DML; use '
  'save_push_subscription / delete_push_subscription. Read by the server '
  'with the service role to deliver notifications. No answer content.';

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from public, anon, authenticated;

drop policy if exists push_subscriptions_deny_clients on public.push_subscriptions;
create policy push_subscriptions_deny_clients
  on public.push_subscriptions
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

grant all on public.push_subscriptions to service_role;

-- Upsert the caller's device. Keeps at most 10 devices per person (oldest
-- dropped), so a long-lived account can't grow the table without bound.
create or replace function public.save_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated'; end if;

  insert into public.push_subscriptions (endpoint, user_id, p256dh, auth)
  values (p_endpoint, uid, p_p256dh, p_auth)
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        created_at = now(),
        last_used_at = null;

  delete from public.push_subscriptions
   where user_id = uid
     and endpoint not in (
       select endpoint from public.push_subscriptions
        where user_id = uid
        order by created_at desc
        limit 10
     );
end;
$$;

create or replace function public.delete_push_subscription(p_endpoint text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_subscriptions
   where endpoint = p_endpoint and user_id = auth.uid();
$$;

revoke all on function public.save_push_subscription(text, text, text) from public, anon;
revoke all on function public.delete_push_subscription(text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;
grant execute on function public.delete_push_subscription(text) to authenticated;
