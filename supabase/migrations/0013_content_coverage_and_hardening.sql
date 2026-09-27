-- Content coverage + two small hardenings.
--
-- 1. Every relationship type the product sells has a "first 20" onboarding
--    pack. Sibling and mentor connections had none (startOnboarding hit
--    ?notice=nopack), and there was no generic fallback for any type added
--    later. Both are fixed here, plus a generic pack as a last resort.
-- 2. The daily pool was 1–2 questions per type; ensure_daily_prompt started
--    repeating on day two or three. This widens the pool for every type and
--    the shared pool, so a pair goes weeks before seeing a repeat.
-- 3. accept_invite refuses archived/blocked connections: leaving a still-
--    pending connection archives it, and the un-burned code must not let a
--    late tap join a dead space.
-- 4. has_premium answers only about the caller (service role, with no
--    auth.uid(), still sees everything). Any authenticated user could
--    previously probe any other user's plan through /rest/v1/rpc.

-- ===========================================================================
-- Onboarding "20 questions" — SIBLING
-- ===========================================================================
insert into prompt_templates (kind, relationship_type, framework, title, description, source, questions) values
('onboarding','sibling','aron_36 + family_systems',
 'Siblings — The First 20',
 'Reconnect as the adults you are now — beyond the roles you grew up in.',
 'seed',
 $j$[
  {"id":"q1","text":"What's your favorite memory of us as kids?","format":"free_text"},
  {"id":"q2","text":"What role did you feel you played in our family growing up?","format":"free_text"},
  {"id":"q3","text":"What do you think I got from our parents that you didn't — or the other way round?","format":"free_text"},
  {"id":"q4","text":"What's something about your life now that I probably don't know much about?","format":"free_text"},
  {"id":"q5","text":"When you're going through something hard, do you want me to check in, give space, or just show up?","format":"free_text"},
  {"id":"q6","text":"What's an old sibling habit between us you'd be glad to retire?","format":"free_text"},
  {"id":"q7","text":"What's something you admire about who I've become?","format":"free_text"},
  {"id":"q8","text":"Is there something from our childhood you wish we'd talked about?","format":"free_text"},
  {"id":"q9","text":"How do you feel about how often we're in touch?","format":"choice","options":["Just right","I'd like more","I'd like it to feel less like an obligation","I'm not sure"]},
  {"id":"q10","text":"What's a tradition — old or new — you'd like us to keep as adults?","format":"free_text"},
  {"id":"q11","text":"How do you prefer we handle it when one of us is annoyed with the other?","format":"free_text"},
  {"id":"q12","text":"What's a way our family talked (or didn't talk) about feelings that still shapes you?","format":"free_text"},
  {"id":"q13","text":"On a scale of 1-10, how close do you feel to me right now?","format":"scale","min":1,"max":10},
  {"id":"q14","text":"Is there anything about our parents — their health, their future — you've been carrying alone?","format":"free_text"},
  {"id":"q15","text":"What's something you'd want my support with in the next year?","format":"free_text"},
  {"id":"q16","text":"What did you learn from me, even if you never said so?","format":"free_text"},
  {"id":"q17","text":"What's something you're proud of that our family doesn't talk about enough?","format":"free_text"},
  {"id":"q18","text":"What does being a good sibling look like to you, now?","format":"free_text"},
  {"id":"q19","text":"What's one thing you'd like us to do together that we've never done?","format":"free_text"},
  {"id":"q20","text":"What do you want me to understand about you that I might still see through a childhood lens?","format":"free_text"}
 ]$j$::jsonb);

