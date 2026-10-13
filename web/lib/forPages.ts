// Public "questions for your…" pages, one per relationship type. Pure content
// so it can be tested and reused by the sitemap and the landing page. Sample
// questions are hand-picked from the daily/onboarding pools; nothing here is
// user data.

import type { ConnectionType } from "@/lib/database.types";

export interface ForPage {
  slug: string;
  type: ConnectionType;
  // Short label for chips and nav.
  label: string;
  // <title> and H1.
  title: string;
  description: string;
  intro: string;
  samples: string[];
  faqs: { q: string; a: string }[];
}

const SHARED_FAQS: { q: string; a: string }[] = [
  {
    q: "Can they see my answer before I see theirs?",
    a: "No. Each of you answers in private, and neither answer is shown until both are in. That rule is enforced in the database, not just the app, so there is no way to peek.",
  },
  {
    q: "Is it free?",
    a: "Yes. Every relationship type, the first questions, a new question each day, reveals, discussion, quizzes and challenges are free. An optional Premium plan adds AI reflections, and one plan covers both people.",
  },
  {
    q: "Do we both need the app?",
    a: "You both need an account, but it is a website that works on any phone or laptop. Send one link; they sign in and you are connected.",
  },
];

export const FOR_PAGES: ForPage[] = [
  {
    slug: "partners",
    type: "romantic",
    label: "Partners",
    title: "Questions for couples and partners",
    description:
      "Daily questions for couples, answered in private and revealed together. Free, grounded in research, no peeking.",
    intro:
      "Dating, married, or somewhere in between: a question a day you each answer on your own, then read side by side. It is the easiest way to keep learning about each other.",
    samples: [
      "What's one thing I did this week that made you feel loved?",
      "What's stressing you right now that I might not fully see?",
      "What's a small ritual of ours you'd miss if it disappeared?",
      "What do you need after a bad day: space, talk, touch, or distraction?",
      "When you picture us in five years, what's one scene you see?",
      "What's a conversation we keep postponing?",
    ],
    faqs: [
      {
        q: "Is this couples therapy?",
        a: "No. It is a daily habit for staying close, informed by research like the Gottman work on friendship and bids. It never diagnoses, and the Safety page is always free if you need real support.",
      },
    ],
  },
  {
    slug: "friends",
    type: "friend",
    label: "Friends",
    title: "Questions to ask a close friend",
    description:
      "Deep questions for best friends, answered privately and revealed together. A daily way to stay close when life gets busy.",
    intro:
      "Friendships rarely get the structure couples get. One question a day, answered separately and revealed together, keeps a friendship honest and current across cities and busy seasons.",
    samples: [
      "How are you doing, really — not the version you give at work?",
      "What's a small win you haven't told anyone about yet?",
      "What's something you'd want me to notice if you were struggling?",
      "What's a way our friendship has changed you?",
      "What's a fear you'd only admit to a close friend?",
      "What would make you feel more comfortable asking me for help?",
    ],
    faqs: [
      {
        q: "Does it work long-distance?",
        a: "That is where it works best. You each answer whenever you like, and the reveal happens the moment the second answer lands, in any time zone.",
      },
    ],
  },
  {
    slug: "siblings",
    type: "sibling",
    label: "Siblings",
    title: "Questions to ask your brother or sister",
    description:
      "Questions for adult siblings to reconnect, answered in private and revealed together. Beyond the roles you grew up in.",
    intro:
      "Siblings share a childhood and often not much else as adults. These questions help you meet each other as the people you are now, one honest answer at a time.",
    samples: [
      "What's your favorite memory of us as kids?",
      "What role did you feel you played in our family growing up?",
      "What's something about your life now that I probably don't know much about?",
      "What's a grudge, small or big, that you'd be willing to drop?",
      "Is there anything about our parents you've been carrying alone?",
      "What's a tradition we should keep alive after our parents are gone?",
    ],
    faqs: [
      {
        q: "What if we're not close?",
        a: "Start with the first 20 questions. They are written for siblings who have drifted, and both of you answer before anything is shown, so nobody has to go first.",
      },
    ],
  },
  {
    slug: "family",
    type: "family",
    label: "Family",
    title: "Questions to ask your parents and family",
    description:
      "Conversation questions for parents, adult children and relatives, answered privately and revealed together.",
    intro:
      "For a parent and adult child, cousins, in-laws, or anyone you call family: questions that get past logistics and into the stories and feelings that usually go unsaid.",
    samples: [
      "What's a family story you'd want the next generation to know?",
      "What's a way our family is different from how it looks from the outside?",
      "What's something you're proud of in me that you don't say enough?",
      "What's a topic that's hard to bring up in our family, and what would help?",
      "What's a way we could make visits feel easier?",
      "What's a thing you've never thanked me for?",
    ],
    faqs: [
      {
        q: "Is this for a parent and a teenager?",
        a: "There is a separate parent and teen track, built trust-first: either person can leave at any time, and nothing is ever shown to one side only.",
      },
    ],
  },
  {
    slug: "parents-and-teens",
    type: "parent_child",
    label: "Parents & teens",
    title: "Questions for parents and teens",
    description:
      "A trust-first way for a parent and teenager to talk: questions answered in private, revealed together, never surveillance.",
    intro:
      "Teenagers open up when they are not being monitored. Each of you answers on your own, the reveal only happens when both are in, and the teen can leave at any time. It is connection, not control.",
    samples: [
      "What's something you wish I'd ask you about more?",
      "What's a rule at home that feels fair, and one that doesn't?",
      "What's a way I could react better when you tell me something hard?",
      "What's something you're good at that you don't think I notice?",
      "What do you want me to do when you're quiet: ask, wait, or just be nearby?",
      "What's a way I could show I trust you?",
    ],
    faqs: [
      {
        q: "Can a parent see the teen's answers early?",
        a: "No. The same rule applies to everyone: an answer is hidden until both people have answered. There is no parent override, by design.",
      },
      {
        q: "What ages is this for?",
        a: "Teens 13 and up. Verifiable parental consent for under-13s is not yet supported.",
      },
    ],
  },
  {
    slug: "coworkers",
    type: "coworker",
    label: "Coworkers",
    title: "Questions for coworkers and teammates",
    description:
      "Check-in questions for two colleagues who work closely: feedback, priorities and trust, answered privately and revealed together.",
    intro:
      "For a manager and report, two co-founders, or any pair that ships together. Short questions about priorities, feedback and what is actually going on, answered without an audience.",
    samples: [
      "What's one thing that would make this week's work go more smoothly between us?",
      "What's a way you prefer to get feedback, and a way you don't?",
      "What's a risk you'd take at work if you knew it wouldn't be held against you?",
      "What's something you'd like more clarity on from me?",
      "What's a mistake we've made as a team that we never debriefed?",
      "What kind of recognition actually means something to you?",
    ],
    faqs: [
      {
        q: "Is this an HR tool?",
        a: "No. It is a private space for two people. Nobody else, including an employer, can read it, and either person can leave at any time.",
      },
    ],
  },
  {
    slug: "mentors",
    type: "mentor",
    label: "Mentors",
    title: "Questions for mentors and mentees",
    description:
      "Structure for a mentoring relationship: questions on goals, feedback and candor, answered privately and revealed together.",
    intro:
      "Most mentoring fizzles for lack of structure. A question a day, answered by both of you, keeps the relationship specific, honest and useful in both directions.",
    samples: [
      "What do you hope this mentoring relationship gives you over the next year?",
      "What's a question you'd ask if you knew it wasn't a dumb question?",
      "What's a piece of feedback you've been avoiding?",
      "What's a goal you set that you're not sure you still want?",
      "What's a way I could be more useful to you?",
      "What's one thing you'd like to be held accountable for by next time?",
    ],
    faqs: [
      {
        q: "Does the mentor answer too?",
        a: "Yes. Both people answer every question. Mentors learn as much from answering as mentees do from asking.",
      },
    ],
  },
];

export function forPageBySlug(slug: string): ForPage | null {
  return FOR_PAGES.find((p) => p.slug === slug) ?? null;
}

export function forPageFaqs(page: ForPage): { q: string; a: string }[] {
  return [...page.faqs, ...SHARED_FAQS];
}
