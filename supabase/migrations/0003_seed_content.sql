-- Seed content: framework-grounded onboarding "20 questions" packs per
-- relationship type, a starter daily-question pool, quizzes, and education.
-- Question text draws on Gottman (Love Maps, fondness, rituals), Aron's
-- closeness-generating procedure (the 36 questions), attachment theory, and
-- active-constructive responding. Honesty note: love-language content is
-- framed as preference exploration, not validated science.

-- ===========================================================================
-- Onboarding "20 questions" — ROMANTIC
-- ===========================================================================
insert into prompt_templates (kind, relationship_type, framework, title, description, source, questions) values
('onboarding','romantic','aron_36 + gottman',
 'Romantic — The First 20',
 'A guided first conversation to build closeness through mutual, escalating self-disclosure.',
 'seed',
 $j$[
  {"id":"q1","text":"What first drew you to me, and has that changed?","format":"free_text"},
  {"id":"q2","text":"What does a perfect, ordinary day together look like to you?","format":"free_text"},
  {"id":"q3","text":"When do you feel most loved by me?","format":"free_text"},
  {"id":"q4","text":"What's a dream you have that you haven't fully shared with me?","format":"free_text"},
  {"id":"q5","text":"What does trust look like to you in a relationship?","format":"free_text"},
  {"id":"q6","text":"How do you most like to be comforted when you're upset?","format":"free_text"},
  {"id":"q7","text":"What's something you're proud of that you wish I noticed more?","format":"free_text"},
  {"id":"q8","text":"What did love look like in the home you grew up in?","format":"free_text"},
  {"id":"q9","text":"What's a fear you have about us, even a small one?","format":"free_text"},
  {"id":"q10","text":"When you picture us in five years, what do you hope is true?","format":"free_text"},
  {"id":"q11","text":"How do you prefer to handle disagreements between us?","format":"free_text"},
  {"id":"q12","text":"What's a ritual or tradition you'd love for us to keep?","format":"free_text"},
  {"id":"q13","text":"What makes you feel respected by me?","format":"free_text"},
  {"id":"q14","text":"On a scale of 1-10, how connected do you feel to me right now?","format":"scale","min":1,"max":10},
  {"id":"q15","text":"What's something I do that you appreciate but rarely say out loud?","format":"free_text"},
  {"id":"q16","text":"What do you need more of from me?","format":"free_text"},
  {"id":"q17","text":"What's a memory of us you return to when you're happy?","format":"free_text"},
  {"id":"q18","text":"How do you like to celebrate good news?","format":"free_text"},
  {"id":"q19","text":"What's one thing you'd like us to be braver about together?","format":"free_text"},
  {"id":"q20","text":"What's something you want me to understand about you that I might not yet?","format":"free_text"}
 ]$j$::jsonb);

-- ===========================================================================
-- Onboarding "20 questions" — FRIEND
-- ===========================================================================
insert into prompt_templates (kind, relationship_type, framework, title, description, source, questions) values
('onboarding','friend','aron_36 + self_expansion',
 'Friendship — The First 20',
 'Deepen a friendship through honest, mutual sharing.',
 'seed',
 $j$[
  {"id":"q1","text":"What's a moment our friendship really clicked for you?","format":"free_text"},
  {"id":"q2","text":"What do you value most in a friend?","format":"free_text"},
  {"id":"q3","text":"What's something you're going through right now that you'd want a friend to ask about?","format":"free_text"},
  {"id":"q4","text":"When you're stressed, do you prefer space, distraction, or someone to listen?","format":"free_text"},
  {"id":"q5","text":"What's a goal you're chasing this year?","format":"free_text"},
  {"id":"q6","text":"What's a part of your life you don't talk about much?","format":"free_text"},
  {"id":"q7","text":"How do you like to be supported when things go wrong?","format":"free_text"},
  {"id":"q8","text":"What's the best advice you've ever gotten?","format":"free_text"},
  {"id":"q9","text":"What's something you've changed your mind about recently?","format":"free_text"},
  {"id":"q10","text":"How often would you ideally want to catch up?","format":"free_text"},
  {"id":"q11","text":"What's a small thing that always makes your day better?","format":"free_text"},
  {"id":"q12","text":"What do you wish more people understood about you?","format":"free_text"},
  {"id":"q13","text":"What's a risk you're glad you took?","format":"free_text"},
  {"id":"q14","text":"On a scale of 1-10, how supported do you feel in your life right now?","format":"scale","min":1,"max":10},
  {"id":"q15","text":"What's something you'd love a friend to do with you?","format":"free_text"},
  {"id":"q16","text":"When have you felt most like yourself?","format":"free_text"},
  {"id":"q17","text":"What's a way I could be a better friend to you?","format":"free_text"},
  {"id":"q18","text":"What's a win, big or small, you want to celebrate?","format":"free_text"},
  {"id":"q19","text":"Who has shaped who you are most?","format":"free_text"},
  {"id":"q20","text":"What's something you want to do more of in the next year?","format":"free_text"}
 ]$j$::jsonb);