-- ===========================================================================
-- Onboarding "20 questions" — MENTOR / MENTEE
-- ===========================================================================
insert into prompt_templates (kind, relationship_type, framework, title, description, source, questions) values
('onboarding','mentor','psychological_safety + developmental_network',
 'Mentoring — The First 20',
 'Set up a mentoring relationship that is honest, specific, and useful for both of you.',
 'seed',
 $j$[
  {"id":"q1","text":"What do you hope this mentoring relationship gives you over the next year?","format":"free_text"},
  {"id":"q2","text":"What's a strength you bring that others sometimes overlook?","format":"free_text"},
  {"id":"q3","text":"What's a skill or situation you'd most like to grow in right now?","format":"free_text"},
  {"id":"q4","text":"How do you like to receive feedback — direct and quick, or with context and time to reflect?","format":"free_text"},
  {"id":"q5","text":"What's a piece of advice you've received that genuinely changed how you work?","format":"free_text"},
  {"id":"q6","text":"What does a good mentoring conversation look like to you — questions, stories, problem-solving, accountability?","format":"free_text"},
  {"id":"q7","text":"What's a professional risk you're weighing at the moment?","format":"free_text"},
  {"id":"q8","text":"What's a mistake you've learned the most from?","format":"free_text"},
  {"id":"q9","text":"How often would you ideally want us to connect?","format":"choice","options":["Weekly","Every couple of weeks","Monthly","As things come up"]},
  {"id":"q10","text":"What topics are off the table — or ones you'd want to explicitly keep on it?","format":"free_text"},
  {"id":"q11","text":"How comfortable do you feel being candid with me right now?","format":"scale","min":1,"max":10},
  {"id":"q12","text":"What does success look like for you — in your own words, not your job title's?","format":"free_text"},
  {"id":"q13","text":"What's something you're working on outside of work that matters to you?","format":"free_text"},
  {"id":"q14","text":"What kind of support do you find unhelpful, even when it's well-meant?","format":"free_text"},
  {"id":"q15","text":"Who has shaped how you think about your work, and what did they model?","format":"free_text"},
  {"id":"q16","text":"What's one thing you'd like me to hold you accountable for?","format":"free_text"},
  {"id":"q17","text":"What's a question you've been afraid to ask anyone in your field?","format":"free_text"},
  {"id":"q18","text":"What do you think I could learn from you?","format":"free_text"},
  {"id":"q19","text":"How will we know this relationship is working — and how should we say so if it isn't?","format":"free_text"},
  {"id":"q20","text":"What's something you want me to understand about where you're coming from?","format":"free_text"}
 ]$j$::jsonb);

-- ===========================================================================
-- Onboarding — GENERIC FALLBACK (relationship_type null)
-- startOnboarding prefers a type-specific pack; this only serves a type that
-- has none, so adding an enum value later never strands a connection.
-- ===========================================================================
insert into prompt_templates (kind, relationship_type, framework, title, description, source, questions) values
('onboarding',null,'aron_36',
 'The First 20',
 'A guided first conversation — mutual, honest, and at your own pace.',
 'seed',
 $j$[
  {"id":"q1","text":"What's a moment that made you glad we know each other?","format":"free_text"},
  {"id":"q2","text":"What do you value most in the people close to you?","format":"free_text"},
  {"id":"q3","text":"What's something going on in your life right now you'd want me to ask about?","format":"free_text"},
  {"id":"q4","text":"When you're stressed, do you want space, distraction, or someone to listen?","format":"free_text"},
  {"id":"q5","text":"What's a goal you're chasing this year?","format":"free_text"},
  {"id":"q6","text":"What's a part of your life you don't talk about much?","format":"free_text"},
  {"id":"q7","text":"How do you like to be supported when things go wrong?","format":"free_text"},
  {"id":"q8","text":"What's the best advice you've ever received?","format":"free_text"},
  {"id":"q9","text":"What's something you've changed your mind about recently?","format":"free_text"},
  {"id":"q10","text":"How often would you ideally want us to be in touch?","format":"free_text"},
  {"id":"q11","text":"What's a small thing that reliably makes your day better?","format":"free_text"},
  {"id":"q12","text":"What do you wish more people understood about you?","format":"free_text"},
  {"id":"q13","text":"How do you prefer to handle it when we disagree?","format":"free_text"},
  {"id":"q14","text":"On a scale of 1-10, how connected do you feel to me right now?","format":"scale","min":1,"max":10},
  {"id":"q15","text":"What's something I do that you appreciate but rarely say out loud?","format":"free_text"},
  {"id":"q16","text":"What do you need more of from me?","format":"free_text"},
  {"id":"q17","text":"What's a memory of us you return to when you're happy?","format":"free_text"},
  {"id":"q18","text":"How do you like to celebrate good news?","format":"free_text"},
  {"id":"q19","text":"What's one thing you'd like us to be braver about together?","format":"free_text"},
  {"id":"q20","text":"What's something you want me to understand about you that I might not yet?","format":"free_text"}
 ]$j$::jsonb);

