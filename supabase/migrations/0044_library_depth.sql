-- Library depth. The six flagship reads seeded in 0003 (including both
-- Premium ones) were 40 to 70 words each, friends had no reads at all, and
-- family had none written for it specifically, while the site promised
-- "deeper premium library reads" and leads its marketing with friends.
--
-- This migration:
--   1. Deepens the six 0003 reads. Each update only touches a row whose body
--      is still the short seed (under 600 characters), so re-running is a
--      no-op and a later hand edit is never overwritten.
--   2. Adds five reads: two for friends, one for adult children and their
--      parents, one for partners, and one Premium read on friendship
--      conflict. Inserts skip existing slugs.
--
-- House rules, as before: say how strong the evidence is, name the research
-- without overclaiming it, and never present any of this as therapy.

-- 1. Deepen the 0003 reads ----------------------------------------------------

update public.education_articles set
  summary = 'Criticism, contempt, defensiveness and stonewalling predict relationship distress in decades of observational research. Each has a learnable antidote.',
  body = $b$John Gottman and colleagues spent decades filming couples talking through a disagreement and following them for years afterwards. Four ways of fighting stood out as early warnings of trouble. Gottman called them the four horsemen. None of them means a relationship is doomed; everyone uses them sometimes. What matters is how often, and whether you notice and switch.

**1. Criticism, and the gentle start-up**

A complaint is about a behaviour ("the bins didn't go out"). Criticism is about the person ("you never think about anyone else"). Criticism invites a defence, not a change.

The antidote is a gentle start-up: describe what happened, say how you feel, ask for what you need. "I'm frustrated the bins didn't go out again. Can we sort out who does them?" How a conversation starts predicts how it ends remarkably well in this research, so the first sentence carries most of the weight.

**2. Contempt, and a culture of appreciation**

Contempt is criticism from above: sarcasm, mockery, eye-rolling, a tone that says "I'm better than you". In Gottman's studies it was the single strongest predictor of later separation.

The antidote is not suppressing irritation but building the opposite habit on ordinary days: noticing what the other person does right and saying so. Contempt grows where appreciation has gone quiet.

**3. Defensiveness, and taking responsibility**

Defensiveness is self-protection: excuses, counter-attacks ("well, you…"), innocent-victim stories. It is understandable and it almost never works, because it tells the other person their complaint is not being heard.

The antidote is to accept responsibility for even a small part. "You're right, I said I'd do it and didn't." One sentence of ownership lowers the temperature more than a paragraph of explanation.

**4. Stonewalling, and self-soothing**

Stonewalling is shutting down: going silent, looking away, leaving the conversation without leaving the room. It is often a sign of being physiologically flooded, when heart rate and stress hormones rise so far that listening becomes almost impossible.

The antidote is a real break with a promise to return. Say you need it, agree a time (Gottman suggests at least twenty minutes), and do something genuinely calming rather than rehearsing your case. Then come back.

**Using this with your person**

- Learn the four names together. Being able to say "that felt like contempt" turns a fight into something you can both look at.
- Pick one horseman you each lean on and practise its antidote for a month.
- Notice the ratio. In Gottman's work, stable couples had roughly five positive moments for every negative one even during conflict. Warmth outside the argument is what lets the argument be survivable.

**How strong is the evidence?** The four patterns come from long-running observational studies of couples and have been replicated and widely taught. The research is strongest for romantic couples; the same patterns show up in friendships and families, but they have been studied there far less. Prediction figures from these studies apply to groups, not to any one relationship.$b$
where slug = 'four-horsemen' and length(body) < 600;

update public.education_articles set
  summary = 'A bid is any small attempt to connect. In Gottman''s lab studies, how often people turned toward each other''s bids separated the couples who lasted from those who did not.',
  body = $b$A bid is any attempt to get another person's attention, interest or support. Most are tiny. "Look at that." A sigh. A link sent without comment. "How was the dentist?" A hand on a shoulder.

In John Gottman's studies of newlywed couples, researchers watched how partners answered these small moments. There are three ways to respond:

- **Turning toward:** noticing and engaging, even briefly. "Ha, that's amazing." "It was fine, thanks for asking."
- **Turning away:** missing or ignoring it, usually without meaning to, because you were busy or distracted.
- **Turning against:** answering with irritation. "Can't you see I'm working?"