-- ===========================================================================
-- Onboarding — FAMILY
-- ===========================================================================
insert into prompt_templates (kind, relationship_type, framework, title, description, source, questions) values
('onboarding','family','gottman_shared_meaning',
 'Family — Getting Closer',
 'Build shared meaning and understanding across the family bond.',
 'seed',
 $j$[
  {"id":"q1","text":"What's a family memory you treasure?","format":"free_text"},
  {"id":"q2","text":"What tradition do you hope we keep?","format":"free_text"},
  {"id":"q3","text":"What's something about you that you wish I understood better?","format":"free_text"},
  {"id":"q4","text":"When do you feel most appreciated by me?","format":"free_text"},
  {"id":"q5","text":"What's a value you hope our family stands for?","format":"free_text"},
  {"id":"q6","text":"What's something you're proud of right now?","format":"free_text"},
  {"id":"q7","text":"What do you need more of from me?","format":"free_text"},
  {"id":"q8","text":"How do you prefer we work through disagreements?","format":"free_text"},
  {"id":"q9","text":"What's a hope you have for the coming year?","format":"free_text"},
  {"id":"q10","text":"What's a way our family could support each other better?","format":"free_text"},
  {"id":"q11","text":"What's a story about our family you love retelling?","format":"free_text"},
  {"id":"q12","text":"What's something you'd like us to do together more often?","format":"free_text"}
 ]$j$::jsonb);

-- ===========================================================================
-- Onboarding — COWORKER / MENTOR
-- ===========================================================================
insert into prompt_templates (kind, relationship_type, framework, title, description, source, questions) values
('onboarding','coworker','psychological_safety',
 'Working Together — The First 12',
 'Build a stronger working relationship grounded in psychological safety and clear expectations.',
 'seed',
 $j$[
  {"id":"q1","text":"How do you prefer to receive feedback?","format":"free_text"},
  {"id":"q2","text":"What does great collaboration look like to you?","format":"free_text"},
  {"id":"q3","text":"How do you like to communicate day to day (chat, calls, async)?","format":"free_text"},
  {"id":"q4","text":"What are you trying to grow in professionally right now?","format":"free_text"},
  {"id":"q5","text":"What helps you do your best work?","format":"free_text"},
  {"id":"q6","text":"What's a working style of yours I should know about?","format":"free_text"},
  {"id":"q7","text":"How do you prefer we handle disagreements about work?","format":"free_text"},
  {"id":"q8","text":"What does recognition that feels meaningful look like for you?","format":"free_text"},
  {"id":"q9","text":"What's a strength of yours that's underused here?","format":"free_text"},
  {"id":"q10","text":"What would make you feel more supported by me?","format":"free_text"},
  {"id":"q11","text":"How do you like to set and track shared goals?","format":"free_text"},
  {"id":"q12","text":"On a scale of 1-10, how comfortable do you feel raising concerns with me?","format":"scale","min":1,"max":10}
 ]$j$::jsonb);

-- ===========================================================================
-- Onboarding — PARENT ↔ TEEN (trust-first; ships later but seed exists)
-- ===========================================================================
insert into prompt_templates (kind, relationship_type, framework, title, description, source, questions) values
('onboarding','parent_child','emotion_coaching',
 'Parent & Teen — Getting to Know You',
 'Connection-first prompts that build trust without surveillance.',
 'seed',
 $j$[
  {"id":"q1","text":"What's something fun you'd want us to do together?","format":"free_text"},
  {"id":"q2","text":"When you're upset, what actually helps from me?","format":"free_text"},
  {"id":"q3","text":"What's something you're into right now that you'd like to share?","format":"free_text"},
  {"id":"q4","text":"What's one thing you wish I understood about your world?","format":"free_text"},
  {"id":"q5","text":"What's a way I could give you more space or trust?","format":"free_text"},
  {"id":"q6","text":"What are you proud of lately?","format":"free_text"},
  {"id":"q7","text":"When do you feel most listened to by me?","format":"free_text"},
  {"id":"q8","text":"What's something you'd like to be able to talk to me about more easily?","format":"free_text"},
  {"id":"q9","text":"What helps you most when you're stressed about school or friends?","format":"free_text"},
  {"id":"q10","text":"What's a goal you have that I could help with?","format":"free_text"}
 ]$j$::jsonb);

-- ===========================================================================
-- Daily question pool (source 'seed' starter set; Grok tops this up later)
-- ===========================================================================
insert into prompt_templates (kind, relationship_type, framework, title, source, questions) values
('daily','romantic','gottman_love_maps', 'Daily — Romantic', 'seed',
  $j$[{"id":"q1","text":"What was the best part of your day, and the hardest?","format":"free_text"}]$j$::jsonb),
('daily','romantic','active_constructive', 'Daily — Romantic', 'seed',
  $j$[{"id":"q1","text":"What's something you're looking forward to this week?","format":"free_text"}]$j$::jsonb),
('daily','friend',null, 'Daily — Friend', 'seed',
  $j$[{"id":"q1","text":"What's something good that happened to you recently?","format":"free_text"}]$j$::jsonb),