-- ===========================================================================
-- Daily pool — widen for every type. The generic pool is used by all types
-- once their type-specific questions are spent (ensure_daily_prompt prefers
-- unused, type-specific first).
-- ===========================================================================
insert into prompt_templates (kind, relationship_type, framework, title, source, questions) values
-- Anyone
('daily',null,null,'Daily — Anyone','seed', $j$[{"id":"q1","text":"What's one small thing that went right today?","format":"free_text"}]$j$::jsonb),
('daily',null,null,'Daily — Anyone','seed', $j$[{"id":"q1","text":"What's something you're carrying today that would feel lighter if you said it out loud?","format":"free_text"}]$j$::jsonb),
('daily',null,'gottman_love_maps','Daily — Anyone','seed', $j$[{"id":"q1","text":"What's a song, show, or book you've been into lately, and why?","format":"free_text"}]$j$::jsonb),
('daily',null,'active_constructive','Daily — Anyone','seed', $j$[{"id":"q1","text":"What's something you're proud of from this week that nobody has congratulated you on?","format":"free_text"}]$j$::jsonb),
('daily',null,null,'Daily — Anyone','seed', $j$[{"id":"q1","text":"If you had a free afternoon tomorrow, how would you actually spend it?","format":"free_text"}]$j$::jsonb),
('daily',null,'gottman_fondness','Daily — Anyone','seed', $j$[{"id":"q1","text":"What's something the other person did recently that you noticed but didn't mention?","format":"free_text"}]$j$::jsonb),
('daily',null,null,'Daily — Anyone','seed', $j$[{"id":"q1","text":"What's a worry that's been louder than usual this week?","format":"free_text"}]$j$::jsonb),
('daily',null,null,'Daily — Anyone','seed', $j$[{"id":"q1","text":"What's something you learned recently — big or trivial?","format":"free_text"}]$j$::jsonb),
('daily',null,null,'Daily — Anyone','seed', $j$[{"id":"q1","text":"How is your energy today, honestly?","format":"scale","min":1,"max":10}]$j$::jsonb),
('daily',null,null,'Daily — Anyone','seed', $j$[{"id":"q1","text":"What's one thing you'd like to do differently next week?","format":"free_text"}]$j$::jsonb),
('daily',null,'gottman_bids','Daily — Anyone','seed', $j$[{"id":"q1","text":"When did you last feel really listened to, and what made it feel that way?","format":"free_text"}]$j$::jsonb),
('daily',null,null,'Daily — Anyone','seed', $j$[{"id":"q1","text":"What's a place you'd love to go together someday?","format":"free_text"}]$j$::jsonb),
-- Romantic
('daily','romantic','gottman_fondness','Daily — Romantic','seed', $j$[{"id":"q1","text":"What's one thing I did this week that made you feel loved?","format":"free_text"}]$j$::jsonb),
('daily','romantic','gottman_love_maps','Daily — Romantic','seed', $j$[{"id":"q1","text":"What's stressing you right now that I might not fully see?","format":"free_text"}]$j$::jsonb),
('daily','romantic','gottman_rituals','Daily — Romantic','seed', $j$[{"id":"q1","text":"What's a small ritual of ours you'd miss if it disappeared?","format":"free_text"}]$j$::jsonb),
('daily','romantic','gottman_bids','Daily — Romantic','seed', $j$[{"id":"q1","text":"When did you last feel like we were a team? What were we doing?","format":"free_text"}]$j$::jsonb),
('daily','romantic',null,'Daily — Romantic','seed', $j$[{"id":"q1","text":"What would make tonight feel like a good night for you?","format":"free_text"}]$j$::jsonb),
('daily','romantic','gottman_love_maps','Daily — Romantic','seed', $j$[{"id":"q1","text":"How connected do you feel to me today?","format":"scale","min":1,"max":10}]$j$::jsonb),
('daily','romantic',null,'Daily — Romantic','seed', $j$[{"id":"q1","text":"What's one thing you need more of from me this week: time, touch, help, or words?","format":"choice","options":["Time","Touch","Help","Words"]}]$j$::jsonb),
-- Friend
('daily','friend',null,'Daily — Friend','seed', $j$[{"id":"q1","text":"What's a small win you haven't told anyone about yet?","format":"free_text"}]$j$::jsonb),
('daily','friend',null,'Daily — Friend','seed', $j$[{"id":"q1","text":"What's been taking up the most space in your head lately?","format":"free_text"}]$j$::jsonb),
('daily','friend','self_expansion','Daily — Friend','seed', $j$[{"id":"q1","text":"What's something you'd love for us to try together this month?","format":"free_text"}]$j$::jsonb),
('daily','friend',null,'Daily — Friend','seed', $j$[{"id":"q1","text":"Who or what made you laugh this week?","format":"free_text"}]$j$::jsonb),
('daily','friend',null,'Daily — Friend','seed', $j$[{"id":"q1","text":"What's a decision you're chewing on that you'd like a second opinion on?","format":"free_text"}]$j$::jsonb),
('daily','friend',null,'Daily — Friend','seed', $j$[{"id":"q1","text":"How are you doing, really — not the version you give at work?","format":"free_text"}]$j$::jsonb),
-- Family
('daily','family','gottman_shared_meaning','Daily — Family','seed', $j$[{"id":"q1","text":"What's a family memory that came to mind this week?","format":"free_text"}]$j$::jsonb),
('daily','family',null,'Daily — Family','seed', $j$[{"id":"q1","text":"What's something you're looking forward to in the next month?","format":"free_text"}]$j$::jsonb),
('daily','family',null,'Daily — Family','seed', $j$[{"id":"q1","text":"What's one thing on your plate right now that feels heavy?","format":"free_text"}]$j$::jsonb),
('daily','family',null,'Daily — Family','seed', $j$[{"id":"q1","text":"What's a way you'd like us to spend time together soon?","format":"free_text"}]$j$::jsonb),
('daily','family',null,'Daily — Family','seed', $j$[{"id":"q1","text":"What's something the other person does that you've come to appreciate more with time?","format":"free_text"}]$j$::jsonb),
('daily','family',null,'Daily — Family','seed', $j$[{"id":"q1","text":"How supported do you feel by family right now?","format":"scale","min":1,"max":10}]$j$::jsonb),
-- Coworker
('daily','coworker','psychological_safety','Daily — Coworker','seed', $j$[{"id":"q1","text":"What's one thing that would make this week's work go more smoothly between us?","format":"free_text"}]$j$::jsonb),
('daily','coworker',null,'Daily — Coworker','seed', $j$[{"id":"q1","text":"What's something you're working on that you'd like a hand or a sounding board with?","format":"free_text"}]$j$::jsonb),
('daily','coworker',null,'Daily — Coworker','seed', $j$[{"id":"q1","text":"What did the other person do recently that made your work easier?","format":"free_text"}]$j$::jsonb),
('daily','coworker',null,'Daily — Coworker','seed', $j$[{"id":"q1","text":"How clear do our priorities feel right now?","format":"scale","min":1,"max":10}]$j$::jsonb),
('daily','coworker',null,'Daily — Coworker','seed', $j$[{"id":"q1","text":"What's something outside work that's on your mind this week (share as much or little as you like)?","format":"free_text"}]$j$::jsonb),
-- Parent & teen
('daily','parent_child','emotion_coaching','Daily — Parent & Teen','seed', $j$[{"id":"q1","text":"What's one thing that made you laugh today?","format":"free_text"}]$j$::jsonb),
('daily','parent_child','autonomy_support','Daily — Parent & Teen','seed', $j$[{"id":"q1","text":"What's something you'd like more say over right now?","format":"free_text"}]$j$::jsonb),
('daily','parent_child','emotion_coaching','Daily — Parent & Teen','seed', $j$[{"id":"q1","text":"If today had a weather report, what would it be — and why?","format":"free_text"}]$j$::jsonb),
('daily','parent_child',null,'Daily — Parent & Teen','seed', $j$[{"id":"q1","text":"What's something you wish we did more of together?","format":"free_text"}]$j$::jsonb),
('daily','parent_child',null,'Daily — Parent & Teen','seed', $j$[{"id":"q1","text":"What's one thing the other person did this week that you appreciated?","format":"free_text"}]$j$::jsonb),
-- Sibling
('daily','sibling',null,'Daily — Sibling','seed', $j$[{"id":"q1","text":"What's something from this week you'd have texted me about if we were teenagers?","format":"free_text"}]$j$::jsonb),
('daily','sibling',null,'Daily — Sibling','seed', $j$[{"id":"q1","text":"What's a childhood memory of us that popped into your head recently?","format":"free_text"}]$j$::jsonb),
('daily','sibling',null,'Daily — Sibling','seed', $j$[{"id":"q1","text":"What's going on in your life right now that you'd want me to ask about?","format":"free_text"}]$j$::jsonb),
('daily','sibling',null,'Daily — Sibling','seed', $j$[{"id":"q1","text":"Is there anything about our parents or family you've been thinking about lately?","format":"free_text"}]$j$::jsonb),
('daily','sibling',null,'Daily — Sibling','seed', $j$[{"id":"q1","text":"What's something you're proud of this week?","format":"free_text"}]$j$::jsonb),
('daily','sibling',null,'Daily — Sibling','seed', $j$[{"id":"q1","text":"How are you doing, honestly?","format":"scale","min":1,"max":10}]$j$::jsonb),
-- Mentor
('daily','mentor',null,'Daily — Mentoring','seed', $j$[{"id":"q1","text":"What's one thing you learned this week, however small?","format":"free_text"}]$j$::jsonb),
('daily','mentor',null,'Daily — Mentoring','seed', $j$[{"id":"q1","text":"What's a challenge you're facing where a different perspective would help?","format":"free_text"}]$j$::jsonb),
('daily','mentor',null,'Daily — Mentoring','seed', $j$[{"id":"q1","text":"What's a win from this week you'd like acknowledged?","format":"free_text"}]$j$::jsonb),
('daily','mentor','psychological_safety','Daily — Mentoring','seed', $j$[{"id":"q1","text":"Is there a question you've been hesitating to ask?","format":"free_text"}]$j$::jsonb),
('daily','mentor',null,'Daily — Mentoring','seed', $j$[{"id":"q1","text":"How is your motivation this week?","format":"scale","min":1,"max":10}]$j$::jsonb),
('daily','mentor',null,'Daily — Mentoring','seed', $j$[{"id":"q1","text":"What's one thing you'd like to have done by the next time we talk?","format":"free_text"}]$j$::jsonb);