Couples who were still together six years later had turned toward each other's bids far more often than couples who had separated. The widely quoted figures are about 86% versus 33%. The striking part is how small the moments were. These were not grand gestures or deep talks; they were the many ordinary chances to say "I see you" every day.

**Why the small stuff carries so much weight**

Each response is a tiny answer to a bigger question: do you care about what matters to me? A missed bid now and then means nothing. A pattern of missed bids teaches people to stop bidding, and a relationship where nobody reaches out anymore can feel lonely long before anyone names a problem.

Bids are also how people test the water before saying something harder. Someone who mentions a stressful meeting in passing may be checking whether it is safe to talk about it properly.

**Practising it**

- **Notice the disguised ones.** Many bids do not sound like requests. "The neighbours are at it again" can mean "talk to me".
- **A small turn counts.** You do not need to drop everything. "I want to hear about it. Give me ten minutes?" is turning toward.
- **Make your own bids clearer.** If you need attention, say so. "Can I tell you about my day?" is easier to catch than a sigh.
- **Watch your phone.** Screens are the most common reason bids are missed now. Try putting it face down when the other person starts talking.

This works for every kind of relationship. Friends, siblings, parents and teenagers all make bids, and turning toward them is how closeness is built between bigger moments. Answering a daily question together is itself a bid, repeated: each answer says "here is something about me" and each reveal says "I wanted to know".

**How strong is the evidence?** The turning-toward findings come from observational studies of couples by Gottman and colleagues and are among the most cited in relationship research. The exact percentages come from a specific study population, so treat them as an illustration of the pattern rather than a law.$b$
where slug = 'bids-for-connection' and length(body) < 600;

update public.education_articles set
  summary = 'Why some of us reach for closeness and others pull back under stress, what the two dimensions of adult attachment mean, and how to work with them.',
  body = $b$Attachment theory began with John Bowlby and Mary Ainsworth's work on how infants seek comfort from their caregivers. In the 1980s, researchers including Cindy Hazan and Phillip Shaver found that adults show similar patterns in their close relationships, especially under stress.

**Two dimensions, not four boxes**

Modern research describes adult attachment along two dimensions:

- **Anxiety:** how much you worry about rejection or being left, and how much reassurance you need.
- **Avoidance:** how uncomfortable you are with depending on others or having them depend on you.

Someone low on both is usually called secure: comfortable with closeness and with independence. High anxiety can look like checking, seeking reassurance, reading silence as trouble. High avoidance can look like pulling away when things get emotional, valuing self-reliance, changing the subject.

Most people sit somewhere in the middle on both, and your position can differ from one relationship to another. You might be quite secure with a sibling and anxious with a new partner.

**What it explains**

Attachment patterns matter most under stress. When something feels threatening, people with higher anxiety tend to move toward the other person and people with higher avoidance tend to move away. Put one of each in the same relationship and you get a familiar loop: one pursues, the other withdraws, which makes the first pursue harder.

Seeing the loop is often more useful than blaming either side. The anxious move is a bid for reassurance; the avoidant move is a bid for calm. Both are trying to make things feel safe.

**What helps**

- **Name your own pattern, not theirs.** "When you go quiet I start imagining the worst" lands better than "you're avoidant".
- **Offer what the other person needs to feel safe.** For anxiety, that is often predictability: say when you will be back. For avoidance, it is often space without punishment: a break that is respected.
- **Remember it can change.** Research on "earned security" shows that people can become more secure over time, often through relationships that are consistently responsive.

**What attachment is not**

It is not a diagnosis, a personality label or a verdict on a relationship. The short reflection in your profile is educational, gives a rough picture only, and is never used to judge anyone.

**How strong is the evidence?** Attachment is one of the most researched frameworks in relationship science, with decades of studies across cultures. The two-dimension model is well supported. Online quizzes, including ours, are rough indicators rather than validated assessments.$b$
where slug = 'attachment-basics' and length(body) < 600;

update public.education_articles set
  summary = 'In a 1997 study, strangers who took turns answering increasingly personal questions felt closer in 45 minutes than pairs making small talk. The mechanism is what matters.',
  body = $b$In 1997, psychologist Arthur Aron and colleagues published a study with a simple design. Pairs of strangers spent about 45 minutes taking turns answering three sets of questions. The sets became steadily more personal, from "Would you like to be famous? In what way?" to questions about family, regrets and what each person valued in the other. Comparison pairs spent the same time on small-talk questions.

