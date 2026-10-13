-- Electives depth for the non-romantic types. Roadmap item 10
-- (docs/ROADMAP.md). Friend, family, sibling, coworker, mentor and
-- parent–teen had one to three quizzes and challenges each (mentor had none
-- of its own). This adds two quizzes and two challenges per type, plus two
-- shared ones, in the same honest, non-diagnostic framing as 0005. Quizzes
-- use config.scoring = 'reflection' (side-by-side reveal, no verdict).
--
-- Idempotent: every row carries config.batch = '0024'.

do $$
begin
  if exists (select 1 from prompt_templates where config->>'batch' = '0024') then
    raise notice 'batch 0024 already seeded; skipping';
    return;
  end if;

insert into prompt_templates (kind, relationship_type, framework, title, description, source, config, questions) values

-- ===========================================================================
-- FRIEND
-- ===========================================================================
('quiz','friend','social_support',
 'How we show up for each other',
 'What support actually feels like to each of us, so we stop guessing.',
 'seed', $c${"scoring":"reflection","batch":"0024"}$c$::jsonb,
 $j$[
  {"id":"q1","text":"When I'm struggling, what I most want from a friend is…","format":"choice","options":["To be asked about it","To be distracted","Practical help","Just company, no talking"]},
  {"id":"q2","text":"I find it easy to ask you for help.","format":"scale","min":1,"max":5},
  {"id":"q3","text":"I'd want you to notice if I went quiet.","format":"scale","min":1,"max":5},
  {"id":"q4","text":"A time you supported me that I still think about:","format":"free_text"}
 ]$j$::jsonb),
('quiz','friend','self_expansion',
 'Our adventure appetite',
 'How much novelty each of us wants from this friendship right now.',
 'seed', $c${"scoring":"reflection","batch":"0024"}$c$::jsonb,
 $j$[
  {"id":"q1","text":"My ideal plan with you is…","format":"choice","options":["Something new every time","Our usual, done well","A mix","Spontaneous, whatever comes up"]},
  {"id":"q2","text":"I'd like us to try more new things together.","format":"scale","min":1,"max":5},
  {"id":"q3","text":"One thing on my list I'd want you along for:","format":"free_text"}
 ]$j$::jsonb),
('challenge','friend','gottman_fondness',
 'The origin story',
 'Retelling how a friendship began reliably refreshes fondness.',
 'seed', $c${"batch":"0024"}$c$::jsonb,
 $j$[{"id":"q1","text":"Tell the story of how we became friends, from your side. What did you notice about me first, and when did you know it would stick?","format":"free_text"}]$j$::jsonb),
('challenge','friend','social_support',
 'One favor, asked out loud',
 'Friendships deepen when asking for help is normal, not rare.',
 'seed', $c${"batch":"0024"}$c$::jsonb,
 $j$[{"id":"q1","text":"Name one real, specific favor you'd like from me this month (big or tiny). Then: how does it feel to ask?","format":"free_text"}]$j$::jsonb),

-- ===========================================================================
-- FAMILY
-- ===========================================================================
('quiz','family','family_systems',
 'Roles we fall into',
 'The parts we play in the family, and whether we still want them.',
 'seed', $c${"scoring":"reflection","batch":"0024"}$c$::jsonb,
 $j$[
  {"id":"q1","text":"In our family I'm usually the…","format":"choice","options":["Organizer","Peacemaker","Quiet one","Entertainer","Responsible one","Rebel"]},
  {"id":"q2","text":"I'm comfortable with the role I play.","format":"scale","min":1,"max":5},
  {"id":"q3","text":"A role I'd like you to see me outside of:","format":"free_text"},
  {"id":"q4","text":"A role I think you'd like to put down:","format":"free_text"}
 ]$j$::jsonb),