-- ===========================================================================
-- accept_invite: never join an archived or blocked connection
-- ===========================================================================
create or replace function accept_invite(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  conn connections%rowtype;
  uid  uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated'; end if;

  select * into conn from connections
   where invite_code = p_code
     and (invite_expires_at is null or invite_expires_at > now())
   for update;
  if not found then raise exception 'invalid or expired invite'; end if;

  if conn.created_by = uid then raise exception 'cannot accept your own invite'; end if;

  -- Someone left before the invitee arrived: the space is closed.
  if conn.status in ('archived','blocked') then
    raise exception 'invalid or expired invite';
  end if;

  insert into connection_members (connection_id, user_id, role, joined_at)
  values (conn.id, uid, 'member', now())
  on conflict (connection_id, user_id) do nothing;

  update connections
     set status = case when status = 'pending' then 'onboarding' else status end,
         invite_code = null,
         updated_at = now()
   where id = conn.id;

  return conn.id;
end;
$$;

-- ===========================================================================
-- has_premium: only about yourself (service role / cron: anyone)
-- ===========================================================================
create or replace function has_premium(uid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select (auth.uid() is null or uid = auth.uid())
     and exists (
       select 1 from subscriptions s
       where s.user_id = uid
         and s.plan = 'premium'
         and s.status in ('active','trialing')
     );
$$;