The pairs who answered the escalating questions reported feeling significantly closer to each other. Some of the original pairs stayed in touch. The procedure has since been used in hundreds of studies as a reliable way to create closeness in a lab.

The list later became famous as "the 36 questions to fall in love". That was never the claim. The study was about closeness, not romance, and it worked between strangers of any combination.

**Why it works**

Three ingredients do the work, and none of them is magic wording:

- **Disclosure.** Each person shares something real about themselves.
- **Reciprocity.** It is turn-taking. Nobody is exposed alone; each disclosure is matched.
- **Escalation.** The questions get deeper gradually, so trust builds at a pace both people can follow.

Responsiveness completes it. Later research on intimacy finds that disclosure builds closeness when the listener responds with understanding and care. Sharing into silence does not have the same effect.

**How Relationship Copilot uses this**

The mutual reveal is built on the same ingredients. You both answer the same question, in private, before either of you sees the other's words. That makes the disclosure reciprocal by design: nobody goes first and nobody is left exposed. The first questions start lighter and go deeper, and the daily question keeps the habit going. Reactions and the discussion after a reveal are where responsiveness happens.

**Using the idea anywhere**

- **Take turns.** Whatever you talk about, avoid one person carrying all the disclosure.
- **Go one level deeper than usual.** Not "how was your day" but "what was the best part of your day, and why".
- **Respond before you relate.** When someone shares, reflect what you heard before telling your own similar story.

**How strong is the evidence?** The closeness effect has replicated well across many studies, with strangers, roommates and pairs from different groups. Effects on long-term relationships are less studied; it is a reliable way to start closeness, not a guarantee of keeping it.$b$
where slug = '36-questions' and length(body) < 600;

update public.education_articles set
  summary = 'Every relationship has ruptures; the strong ones repair them early and often. What repair attempts are, why they fail, and words for the moments that need them.',
  body = $b$People in good relationships still argue, misread each other and say things they regret. One of the clearest findings in John Gottman's research is that what separates lasting relationships is not the absence of conflict but the success of repair: the small moves that stop a fight from escalating, and the conversations afterwards that put things right.

A repair attempt is anything, said or done, that de-escalates. Humour, a touch, "can we start again?", "I'm getting defensive", "you're right about that part". Most are clumsy. That is fine.

**Why repair attempts fail**

The surprising finding is that whether a repair attempt works depends less on how skilful it is than on the state of the relationship it lands in. Gottman calls it positive or negative sentiment override. When there is a reserve of goodwill, even an awkward joke is heard as "I don't want to fight". When goodwill has run low, even a perfect apology is heard as manipulation.

So repair is built in two places: in the moment, and on ordinary days when nothing is wrong. Appreciation, turning toward each other's small bids and time together are what make in-the-moment repair possible.

**In the moment: words that work**

Gottman's research group collected phrases that couples used successfully. You do not need special words, but having a few ready helps when you are flooded:

- **Feelings:** "I'm feeling defensive. Can you say that more gently?" / "That hurt. Can we slow down?"
- **Sorry:** "I overreacted. I'm sorry." / "Let me try that again."
- **Getting to yes:** "You're right about that part." / "Let's find something we agree on."
- **Stop:** "I need a break. Can we pick this up at eight?" / "Let's agree to disagree for now."
- **I appreciate:** "I know this isn't easy for you either." / "Thank you for staying in this conversation."

Agreeing on a signal in advance, a word or a gesture that means "I'm trying to repair", makes it much easier to hear one when it comes.

**Taking a break properly**

When heart rate climbs high enough, people physically struggle to listen. A break works only if it calms you down: at least twenty minutes, doing something absorbing, not rehearsing your argument. And it only works if you come back. A break without a return is stonewalling.

**Afterwards: repairing the injury**

Some fights leave a mark that a quick "sorry" does not reach. A fuller repair conversation, adapted from Gottman's "aftermath of a fight" exercise, goes in order:

1. **Feelings.** Each person names what they felt, without explaining why yet. "I felt dismissed, and lonely."
2. **Realities.** Each describes how it looked from their side, and the other summarises it back until it is heard right. Two realities can both be true.
3. **Triggers.** What old sore spot did this touch? "When I'm interrupted I'm back at my family's dinner table."
4. **Ownership.** Each names their own part, however small. "I was already stressed and I took it out on you."
5. **Next time.** One concrete thing each person will do differently.