('quiz','family','gottman_rituals',
 'Holidays, honestly',
 'What each of us actually wants from family gatherings.',
 'seed', $c${"scoring":"reflection","batch":"0024"}$c$::jsonb,
 $j$[
  {"id":"q1","text":"The best part of a family gathering for me is…","format":"choice","options":["The food","The catching up","The traditions","The kids running around","Leaving"]},
  {"id":"q2","text":"I feel relaxed at our family gatherings.","format":"scale","min":1,"max":5},
  {"id":"q3","text":"One thing that would make the next one better for me:","format":"free_text"}
 ]$j$::jsonb),
('challenge','family','gottman_shared_meaning',
 'The object that matters',
 'Objects carry family stories; telling them builds shared meaning.',
 'seed', $c${"batch":"0024"}$c$::jsonb,
 $j$[{"id":"q1","text":"Pick one object from our family (a dish, a photo, a tool, a chair) and tell its story as you remember it. What would you want it to mean to the next person who has it?","format":"free_text"}]$j$::jsonb),
('challenge','family','active_constructive',
 'Say it before the funeral',
 'The appreciation people save for eulogies lands better now.',
 'seed', $c${"batch":"0024"}$c$::jsonb,
 $j$[{"id":"q1","text":"Write the three sentences about me you'd want said at my 80th birthday. Then say them to me this week, in person or on a call.","format":"free_text"}]$j$::jsonb),

-- ===========================================================================
-- SIBLING
-- ===========================================================================
('quiz','sibling','family_systems',
 'Same house, different childhoods',
 'Siblings grow up in the same home and remember different families.',
 'seed', $c${"scoring":"reflection","batch":"0024"}$c$::jsonb,
 $j$[
  {"id":"q1","text":"Growing up, our house felt mostly…","format":"choice","options":["Warm","Busy","Tense","Quiet","Unpredictable","Fun"]},
  {"id":"q2","text":"I felt treated fairly compared to you.","format":"scale","min":1,"max":5},
  {"id":"q3","text":"Something you had that I wanted:","format":"free_text"},
  {"id":"q4","text":"Something I think you carried that I didn't have to:","format":"free_text"}
 ]$j$::jsonb),
('quiz','sibling','gottman_rituals',
 'How we want to be in touch',
 'Frequency, format and feeling, without the guilt.',
 'seed', $c${"scoring":"reflection","batch":"0024"}$c$::jsonb,
 $j$[
  {"id":"q1","text":"The amount we're in touch right now feels…","format":"choice","options":["Just right","Too little","Like an obligation","Hard to say"]},
  {"id":"q2","text":"I'd reach out more if I knew it was welcome.","format":"scale","min":1,"max":5},
  {"id":"q3","text":"A small ritual that would keep us close (a weekly text, a monthly call, a yearly trip):","format":"free_text"}
 ]$j$::jsonb),
('challenge','sibling','repair',
 'The thing we never said',
 'Old sibling hurts shrink when named kindly and heard without defense.',
 'seed', $c${"batch":"0024"}$c$::jsonb,
 $j$[{"id":"q1","text":"Name one old thing between us you'd be willing to put down, and what you'd need to hear to do it. (Say it kindly; the other person's job is only to listen.)","format":"free_text"}]$j$::jsonb),
('challenge','sibling','gottman_fondness',
 'Kid photo, adult story',
 'A shared childhood image is the fastest route back to fondness.',
 'seed', $c${"batch":"0024"}$c$::jsonb,
 $j$[{"id":"q1","text":"Find one photo of us as kids and send it to each other this week. Then write what you remember from around that time, and what you'd tell those two kids now.","format":"free_text"}]$j$::jsonb),

-- ===========================================================================
-- COWORKER
-- ===========================================================================
('quiz','coworker','role_clarity',
 'Who owns what',
 'Where the lines are clear between us, and where they blur.',
 'seed', $c${"scoring":"reflection","batch":"0024"}$c$::jsonb,
 $j$[
  {"id":"q1","text":"I'm clear on what's mine versus yours.","format":"scale","min":1,"max":5},
  {"id":"q2","text":"When something falls between us, it usually…","format":"choice","options":["Gets picked up by me","Gets picked up by you","Gets dropped","Gets talked about"]},
  {"id":"q3","text":"One handoff between us that could be cleaner:","format":"free_text"},
  {"id":"q4","text":"One thing I'd like to own more of:","format":"free_text"}
 ]$j$::jsonb),
