-- Every type gets a real "first 20". Family (12), coworker (12) and
-- parent–teen (10) onboarding packs were shorter than the product's
-- "20 questions" promise. Append questions in the same voice until each
-- pack has 20. Only templates still under 20 are touched, so re-running is
-- a no-op; existing instances already snapshotted their questions and are
-- unaffected.

-- Family: 12 → 20
update prompt_templates
   set questions = questions || $j$[
  {"id":"q13","text":"What's a role you played in our family growing up that you'd like to step out of?","format":"free_text"},
  {"id":"q14","text":"What's something our family doesn't talk about that you wish we could?","format":"free_text"},
  {"id":"q15","text":"When you're going through something hard, do you want me to check in, give space, or just show up?","format":"choice","options":["Check in","Give space","Just show up","It depends — ask me"]},
  {"id":"q16","text":"What's a way our family shows love without saying it?","format":"free_text"},
  {"id":"q17","text":"What's one thing you'd want me to understand about how you're really doing right now?","format":"free_text"},
  {"id":"q18","text":"On a scale of 1-10, how close do you feel to me right now?","format":"scale","min":1,"max":10},
  {"id":"q19","text":"What's a piece of family history you've always wondered about?","format":"free_text"},
  {"id":"q20","text":"What's something you'd want said about our family by the people who come after us?","format":"free_text"}
]$j$::jsonb
 where kind = 'onboarding' and relationship_type = 'family'
   and jsonb_array_length(questions) < 20;

-- Coworker: 12 → 20
update prompt_templates
   set questions = questions || $j$[
  {"id":"q13","text":"What's a part of your work you wish more people saw?","format":"free_text"},
  {"id":"q14","text":"What's a mistake you've learned the most from at work?","format":"free_text"},
  {"id":"q15","text":"When something falls between us, what should happen?","format":"choice","options":["I pick it up","You pick it up","We decide case by case","We talk before it's a problem"]},
  {"id":"q16","text":"What's a boundary around work you're trying to hold?","format":"free_text"},
  {"id":"q17","text":"What's something outside work you'd be happy for me to know about you?","format":"free_text"},
  {"id":"q18","text":"What's one thing you'd change about how we run things if you could?","format":"free_text"},
  {"id":"q19","text":"How clear are your priorities right now?","format":"scale","min":1,"max":10},
  {"id":"q20","text":"What would make you feel safer disagreeing with me?","format":"free_text"}
]$j$::jsonb
 where kind = 'onboarding' and relationship_type = 'coworker'
   and jsonb_array_length(questions) < 20;

-- Parent & teen: 10 → 20
update prompt_templates
   set questions = questions || $j$[
  {"id":"q11","text":"What's a rule at home that feels fair, and one that doesn't?","format":"free_text"},
  {"id":"q12","text":"What's something you're good at that you don't think I notice?","format":"free_text"},
  {"id":"q13","text":"When you're quiet, what do you want from me?","format":"choice","options":["Ask what's wrong","Wait for me","Just be nearby","Distract me"]},
  {"id":"q14","text":"What's a way I could react better when you tell me something hard?","format":"free_text"},
  {"id":"q15","text":"What's a decision you'd like to make on your own next time?","format":"free_text"},
  {"id":"q16","text":"What's a thing we used to do together that you miss?","format":"free_text"},
  {"id":"q17","text":"On a scale of 1-10, how heard do you feel at home?","format":"scale","min":1,"max":10},
  {"id":"q18","text":"What's something I say that lands differently than I mean it?","format":"free_text"},
  {"id":"q19","text":"What's a person you look up to, and why?","format":"free_text"},
  {"id":"q20","text":"What's something you want for your future that I could help with?","format":"free_text"}
]$j$::jsonb
 where kind = 'onboarding' and relationship_type = 'parent_child'
   and jsonb_array_length(questions) < 20;