The goal is not to agree on what happened. It is for each person to feel understood.

**When repair isn't enough**

If repairs repeatedly fail, contempt is frequent, or one person feels afraid, outside help is a strength. A couples or family therapist can see patterns that are invisible from inside. If anyone is unsafe, our Safety page lists free, confidential support.

**How strong is the evidence?** Repair and sentiment override come from Gottman's long-term observational research with couples and are central to well-studied therapy approaches. The scripts are practical tools drawn from that work rather than individually tested interventions.$b$
where slug = 'repair-attempts' and length(body) < 600;

update public.education_articles set
  summary = 'Teens who feel their emotions are taken seriously regulate better and tell their parents more. The five steps of emotion coaching, adapted for adolescence, with words to use.',
  body = $b$Emotion coaching comes from research by John Gottman, Lynn Katz and Carole Hooven in the 1990s. They studied how parents talk to children about feelings and found a clear pattern: children whose parents treated emotions as worth understanding, rather than as problems to be stopped, went on to regulate their own emotions better, got on better with peers and did better at school.

Later work by Sophie Havighurst and colleagues adapted the approach for parents of adolescents in a programme called Tuning in to Teens. In randomised trials, teens of parents who took the programme showed fewer emotional and behavioural difficulties than those in comparison groups.

**The five steps, adapted for teens**

1. **Notice the emotion, especially the small version.** Teens rarely announce feelings. Irritability, a closed door or "whatever" are often the visible edge of something bigger. Coaching is easiest when the feeling is still small.
2. **See it as a chance to connect, not a fire to put out.** A teen's distress is an opening. You do not have to fix it, only be with it for a moment.
3. **Listen and validate before anything else.** Validation means communicating that the feeling makes sense, not that the behaviour was fine. "That sounds really embarrassing" before "well, you shouldn't have posted it".
4. **Help name the feeling.** Teens often have one word for many feelings ("annoyed"). Offering a more precise word ("it sounds like you felt left out") helps them make sense of it. Offer, don't impose: "is it more like disappointed, or more like hurt?"
5. **Problem-solve together, with limits where needed.** Only once the feeling has been heard. Ask what they want to do. Keep the non-negotiables (safety, respect) clear and calm. All feelings are acceptable; not all behaviour is.

**Words that open, and words that close**

- Opens: "That sounds hard." / "Tell me more." / "I'd be upset too." / "What would help right now?"
- Closes: "It's not a big deal." / "You're overreacting." / "When I was your age…" / an immediate solution.

**What makes it hard with teenagers**

- **Timing.** Teens often talk late at night, in the car or while doing something else. Side-by-side moments feel safer than face-to-face ones. Take the opening when it comes.
- **Your own feelings.** A teen's anger or despair can trigger a parent's fear. Coaching asks you to regulate yourself first. It is fine to say "I need a minute so I can listen properly."
- **Wanting to fix it.** Parents of teens often move to advice too fast. Ask "do you want ideas, or do you just want me to listen?" and believe the answer.
- **Not taking the bait.** "I hate you" in a hard moment is usually a feeling about the situation, not a verdict on the relationship. Respond to the feeling.

**Using it here**

The parent–teen questions are designed so that both of you answer in private and only see each other's answers once you have both shared. That gives a teen control over what they disclose and when, which the research suggests is exactly what makes them more willing to share. When a reveal shows a feeling you did not expect, step 3 is the place to start.

**When to get help**

Emotion coaching supports ordinary ups and downs. It is not a treatment for depression, self-harm or anxiety disorders. If your teen talks about hurting themselves, seems persistently low or withdrawn, or you are worried about their safety, contact a doctor or mental health professional. Our Safety page lists free, confidential lines, including ones teens can call themselves.

**How strong is the evidence?** Strong for the core finding that parents' emotion coaching predicts better emotional and social outcomes, from longitudinal studies. Randomised trials of teen-focused programmes show moderate benefits. Effects depend on practice over time rather than any single conversation.$b$
where slug = 'parent-teen-emotion-coaching' and length(body) < 600;

-- 2. New reads ----------------------------------------------------------------

insert into public.education_articles
  (slug, title, summary, body, category, relationship_type, framework, evidence_rating, is_premium)
