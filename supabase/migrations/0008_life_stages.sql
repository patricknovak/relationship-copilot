-- Life-stage content packs: the transitions where relationships most need
-- support — becoming parents, co-parenting after separation, caring for an
-- aging parent together, and grief & endings. All run on the existing prompt
-- engine (electives chosen by the pair; nothing is pushed unsolicited) and
-- follow the house rules: balanced, non-diagnostic, both perspectives equal.

insert into prompt_templates (kind, relationship_type, framework, title, description, source, questions) values

-- ---------------------------------------------------------------------------
-- New parents (romantic couples)
-- ---------------------------------------------------------------------------
('challenge','romantic','gottman_new_parent',
 'The new-parent reset',
 'A short check-in for couples in the newborn/young-kid trenches. Research says satisfaction dips here for most couples — naming it together is how you protect the friendship underneath.',
 'seed',
 $j$[
  {"id":"q1","text":"What part of the daily load feels heaviest for you right now?","format":"free_text"},
  {"id":"q2","text":"What is one thing your partner has done since the baby came that you are quietly grateful for?","format":"free_text"},
  {"id":"q3","text":"How fair does the split of work (paid + unpaid) feel right now?","format":"scale","min":1,"max":5},
  {"id":"q4","text":"If we could reclaim 30 minutes a week just for us, what would you want to do with it?","format":"free_text"},
  {"id":"q5","text":"What do you need more of from me right now: help, rest, affection, or patience?","format":"choice","options":["Help","Rest","Affection","Patience"]}
 ]$j$::jsonb),

('quiz','romantic','gottman_new_parent',
 'Who does what? (the invisible load)',
 'Each of you maps who currently carries each part of family life. Seeing the two maps side by side is the point — no scoring, no winner.',
 'seed',
 $j$[
  {"id":"q1","text":"Who tends to notice what needs doing (appointments, supplies, plans) before it is urgent?","format":"choice","options":["Mostly me","Mostly them","Pretty even","Neither of us"]},
  {"id":"q2","text":"Who does more of the night/early-morning care right now?","format":"choice","options":["Mostly me","Mostly them","Pretty even","Not applicable"]},
  {"id":"q3","text":"One task I would love to hand over for a week is...","format":"free_text"},
  {"id":"q4","text":"One task I know the other person carries that I rarely acknowledge is...","format":"free_text"}
 ]$j$::jsonb),

-- ---------------------------------------------------------------------------
-- Co-parenting (family — incl. separated/divorced parents raising kids together)
-- ---------------------------------------------------------------------------
('challenge','family','co_parenting',
 'Co-parenting check-in',
 'For two adults raising kids together — together or apart. Focused on the kids and the logistics, with a habit of catching what is going well.',
 'seed',
 $j$[
  {"id":"q1","text":"What is one thing that went well for the kids since we last checked in?","format":"free_text"},
  {"id":"q2","text":"Is there an upcoming handoff, event, or decision we should align on?","format":"free_text"},
  {"id":"q3","text":"How consistent do the rules and routines feel across both of us lately?","format":"scale","min":1,"max":5},
  {"id":"q4","text":"One thing the other parent did recently that was good for the kids is...","format":"free_text"}
 ]$j$::jsonb),

-- ---------------------------------------------------------------------------
-- Caregiving (siblings/family coordinating care for an aging parent)
-- ---------------------------------------------------------------------------
('challenge','sibling','caregiving',
 'Caring for a parent, together',
 'When siblings share the care of a parent, resentment grows in the gaps nobody talks about. This makes the load and the worries visible to both of you.',
 'seed',
 $j$[
  {"id":"q1","text":"What part of the caregiving load are you carrying that you think the other person may not fully see?","format":"free_text"},
  {"id":"q2","text":"What worries you most about the months ahead?","format":"free_text"},
  {"id":"q3","text":"How sustainable does your share of the load feel right now?","format":"scale","min":1,"max":5},
  {"id":"q4","text":"Is there a decision coming (care, money, living situation) we should face together rather than alone?","format":"free_text"},
  {"id":"q5","text":"What is one way the other person has shown up for our parent that you admire?","format":"free_text"}
 ]$j$::jsonb),

('challenge','family','caregiving',
 'Caring for a parent, together',
 'When family members share the care of a parent, resentment grows in the gaps nobody talks about. This makes the load and the worries visible to both of you.',
 'seed',
 $j$[
  {"id":"q1","text":"What part of the caregiving load are you carrying that you think the other person may not fully see?","format":"free_text"},
  {"id":"q2","text":"What worries you most about the months ahead?","format":"free_text"},
  {"id":"q3","text":"How sustainable does your share of the load feel right now?","format":"scale","min":1,"max":5},
  {"id":"q4","text":"Is there a decision coming (care, money, living situation) we should face together rather than alone?","format":"free_text"}
 ]$j$::jsonb),