('quiz','coworker','feedback',
 'Feedback, the way we each want it',
 'Timing, format and tone, so feedback lands instead of bouncing.',
 'seed', $c${"scoring":"reflection","batch":"0024"}$c$::jsonb,
 $j$[
  {"id":"q1","text":"I'd rather get hard feedback…","format":"choice","options":["Right away, privately","Written, then talked through","In our next 1:1","With a concrete example first"]},
  {"id":"q2","text":"I feel safe giving you honest feedback.","format":"scale","min":1,"max":5},
  {"id":"q3","text":"A piece of feedback I've been sitting on (said kindly):","format":"free_text"}
 ]$j$::jsonb),
('challenge','coworker','psychological_safety',
 'The blameless debrief',
 'Teams that review mistakes without blame learn faster and trust more.',
 'seed', $c${"batch":"0024"}$c$::jsonb,
 $j$[{"id":"q1","text":"Pick one thing that went wrong recently that involved us both. Without naming fault: what did you see, what would you do differently, and what should we change so it's easier next time?","format":"free_text"}]$j$::jsonb),
('challenge','coworker','active_constructive',
 'Credit, out loud',
 'Specific public credit is the cheapest trust-builder in a workplace.',
 'seed', $c${"batch":"0024"}$c$::jsonb,
 $j$[{"id":"q1","text":"Name one specific thing the other person did well recently that you'll credit them for in front of someone else this week. Then say who you'll tell, and when.","format":"free_text"}]$j$::jsonb),

-- ===========================================================================
-- MENTOR / MENTEE
-- ===========================================================================
('quiz','mentor','developmental_network',
 'What this relationship is for',
 'Advice, doors, accountability or a sounding board: name the mix.',
 'seed', $c${"scoring":"reflection","batch":"0024"}$c$::jsonb,
 $j$[
  {"id":"q1","text":"The most useful thing I get from our conversations is…","format":"choice","options":["Advice","Introductions","Accountability","Perspective","Confidence"]},
  {"id":"q2","text":"Our conversations are the right frequency.","format":"scale","min":1,"max":5},
  {"id":"q3","text":"One thing I'd like more of from this relationship:","format":"free_text"},
  {"id":"q4","text":"One thing I think I give the other person:","format":"free_text"}
 ]$j$::jsonb),
('quiz','mentor','goal_setting',
 'Six months from now',
 'A shared picture of what progress would look like.',
 'seed', $c${"scoring":"reflection","batch":"0024"}$c$::jsonb,
 $j$[
  {"id":"q1","text":"Six months from now I'd call it a win if…","format":"free_text"},
  {"id":"q2","text":"I'm clear on what I'm working toward.","format":"scale","min":1,"max":5},
  {"id":"q3","text":"The biggest thing in the way is…","format":"choice","options":["Time","Confidence","A skill gap","The wrong environment","I'm not sure"]},
  {"id":"q4","text":"What I'd want the other person to hold me to:","format":"free_text"}
 ]$j$::jsonb),
('challenge','mentor','feedback',
 'The hard question',
 'Mentoring works when the mentee asks what they are afraid to ask.',
 'seed', $c${"batch":"0024"}$c$::jsonb,
 $j$[{"id":"q1","text":"Write the one question you've been afraid to ask the other person, and why it's been hard to ask. (Mentor: write the one piece of feedback you've been holding back, and why.)","format":"free_text"}]$j$::jsonb),