values
('friendships-that-last',
 'Keeping a friendship alive as adults',
 'Adult friendships rarely end in a fight. They fade from lack of contact. What the research says about how friendships are made, how they drift, and what keeps them.',
 $b$Most adult friendships do not end. They fade. Studies of how friendships finish find that the most common cause is not conflict but drift: a move, a new job, a baby, a busy year, and contact thins until the friendship is something you used to have.

That is partly because friendship, unlike family or a partnership, has no built-in structure. Nobody is obliged to keep it going, so it depends entirely on both people choosing to.

**How friendships are made**

Communication researcher Jeffrey Hall estimated how long friendships take to form. In his studies, it took roughly 50 hours together to go from acquaintance to casual friend, around 90 hours to become friends, and more than 200 hours to become close friends. Time spent talking and doing things together counted; time merely in the same place, like an office, counted much less.

Robin Dunbar and Sam Roberts followed people through a big life change and found that emotional closeness to friends declined when contact dropped, faster than closeness to family did. Friendship needs upkeep in a way kinship often does not.

**What keeps friendships going**

Research on friendship maintenance points to a few behaviours that matter most:

- **Regular contact, even small.** Frequency predicts closeness more than length. A two-minute message every week does more than a long catch-up twice a year.
- **Openness.** Sharing what is actually going on, not only news.
- **Support.** Showing up for hard things, and for good ones. Celebrating a friend's news well matters as much as comforting them.
- **Positivity.** Friendships are voluntary; people keep the ones that feel good to be in.

**Rituals beat good intentions**

The friendships that survive busy decades usually have a structure that does not depend on anyone remembering: a standing call, an annual trip, a shared group chat, a weekly walk. Structure turns a choice that has to be made again and again into a habit.

**Practical ways to keep a friend**

- **Pick a rhythm you can actually keep.** Weekly and small beats monthly and ambitious.
- **Ask a real question.** "What's on your mind lately?" gets further than "how are things?"
- **Say the appreciation out loud.** Friends rarely tell each other what the friendship means. It is one of the cheapest, most powerful things you can do.
- **Don't keep score of who reached out last.** Someone has to go first, and it is almost always welcome.

A daily question with a friend is a small ritual of exactly this kind: a few minutes each, on your own time, and a reason to talk that is not catching up from zero.

**How strong is the evidence?** Moderate. The time-to-friendship estimates come from a small number of studies, and most friendship research is survey-based. The broad pattern, that friendships need regular contact and fade without it, is consistent across studies.$b$,
 'connection', 'friend', 'friendship', 3, false),

('reconnecting-with-an-old-friend',
 'Reconnecting with an old friend',
 'People consistently underestimate how much an old friend will appreciate hearing from them. What the research on reaching out and "dormant ties" says, and how to send the first message.',
 $b$Almost everyone has someone they have been meaning to get back in touch with, and almost everyone talks themselves out of it. It has been too long. It will be awkward. They have probably moved on.

Research suggests those worries are mostly wrong.

**People appreciate being reached out to more than we expect**

In a 2022 set of studies, Peggy Liu and colleagues asked people to send a short message or small gift to someone they had not been in touch with for a while, then asked both sides how it felt. Senders consistently underestimated how much the message would be appreciated, and the gap was largest when the contact was a surprise. The person reaching out worried about being intrusive; the person receiving it mostly felt valued.

**Dormant ties still carry value**

Studies of "dormant ties" by Daniel Levin, Jorge Walter and Keith Murnighan found that reconnecting with people you once knew well can be surprisingly rich. Much of the shared history and trust is still there, and the time apart means each person brings new experience to the conversation. Their research was about professional contacts, but the same intuition applies to friends: an old friendship does not start from zero.

**Why we hesitate**

- **We overestimate awkwardness.** Studies of conversations with strangers and acquaintances repeatedly find people expect them to go worse than they do.
- **We assume silence means disinterest.** Usually it means life got busy on both sides.
- **We wait for a reason.** You do not need one. "I was thinking about you" is a complete reason.

**How to send the first message**

- **Keep it short and specific.** Mention something real: "I drove past our old school today and thought of you." Specific beats generic.
- **Don't apologise for too long.** One line ("I'm sorry it's been so long") is plenty. A long apology makes the other person responsible for reassuring you.
- **Make it easy to reply, and easy not to.** "No need to write back, just wanted you to know I was thinking of you" lowers the pressure. Many people reply anyway.
- **Suggest one concrete next step if it goes well.** A call, a coffee, a question you both answer.

**If it doesn't go the way you hoped**

Some reconnections will not take, and that is information, not failure. Friendships end for many reasons, often nobody's fault. Reaching out was still a kind thing to do.

**How strong is the evidence?** The appreciation finding is from a recent, well-designed set of experiments with consistent results across studies. The dormant-ties work comes from studies of professional networks; applying it to friendship is a reasonable extension rather than a tested result.$b$,
 'connection', 'friend', 'social_connection', 4, false),