('daily','family',null, 'Daily — Family', 'seed',
  $j$[{"id":"q1","text":"What's one thing you're grateful for today?","format":"free_text"}]$j$::jsonb),
('daily','coworker',null, 'Daily — Coworker', 'seed',
  $j$[{"id":"q1","text":"What's a win from this week, however small?","format":"free_text"}]$j$::jsonb),
('daily',null,null, 'Daily — Anyone', 'seed',
  $j$[{"id":"q1","text":"What's on your mind today that you'd like to share?","format":"free_text"}]$j$::jsonb);

-- ===========================================================================
-- Quizzes (honestly framed)
-- ===========================================================================
insert into prompt_templates (kind, relationship_type, framework, title, description, source, config, questions) values
('quiz',null,'attachment',
 'Your Attachment Style',
 'A short reflection on how you relate to closeness. Educational, not diagnostic.',
 'seed',
 $c${"scoring":"dimensions","dimensions":["anxiety","avoidance"]}$c$::jsonb,
 $j$[
  {"id":"q1","text":"I worry about being abandoned by people close to me.","format":"scale","min":1,"max":5,"dimension":"anxiety"},
  {"id":"q2","text":"I find it hard to depend on others.","format":"scale","min":1,"max":5,"dimension":"avoidance"},
  {"id":"q3","text":"I need a lot of reassurance that I'm cared about.","format":"scale","min":1,"max":5,"dimension":"anxiety"},
  {"id":"q4","text":"I prefer not to show others how I feel deep down.","format":"scale","min":1,"max":5,"dimension":"avoidance"},
  {"id":"q5","text":"I get anxious when someone I care about is distant.","format":"scale","min":1,"max":5,"dimension":"anxiety"},
  {"id":"q6","text":"I'm uncomfortable when others want to be very close.","format":"scale","min":1,"max":5,"dimension":"avoidance"}
 ]$j$::jsonb),
('quiz',null,'love_languages',
 'How You Like to Give & Receive Care',
 'Popular framework, but note: research has not validated the "matching" idea. Use it as a conversation starter, not a rule.',
 'seed',
 $c${"scoring":"multi_select","note":"not_validated"}$c$::jsonb,
 $j$[
  {"id":"q1","text":"Which of these make you feel most cared for? (pick any that resonate)","format":"choice","options":["Kind words","Quality time","Thoughtful gifts","Helpful actions","Physical affection"]}
 ]$j$::jsonb);

-- ===========================================================================
-- Education library
-- ===========================================================================
insert into education_articles (slug,title,summary,body,category,relationship_type,framework,evidence_rating,is_premium) values
('four-horsemen',
 'The Four Horsemen (and their antidotes)',
 'Criticism, contempt, defensiveness, and stonewalling predict relationship distress — here is how to counter each.',
 E'Gottman''s research identifies four communication patterns that strongly predict relationship trouble.\n\n- **Criticism** → antidote: a gentle start-up ("I feel… I need…").\n- **Contempt** (the strongest predictor) → antidote: build appreciation and fondness.\n- **Defensiveness** → antidote: take responsibility for your part.\n- **Stonewalling** → antidote: self-soothe, take a break, then return.',
 'conflict', null, 'gottman', 5, false),
('bids-for-connection',
 'Bids for Connection: the small moments that matter',
 'Couples who "turn toward" small bids for attention stay together far more often.',
 E'A *bid* is any attempt to connect — a comment, a question, a touch. In Gottman''s research, couples who stayed together turned toward bids ~86% of the time; those who split, ~33%.\n\nPractice: notice your partner''s next bid and respond with genuine interest.',
 'communication', null, 'gottman', 5, false),
('attachment-basics',
 'Attachment styles, briefly',
 'Why some of us seek closeness and others pull away — and how to work with it.',
 E'Adult attachment varies along two dimensions: anxiety (fear of rejection) and avoidance (discomfort with closeness). Neither is a flaw. Knowing your patterns — and your person''s — helps you respond with compassion instead of reactivity.',
 'attachment', null, 'attachment', 5, false),
('36-questions',
 'The science behind "20 questions"',
 'Escalating mutual self-disclosure reliably builds closeness — even between strangers.',
 E'Aron''s closeness-generating procedure showed that taking turns answering increasingly personal questions builds real intimacy. That''s exactly why answering together — and only seeing each other''s answers once you''ve both shared — works.',
 'connection', null, 'aron', 4, false),
('repair-attempts',
 'Repair attempts: how to recover after conflict',
 'Repairing early and often matters more than never fighting.',
 E'A repair attempt is anything that de-escalates tension: humor, "I''m sorry," "let me try again," a hand on the shoulder. Masters of relationships repair early and often. This is a premium deep-dive with scripts for each situation.',
 'conflict', null, 'gottman', 4, true),
('parent-teen-emotion-coaching',
 'Emotion coaching for parents of teens',
 'Validate first, problem-solve second.',
 E'Emotion-coached kids regulate better and have stronger relationships. The five steps: notice the emotion, see it as a chance to connect, listen and validate, help name the feeling, then problem-solve together — keeping limits where needed.',
 'parenting', 'parent_child', 'gottman', 5, true);
