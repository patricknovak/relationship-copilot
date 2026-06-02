-- Phase 5 — elective content: quizzes + challenges per relationship type, and
-- the romantic dating-decision lens. Challenges embed the activity in the
-- question text (the engine snapshots `questions` into each instance). All
-- framed honestly and non-diagnostically.

-- ===========================================================================
-- Challenges (kind='challenge') — short, evidence-informed activities
-- ===========================================================================
insert into prompt_templates (kind, relationship_type, framework, title, description, source, questions) values
('challenge','romantic','aron_self_expansion',
 'Try something new together',
 'Novel, shared activities renew closeness (self-expansion theory).',
 'seed',
 $j$[{"id":"q1","text":"Plan and do one new thing together this week. Afterward: what did it bring out in each of you?","format":"free_text"}]$j$::jsonb),
('challenge','romantic','gottman_fondness',
 'Three appreciations',
 'Building a culture of appreciation buffers against contempt (Gottman).',
 'seed',
 $j$[{"id":"q1","text":"Name three specific things you appreciated about the other this week.","format":"free_text"}]$j$::jsonb),
('challenge','romantic','gottman_stress_reducing',
 'Stress-reducing conversation',
 'Take turns being heard about stress outside the relationship.',
 'seed',
 $j$[{"id":"q1","text":"Spend 15 minutes each just listening about a stress outside your relationship. What did you learn about how to support each other?","format":"free_text"}]$j$::jsonb),
('challenge','friend',null,
 'Reconnect check-in',
 'A simple prompt to close the gap when life gets busy.',
 'seed',
 $j$[{"id":"q1","text":"What is something going on in your life right now that you would want a good friend to ask you about?","format":"free_text"}]$j$::jsonb),
('challenge','family','gottman_shared_meaning',
 'Share a family story',
 'Shared meaning strengthens family bonds.',
 'seed',
 $j$[{"id":"q1","text":"Share a family memory or story that means a lot to you. Why does it matter?","format":"free_text"}]$j$::jsonb),
('challenge','coworker','psychological_safety',
 'Specific positive feedback',
 'Specific recognition builds trust and psychological safety.',
 'seed',
 $j$[{"id":"q1","text":"Give one piece of specific, genuine positive feedback about working with the other person.","format":"free_text"}]$j$::jsonb),
('challenge',null,'gratitude',
 'Gratitude exchange',
 'Expressed gratitude reliably lifts relationship satisfaction.',
 'seed',
 $j$[{"id":"q1","text":"What is one thing the other person did recently that you are grateful for?","format":"free_text"}]$j$::jsonb);

-- ===========================================================================
-- Quizzes (kind='quiz')
-- ===========================================================================
insert into prompt_templates (kind, relationship_type, framework, title, description, source, config, questions) values
('quiz','romantic','dating_decision',
 'Where are we headed?',
 'A reflection for thinking about a romantic relationship''s direction. This is a personal reflection, not a verdict — and never a substitute for your own judgment or professional support.',
 'seed',
 $c${"scoring":"reflection","note":"non_diagnostic"}$c$::jsonb,
 $j$[
  {"id":"q1","text":"How aligned do our core values feel?","format":"scale","min":1,"max":5},
  {"id":"q2","text":"How safe and respected do I feel in this relationship?","format":"scale","min":1,"max":5},
  {"id":"q3","text":"How well do we repair after conflict?","format":"scale","min":1,"max":5},
  {"id":"q4","text":"How excited am I about a shared future?","format":"scale","min":1,"max":5},
  {"id":"q5","text":"What is one hope, and one hesitation, I have about us?","format":"free_text"}
 ]$j$::jsonb),
('quiz',null,'communication',
 'How we handle conflict',
 'A gentle look at conflict styles. Educational, not a diagnosis.',
 'seed',
 $c${"scoring":"reflection"}$c$::jsonb,
 $j$[
  {"id":"q1","text":"When we disagree, I tend to...","format":"choice","options":["Address it right away","Need time to cool off first","Avoid it","Try to smooth it over quickly"]},
  {"id":"q2","text":"After a disagreement, I usually feel heard.","format":"scale","min":1,"max":5},
  {"id":"q3","text":"What helps me most when we are working through something hard?","format":"free_text"}
 ]$j$::jsonb),
('quiz','friend','reciprocity',
 'Our friendship rhythm',
 'How we each like to stay connected.',
 'seed',
 $c${"scoring":"reflection"}$c$::jsonb,
 $j$[
  {"id":"q1","text":"Ideally, how often would we connect?","format":"choice","options":["Most days","Weekly","A few times a month","When something comes up"]},
  {"id":"q2","text":"I feel comfortable reaching out first.","format":"scale","min":1,"max":5},
  {"id":"q3","text":"What is one way we could support each other better?","format":"free_text"}
 ]$j$::jsonb);