('you-and-your-parents-as-adults',
 'You and your parents, as adults',
 'Relationships between adult children and their parents are often close and complicated at once. Research on "intergenerational ambivalence" explains why, and what helps.',
 $b$Becoming an adult does not end a relationship with your parents. It changes its shape, often more than once: when you leave home, when you have a partner or children, when a parent needs help. Many people find that this relationship is at once one of the closest they have and one of the most frustrating.

**Mixed feelings are normal**

Sociologists Kurt Lüscher and Karl Pillemer called this intergenerational ambivalence: love and irritation, gratitude and resentment, wanting closeness and wanting distance, all in the same relationship. Karen Fingerman's research with parents and adult children finds that mixed feelings are common and usually sit alongside real affection rather than replacing it. Ambivalence is not a sign that something has gone wrong; it is a sign that the relationship matters.

**You may see the relationship differently**

A long-standing finding, sometimes called the intergenerational stake, is that parents tend to rate the relationship as closer and more important than their adult children do. Parents have invested a lifetime; children are also building separate lives. Neither view is wrong, but the gap explains many misunderstandings. A parent who calls "too often" and a child who calls "too rarely" may be describing the same week.

**Common friction points**

- **Old roles.** Parents can slip back into managing; adult children can slip back into reacting like teenagers. Both are habits, not intentions.
- **Unsolicited advice.** Usually meant as care, often received as criticism.
- **Different expectations about contact.** How often, by what means, and who initiates.
- **Big transitions.** A new partner, grandchildren, a move, a parent's health. Each one renegotiates the relationship.

**What helps**

- **Talk adult to adult.** Share your current life, not just updates. Ask about theirs as a person, not only as a parent: what they are enjoying, what worries them, what they were like at your age.
- **Name expectations out loud.** "Would a call every Sunday work?" removes a lot of guessing.
- **Set limits kindly and early.** A clear boundary said calmly is easier to hear than resentment said late.
- **Ask the questions you will want answered later.** Family stories, what they learned, what they are proud of. Many people only think to ask once it is too late.
- **Plan before the crisis.** If parents are ageing, talk about care, money and wishes while everyone is well. It protects both the parent and the relationships between siblings.

**When it is more than ambivalence**

Some parent–child relationships involve harm. Distance is sometimes the healthiest choice, and nothing here asks anyone to stay close to someone who hurts them. Our Safety page lists free, confidential support.

**How strong is the evidence?** Moderate. The ambivalence and intergenerational stake findings are well established in large survey studies across several countries. Research on what specifically improves these relationships is thinner, so the practical suggestions are informed by the research rather than proven by trials.$b$,
 'family', 'family', 'intergenerational', 3, false),