-- ---------------------------------------------------------------------------
-- Grief & endings (all relationship types)
-- ---------------------------------------------------------------------------
('challenge',null,'grief',
 'Remembering together',
 'For two people grieving the same loss. People grieve differently — one talks, one goes quiet — and both are normal. This is a gentle space to share without fixing.',
 'seed',
 $j$[
  {"id":"q1","text":"What is a memory of them that has been visiting you lately?","format":"free_text"},
  {"id":"q2","text":"What does your grief tend to look like day to day — and what helps, even a little?","format":"free_text"},
  {"id":"q3","text":"Is there a way you would like us to remember or honor them together?","format":"free_text"},
  {"id":"q4","text":"What is one thing you need the other person to know about where you are right now?","format":"free_text"}
 ]$j$::jsonb),

('challenge',null,'repair',
 'Repair after a rupture',
 'Every close relationship has ruptures; the strong ones repair. Each of you reflects on the same recent conflict — own your side, hear theirs.',
 'seed',
 $j$[
  {"id":"q1","text":"In the recent conflict, what was the feeling underneath your reaction (hurt, fear, feeling unseen, something else)?","format":"free_text"},
  {"id":"q2","text":"What part of how it went do you wish you had handled differently?","format":"free_text"},
  {"id":"q3","text":"What do you imagine it felt like from the other person's side?","format":"free_text"},
  {"id":"q4","text":"What would help you feel fully repaired — an acknowledgment, a change, time, something else?","format":"free_text"}
 ]$j$::jsonb);

-- ---------------------------------------------------------------------------
-- Education library: life-stage articles (free — these are the moments people
-- need help most, so they are not paywalled).
-- ---------------------------------------------------------------------------
insert into education_articles (slug,title,summary,body,category,relationship_type,life_stage,framework,evidence_rating,is_premium) values
('new-parents-protect-the-friendship',
 'Becoming parents without losing the couple',
 'Most couples'' satisfaction dips after a baby arrives. The couples who weather it protect small rituals of friendship and divide the invisible load on purpose.',
 E'Roughly two-thirds of couples report a drop in relationship satisfaction in the first years of parenthood — you are not failing, you are in the hardest stretch.\n\nWhat helps, per longitudinal research on new parents:\n\n- **Name the invisible load.** Noticing, planning, and remembering are work. Make the full list visible and divide it deliberately, not by default.\n- **Keep micro-rituals.** Six minutes of real conversation at a handoff beats a rare date night that never happens. Small and reliable wins.\n- **Assume good faith under exhaustion.** Sleep deprivation makes everyone''s worst read of each other more available. Delay big judgments.\n- **Appreciate out loud.** Fondness is protective; it atrophies silently when everything is logistics.\n\nIf resentment has hardened or contempt is creeping in, a couples therapist who knows the perinatal period is a strength, not a defeat.',
 'life_stage','romantic','new_parent','gottman',4,false),

('sharing-care-for-aging-parent',
 'Sharing the care of an aging parent',
 'Caregiving strains sibling and family relationships through invisible imbalance and unspoken decisions. Regular, explicit coordination protects both the parent and the relationship.',
 E'When a parent starts needing care, old family roles resurface and the load almost never lands evenly. The caregiver who lives closest typically absorbs the most — and the least visible — work.\n\nWhat protects the relationship:\n\n- **Make the load explicit.** List everything (visits, finances, calls, paperwork, emotional support). Imbalance you can see can be negotiated; imbalance you can''t becomes resentment.\n- **Decide how you will decide.** Agree early on how care, money, and living decisions get made — before a crisis forces it at the worst moment.\n- **Credit different currencies.** Money, time, proximity, and emotional labor are all real contributions, and they are not interchangeable for everyone.\n- **Watch for burnout.** A sustainable 70% beats an exhausted 110%. Respite care and outside help are care too.\n\nCaring for the relationship between caregivers is part of caring for the parent.',
 'life_stage',null,'caregiving',null,3,false),

('grieving-differently-together',
 'Grieving together when you grieve differently',
 'One of you talks, one goes quiet; one cries, one organizes. Different grieving styles are normal — and a common source of secondary hurt between people sharing a loss.',
 E'Grief research distinguishes **intuitive** grieving (feeling-led: tears, talking, waves of emotion) from **instrumental** grieving (doing-led: tasks, projects, problem-solving). Most people blend both; pairs rarely match.\n\nThe trap is reading the other person''s style as a verdict: "they don''t care" (because they are quiet) or "they are wallowing" (because they are not). Both readings add a second loss on top of the first.\n\nWhat helps:\n\n- **Say your style out loud.** "I need to talk about her" / "I cope by staying busy" turns a silent mismatch into a known difference.\n- **Don''t fix; witness.** Most grieving people need their loss seen, not solved.\n- **Mark moments together.** Anniversaries and rituals — a meal, a place, a story retold — let different grievers meet in one act.\n- **Oscillation is healthy.** Moving between facing the loss and taking a break from it is how grief works, not avoidance.\n\nIf grief stays at full intensity many months on, or daily life never resumes, grief-specific therapy genuinely helps.',
 'life_stage',null,'grief',null,4,false);
