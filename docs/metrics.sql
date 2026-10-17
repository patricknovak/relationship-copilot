-- Product metrics straight from the production tables (docs/ROADMAP.md §5).
-- Run in the Supabase SQL editor. Nothing here reads answer text.

-- 1. North star: pairs that have completed a first mutual reveal, by week.
select date_trunc('week', claimed_at)::date as week, count(*) as first_reveals
from connection_first_reveal_ga4
group by 1 order by 1;

-- 2. The habit: active pairs = connections with a revealed daily in the last
--    7 days, versus all active connections.
select
  (select count(distinct connection_id) from prompt_instances
    where kind = 'daily' and status = 'revealed'
      and revealed_at > now() - interval '7 days') as pairs_revealed_7d,
  (select count(*) from connections where status = 'active') as active_connections;

-- 3. Funnel, lifetime: created → invite sent → partner joined → first reveal.
select
  (select count(*) from connections) as created,
  (select count(*) from connection_funnel_steps where step = 'invite_sent') as invite_sent,
  (select count(*) from connection_funnel_steps where step = 'partner_joined') as partner_joined,
  (select count(*) from connection_first_reveal_ga4) as first_reveal;

-- 4. Day-30 retention of pairs: of connections that first revealed more than
--    30 days ago, how many revealed something in the 7 days around day 30.
with first as (
  select connection_id, claimed_at::date as d0
  from connection_first_reveal_ga4
  where claimed_at < now() - interval '30 days'
)
select
  count(*) as cohort,
  count(*) filter (where exists (
    select 1 from prompt_instances i
    where i.connection_id = first.connection_id and i.status = 'revealed'
      and i.revealed_at::date between first.d0 + 27 and first.d0 + 33
  )) as retained_d30
from first;

-- 5. Notifications: sends by kind, last 30 days, and unsubscribes.
select kind, count(*) as sent
from notification_log
where sent_at > now() - interval '30 days'
group by 1 order by 2 desc;

select count(*) as unsubscribed_all_30d
from audit_log
where action = 'notify.unsubscribe_all' and created_at > now() - interval '30 days';

-- 6. Reactions and discussion: how often a reveal turns into a conversation.
select
  (select count(*) from prompt_instances where status = 'revealed') as reveals,
  (select count(distinct instance_id) from prompt_discussions) as reveals_with_discussion,
  (select count(distinct instance_id) from answer_reactions) as reveals_with_reaction;

-- 7. Premium: subscribers, and connections covered by a plan.
select
  (select count(*) from subscriptions where plan = 'premium' and status in ('active','trialing')) as subscribers,
  (select count(distinct m.connection_id)
     from connection_members m join subscriptions s on s.user_id = m.user_id
    where s.plan = 'premium' and s.status in ('active','trialing')) as covered_connections,
  (select count(*) from relationship_insights where kind = 'blueprint') as blueprints,
  (select count(*) from relationship_insights where kind = 'weekly_digest') as digests;

-- 8. Content health: how deep each type's daily pool is versus its oldest
--    active connection (repeats start when used >= available).
select
  c.type,
  count(distinct c.id) as active_connections,
  (select count(*) from prompt_templates t
    where t.kind = 'daily' and t.active
      and (t.relationship_type = c.type or t.relationship_type is null)) as daily_pool,
  max((select count(*) from prompt_instances i where i.connection_id = c.id and i.kind = 'daily')) as most_dailies_used
from connections c
where c.status = 'active'
group by c.type order by 1;

-- 9. Safety: events by category, last 30 days (free, always-on detection).
select category, count(*) from safety_events
where created_at > now() - interval '30 days'
group by 1 order by 2 desc;