('when-things-go-right',
 'When things go right: answering good news',
 'How partners respond to each other''s good news predicts relationship quality as strongly as how they handle bad news. The four ways people respond, and the one that builds closeness.',
 $b$Relationship advice is mostly about hard moments: conflict, stress, bad news. But research by Shelly Gable and colleagues found that how people respond to each other's good news matters just as much, and is easier to improve.

**Capitalisation**

When something good happens, most people want to tell someone. Psychologists call sharing good news capitalisation, and it does two things: it makes the good event feel even better to the person sharing it, and, depending on the response, it either strengthens or weakens the relationship.

**Four ways to respond**

Gable described four styles, based on whether a response is active or passive, and constructive or destructive. Imagine your partner says: "I got the promotion!"

- **Active-constructive:** enthusiastic, curious, engaged. "That's brilliant! What did they say? How did you find out?"
- **Passive-constructive:** quietly supportive. "That's nice, well done." Warm but low-energy.
- **Active-destructive:** finding the problem. "Won't that mean even longer hours?"
- **Passive-destructive:** ignoring it or turning to yourself. "Oh. Guess what happened to me today."

Only the first one builds the relationship. In Gable's studies, people who saw their partners as responding in an active-constructive way reported more trust, intimacy and satisfaction. The other three, including the quietly supportive one, were linked to less.

The surprising part is that passive support, the polite "that's nice", is not neutral. It signals that the news did not land.

**Why it works**

Responding with real interest tells the other person you understand what matters to them and are glad when things go well for them. It also lets them relive the good moment by telling it in detail. Most people get plenty of practice responding to bad news; responding fully to good news is rarer and stands out.

**Practising it**

- **Ask questions.** "What was the best part?" "How did it feel?" "Who did you tell first?"
- **Let them tell the whole story.** Resist the urge to move on or relate it to yourself.
- **Hold your worries for later.** If the news has a downside, there will be a better moment for it. Lead with the good.
- **Notice small good news too.** A nice lunch, a kind comment from a colleague. These come up far more often than promotions.

**Beyond couples**

Capitalisation has mostly been studied in romantic relationships, but the idea applies to anyone you are close to. Friends, siblings, parents and teenagers all notice when their good news is met with real interest. A reveal is a natural place to practise: when your person's answer contains something they are proud of, ask about it.

**How strong is the evidence?** Good. The capitalisation findings come from multiple studies, including daily diary and lab studies, and have been replicated by other researchers. Most of the work involves couples; the effects in other relationships are expected but less studied.$b$,
 'communication', 'romantic', 'capitalization', 4, false),

('when-a-friendship-hurts',
 'When a friendship hurts: raising it without losing it',
 'Friends often avoid conflict until a friendship quietly ends. How to name a hurt with a friend, what the research on responses to dissatisfaction suggests, and when to let go.',
 $b$Friendships have no rules for conflict. Couples expect to argue and families have to keep living together, but friends often assume that if a friendship needs a difficult conversation, something is already wrong. So hurts go unspoken, contact thins, and the friendship ends without anyone deciding it should.

This read is about the alternative: raising a hurt with a friend in a way that gives the friendship a chance.

**Four ways people respond to dissatisfaction**

Caryl Rusbult's research on how people respond when a relationship disappoints them describes four broad responses, first studied in romantic relationships and later applied to friendships:

- **Voice:** raising the problem and trying to improve things.
- **Loyalty:** waiting it out, hoping things get better on their own.
- **Neglect:** letting the relationship slide, pulling back without saying why.
- **Exit:** ending it.

Voice and loyalty are the constructive responses; neglect and exit are destructive. Studies of friendship find neglect is especially common, because it feels like the least confrontational option. It is also the response most likely to end the friendship without either person ever understanding why.

**Before you raise it**

- **Check what you actually want.** An apology? A change? To be understood? Knowing makes the conversation shorter and kinder.
- **Separate the event from the story.** "She didn't come to my birthday" is the event. "She doesn't care about me anymore" is a story you have built around it. Bring the event; hold the story lightly.
- **Consider their side first.** Friends usually have a life you cannot see. Big absences often have big reasons.

**Raising it**

- **Choose a calm moment and a private channel.** A call or a meeting is better than a long message, if you can.
- **Lead with the friendship.** "You matter to me, which is why I want to mention this."
- **Use a gentle start-up.** Describe what happened, how it felt, what you would like. "When you cancelled the trip at the last minute, I felt like I wasn't a priority. Can we talk about it?"
- **Then listen.** Ask what was going on for them, and summarise what you hear before you respond.
- **Accept a partial answer.** You may not get everything you hoped for. Being heard is often enough.

**Repairing it**

If the conversation goes well, one small step soon afterwards matters more than a long discussion. Do something ordinary together. It confirms the friendship survived.

**Hearing it from a friend**

If a friend raises something with you, the same principles apply in reverse. Thank them for telling you; it took more courage than staying quiet. Take responsibility for your part without arguing every detail. "You're right, I let you down, and I'm sorry" is usually enough to start.

**Letting a friendship go**

Some friendships run their course. People change, values diverge, or one person keeps taking more than they give. If a friendship consistently leaves you feeling worse, stepping back is reasonable. It can be done kindly: a gentle drift, or a short honest message, rather than a dramatic break.

**How strong is the evidence?** Moderate. Rusbult's response model is well established for romantic relationships and supported in friendship studies. Research on how to repair friendships specifically is limited, so the practical steps borrow from well-tested communication principles rather than friendship trials.$b$,
 'conflict', 'friend', 'rusbult', 3, true)
on conflict (slug) do nothing;