('challenge','mentor','developmental_network',
 'One door, opened',
 'Introductions are the most concrete thing a mentor can give.',
 'seed', $c${"batch":"0024"}$c$::jsonb,
 $j$[{"id":"q1","text":"Mentee: name one person or room you'd want an introduction to, and what you'd do with it. Mentor: name one introduction you could make this month, and what you'd want the mentee to prepare first.","format":"free_text"}]$j$::jsonb),

-- ===========================================================================
-- PARENT & TEEN
-- ===========================================================================
('quiz','parent_child','autonomy_support',
 'Freedom and trust',
 'Where each of you thinks the line is, and how trust gets built.',
 'seed', $c${"scoring":"reflection","batch":"0024"}$c$::jsonb,
 $j$[
  {"id":"q1","text":"Right now, the amount of say I (the teen) have over my own time feels…","format":"choice","options":["Fair","A bit tight","Way too tight","More than I expected"]},
  {"id":"q2","text":"I feel trusted at home.","format":"scale","min":1,"max":5},
  {"id":"q3","text":"One thing that would help me trust more, or feel more trusted:","format":"free_text"},
  {"id":"q4","text":"One rule I'd keep exactly as it is:","format":"free_text"}
 ]$j$::jsonb),
('quiz','parent_child','emotion_coaching',
 'When I''m upset',
 'What each of you wants from the other in a hard moment.',
 'seed', $c${"scoring":"reflection","batch":"0024"}$c$::jsonb,
 $j$[
  {"id":"q1","text":"When I'm upset, the first thing I want is…","format":"choice","options":["Space","To be asked what's wrong","A hug","Help fixing it","Distraction"]},
  {"id":"q2","text":"I can tell when the other person is upset.","format":"scale","min":1,"max":5},
  {"id":"q3","text":"Something the other person does that helps when I'm upset:","format":"free_text"},
  {"id":"q4","text":"Something that makes it worse, even if well-meant:","format":"free_text"}
 ]$j$::jsonb),
('challenge','parent_child','family_rituals',
 'Teach me something',
 'Role reversal builds respect both ways.',
 'seed', $c${"batch":"0024"}$c$::jsonb,
 $j$[{"id":"q1","text":"Teen: teach your parent one thing from your world this week (a game, an app, a song, a skill). Parent: learn it properly. Both: what surprised you about being on the other side?","format":"free_text"}]$j$::jsonb),
('challenge','parent_child','autonomy_support',
 'One decision, handed over',
 'Trust grows when responsibility is given before it is proven.',
 'seed', $c${"batch":"0024"}$c$::jsonb,
 $j$[{"id":"q1","text":"Parent: name one decision you'll hand fully to the teen this month. Teen: name how you'll handle it and what you'd want the parent to do if it goes wrong. Afterward, both: how did it go?","format":"free_text"}]$j$::jsonb),

-- ===========================================================================
-- SHARED (any type)
-- ===========================================================================
('quiz',null,'gottman_love_maps',
 'How well do I know you right now?',
 'Not childhood trivia: the current version of each other.',
 'seed', $c${"scoring":"reflection","batch":"0024"}$c$::jsonb,
 $j$[
  {"id":"q1","text":"My guess at what's stressing you most right now:","format":"free_text"},
  {"id":"q2","text":"My guess at what you're most looking forward to:","format":"free_text"},
  {"id":"q3","text":"My guess at your current favorite way to unwind:","format":"free_text"},
  {"id":"q4","text":"How well do I think I know what's going on in your world?","format":"scale","min":1,"max":10}
 ]$j$::jsonb),
('challenge',null,'gottman_bids',
 'A week of noticing',
 'Turning toward small bids for attention is the strongest predictor of lasting closeness.',
 'seed', $c${"batch":"0024"}$c$::jsonb,
 $j$[{"id":"q1","text":"For one week, notice the small moments the other person reaches for you (a comment, a link, a sigh, a question). At the end: which ones did you catch, which did you miss, and what did it feel like to pay attention on purpose?","format":"free_text"}]$j$::jsonb);

end $$;
