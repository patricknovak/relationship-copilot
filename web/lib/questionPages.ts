// Public /questions hub + per-type landing pages.
// Listed questions are copied verbatim from onboarding seed packs
// (supabase/migrations/0003_seed_content.sql; family q13–q15 from 0029;
// siblings + mentors from 0013_content_coverage_and_hardening.sql).
// Do not invent new question text here.
import { PREMIUM_MONTHLY_DISPLAY } from "@/lib/pricing";

export type QuestionSource = {
  file: string;
  note?: string;
};

export type ListedQuestion = {
  text: string;
  source: QuestionSource;
};

export type QuestionPage = {
  slug:
    | "partners"
    | "friends"
    | "family"
    | "coworkers"
    | "siblings"
    | "mentors"
    | "parents-and-teens";
  /** H1 / primary SEO title phrase. */
  title: string;
  /** Full <title> (with brand suffix added by the root layout if configured). */
  metaTitle: string;
  metaDescription: string;
  intro: string;
  questions: ListedQuestion[];
  faqs: { q: string; a: string }[];
  /** Matching /for/* slug for cross-links. */
  forSlug: string;
  /** Human label for “questions for …” (not the raw slug). */
  forLabel: string;
};

/** Shared CTA / honesty block — exact marketing strings for HoM. */
export const QUESTIONS_BLOCK_COPY =
  "Ask these the honest way. You each answer in private, and neither of you sees the other's answers until you've both shared.";

export const QUESTIONS_CTA_LABEL = "Start a connection";

/** Hub CTA (no list) — list-aware hrefs live in `questionsCta.ts`. */
export const QUESTIONS_CTA_HREF = "/login?next=/connections/new";

export const QUESTIONS_SIGNED_IN_HREF = "/connections/new";

export const QUESTIONS_SIGN_IN_HINT =
  "Continue with Google — no password to invent.";

/** Three FAQ answers that mirror shipped product facts only. */
export const QUESTIONS_SHARED_FAQS: { q: string; a: string }[] = [
  {
    q: "Can they see my answer before I've shared mine?",
    a: "No. Each of you answers in private, and neither answer is shown until both are in. That rule is enforced in the database, not just the app.",
  },
  {
    q: "Are safety features free?",
    a: "Yes. Safety resources are always free and never paywalled.",
  },
  {
    q: "What does Premium cost?",
    a: `Premium is ${PREMIUM_MONTHLY_DISPLAY} and optional. Free covers up to 3 connections, with the questions, mutual reveal, and Safety resources included.`,
  },
];

const SRC_0003: QuestionSource = {
  file: "supabase/migrations/0003_seed_content.sql",
  note: "onboarding pack",
};

const SRC_0013: QuestionSource = {
  file: "supabase/migrations/0013_content_coverage_and_hardening.sql",
  note: "sibling + mentor onboarding packs",
};

const SRC_0029: QuestionSource = {
  file: "supabase/migrations/0029_first_twenty_everywhere.sql",
  note: "family onboarding extension",
};

export const QUESTION_PAGES: QuestionPage[] = [
  {
    slug: "partners",
    title: "Questions to ask your partner",
    metaTitle: "Questions to ask your partner",
    metaDescription:
      "Thoughtful questions for couples, answered in private and revealed together. Free for up to 3 connections.",
    intro:
      "Questions couples answer when they start. Use them here as a list, or start a connection and answer each one in private.",
    forSlug: "partners",
    forLabel: "your partner",
    faqs: QUESTIONS_SHARED_FAQS,
    questions: [
      {
        text: "What first drew you to me, and has that changed?",
        source: SRC_0003,
      },
      {
        text: "What does a perfect, ordinary day together look like to you?",
        source: SRC_0003,
      },
      {
        text: "When do you feel most loved by me?",
        source: SRC_0003,
      },
      {
        text: "What's a dream you have that you haven't fully shared with me?",
        source: SRC_0003,
      },
      {
        text: "What does trust look like to you in a relationship?",
        source: SRC_0003,
      },
      {
        text: "How do you most like to be comforted when you're upset?",
        source: SRC_0003,
      },
      {
        text: "What's something you're proud of that you wish I noticed more?",
        source: SRC_0003,
      },
      {
        text: "What did love look like in the home you grew up in?",
        source: SRC_0003,
      },
      {
        text: "What's a fear you have about us, even a small one?",
        source: SRC_0003,
      },
      {
        text: "When you picture us in five years, what do you hope is true?",
        source: SRC_0003,
      },
      {
        text: "How do you prefer to handle disagreements between us?",
        source: SRC_0003,
      },
      {
        text: "What's a ritual or tradition you'd love for us to keep?",
        source: SRC_0003,
      },
      {
        text: "What makes you feel respected by me?",
        source: SRC_0003,
      },
      {
        text: "On a scale of 1-10, how connected do you feel to me right now?",
        source: SRC_0003,
      },
      {
        text: "What's something I do that you appreciate but rarely say out loud?",
        source: SRC_0003,
      },
    ],
  },
  {
    slug: "friends",
    title: "Questions to ask a friend",
    metaTitle: "Questions to ask a friend",
    metaDescription:
      "Deep questions for close friends, answered in private and revealed together. Free for up to 3 connections.",
    intro:
      "Questions friends answer when they start. Use them here as a list, or start a connection and reveal together.",
    forSlug: "friends",
    forLabel: "a friend",
    faqs: QUESTIONS_SHARED_FAQS,
    questions: [
      {
        text: "What's a moment our friendship really clicked for you?",
        source: SRC_0003,
      },
      {
        text: "What do you value most in a friend?",
        source: SRC_0003,
      },
      {
        text: "What's something you're going through right now that you'd want a friend to ask about?",
        source: SRC_0003,
      },
      {
        text: "When you're stressed, do you prefer space, distraction, or someone to listen?",
        source: SRC_0003,
      },
      {
        text: "What's a goal you're chasing this year?",
        source: SRC_0003,
      },
      {
        text: "What's a part of your life you don't talk about much?",
        source: SRC_0003,
      },
      {
        text: "How do you like to be supported when things go wrong?",
        source: SRC_0003,
      },
      {
        text: "What's the best advice you've ever gotten?",
        source: SRC_0003,
      },
      {
        text: "What's something you've changed your mind about recently?",
        source: SRC_0003,
      },
      {
        text: "How often would you ideally want to catch up?",
        source: SRC_0003,
      },
      {
        text: "What's a small thing that always makes your day better?",
        source: SRC_0003,
      },
      {
        text: "What do you wish more people understood about you?",
        source: SRC_0003,
      },
      {
        text: "What's a risk you're glad you took?",
        source: SRC_0003,
      },
      {
        text: "On a scale of 1-10, how supported do you feel in your life right now?",
        source: SRC_0003,
      },
      {
        text: "What's something you'd love a friend to do with you?",
        source: SRC_0003,
      },
    ],
  },
  {
    slug: "family",
    title: "Questions to ask family",
    metaTitle: "Questions to ask family",
    metaDescription:
      "Conversation questions for family, answered in private and revealed together. Free for up to 3 connections.",
    intro:
      "Questions family members answer when they start. Private answers, shared only when you've both responded.",
    forSlug: "family",
    forLabel: "family",
    faqs: QUESTIONS_SHARED_FAQS,
    questions: [
      {
        text: "What's a family memory you treasure?",
        source: SRC_0003,
      },
      {
        text: "What tradition do you hope we keep?",
        source: SRC_0003,
      },
      {
        text: "What's something about you that you wish I understood better?",
        source: SRC_0003,
      },
      {
        text: "When do you feel most appreciated by me?",
        source: SRC_0003,
      },
      {
        text: "What's a value you hope our family stands for?",
        source: SRC_0003,
      },
      {
        text: "What's something you're proud of right now?",
        source: SRC_0003,
      },
      {
        text: "What do you need more of from me?",
        source: SRC_0003,
      },
      {
        text: "How do you prefer we work through disagreements?",
        source: SRC_0003,
      },
      {
        text: "What's a hope you have for the coming year?",
        source: SRC_0003,
      },
      {
        text: "What's a way our family could support each other better?",
        source: SRC_0003,
      },
      {
        text: "What's a story about our family you love retelling?",
        source: SRC_0003,
      },
      {
        text: "What's something you'd like us to do together more often?",
        source: SRC_0003,
      },
      {
        text: "What's a role you played in our family growing up that you'd like to step out of?",
        source: SRC_0029,
      },
      {
        text: "What's something our family doesn't talk about that you wish we could?",
        source: SRC_0029,
      },
      {
        text: "When you're going through something hard, do you want me to check in, give space, or just show up?",
        source: SRC_0029,
      },
    ],
  },
  {
    slug: "coworkers",
    title: "Questions to ask a coworker",
    metaTitle: "Questions to ask a coworker",
    metaDescription:
      "Questions for coworkers and teammates, answered in private and revealed together. Free for up to 3 connections.",
    intro:
      "Questions teammates answer when they start. Use them here as a list, or start a connection and answer each one in private.",
    forSlug: "coworkers",
    forLabel: "coworkers",
    faqs: QUESTIONS_SHARED_FAQS,
    questions: [
      {
        text: "How do you prefer to receive feedback?",
        source: SRC_0003,
      },
      {
        text: "What does great collaboration look like to you?",
        source: SRC_0003,
      },
      {
        text: "How do you like to communicate day to day (chat, calls, async)?",
        source: SRC_0003,
      },
      {
        text: "What are you trying to grow in professionally right now?",
        source: SRC_0003,
      },
      {
        text: "What helps you do your best work?",
        source: SRC_0003,
      },
      {
        text: "What's a working style of yours I should know about?",
        source: SRC_0003,
      },
      {
        text: "How do you prefer we handle disagreements about work?",
        source: SRC_0003,
      },
      {
        text: "What does recognition that feels meaningful look like for you?",
        source: SRC_0003,
      },
    ],
  },
  {
    slug: "siblings",
    title: "Questions to ask your brother or sister",
    metaTitle: "Questions to ask your brother or sister",
    metaDescription:
      "Questions for siblings, answered in private and revealed together. Free for up to 3 connections.",
    intro:
      "Questions siblings answer when they start. Use them here as a list, or start a connection and answer each one in private.",
    forSlug: "siblings",
    forLabel: "your brother or sister",
    faqs: QUESTIONS_SHARED_FAQS,
    questions: [
      {
        text: "What's your favorite memory of us as kids?",
        source: SRC_0013,
      },
      {
        text: "What role did you feel you played in our family growing up?",
        source: SRC_0013,
      },
      {
        text: "What do you think I got from our parents that you didn't — or the other way round?",
        source: SRC_0013,
      },
      {
        text: "What's something about your life now that I probably don't know much about?",
        source: SRC_0013,
      },
      {
        text: "When you're going through something hard, do you want me to check in, give space, or just show up?",
        source: SRC_0013,
      },
      {
        text: "What's an old sibling habit between us you'd be glad to retire?",
        source: SRC_0013,
      },
      {
        text: "What's something you admire about who I've become?",
        source: SRC_0013,
      },
      {
        text: "Is there something from our childhood you wish we'd talked about?",
        source: SRC_0013,
      },
    ],
  },
  {
    slug: "mentors",
    title: "Questions to ask a mentor or mentee",
    metaTitle: "Questions to ask a mentor or mentee",
    metaDescription:
      "Questions for mentors and mentees, answered in private and revealed together. Free for up to 3 connections.",
    intro:
      "Questions mentors and mentees answer when they start. Use them here as a list, or start a connection and answer each one in private.",
    forSlug: "mentors",
    forLabel: "mentors and mentees",
    faqs: QUESTIONS_SHARED_FAQS,
    questions: [
      {
        text: "What do you hope this mentoring relationship gives you over the next year?",
        source: SRC_0013,
      },
      {
        text: "What's a strength you bring that others sometimes overlook?",
        source: SRC_0013,
      },
      {
        text: "What's a skill or situation you'd most like to grow in right now?",
        source: SRC_0013,
      },
      {
        text: "How do you like to receive feedback — direct and quick, or with context and time to reflect?",
        source: SRC_0013,
      },
      {
        text: "What's a piece of advice you've received that genuinely changed how you work?",
        source: SRC_0013,
      },
      {
        text: "What does a good mentoring conversation look like to you — questions, stories, problem-solving, accountability?",
        source: SRC_0013,
      },
      {
        text: "What's a professional risk you're weighing at the moment?",
        source: SRC_0013,
      },
      {
        text: "What's a mistake you've learned the most from?",
        source: SRC_0013,
      },
    ],
  },
  {
    slug: "parents-and-teens",
    title: "Questions for parents and teens",
    metaTitle: "Questions for parents and teens",
    metaDescription:
      "Questions a parent and teen answer in private and reveal together. Free for up to 3 connections.",
    intro:
      "Questions a parent and teen answer when they start. Each of you answers in private, and you see each other's answers together.",
    forSlug: "parents-and-teens",
    forLabel: "parents and teens",
    faqs: QUESTIONS_SHARED_FAQS,
    questions: [
      {
        text: "What's something fun you'd want us to do together?",
        source: SRC_0003,
      },
      {
        text: "When you're upset, what actually helps from me?",
        source: SRC_0003,
      },
      {
        text: "What's something you're into right now that you'd like to share?",
        source: SRC_0003,
      },
      {
        text: "What's one thing you wish I understood about your world?",
        source: SRC_0003,
      },
      {
        text: "What's a way I could give you more space or trust?",
        source: SRC_0003,
      },
      {
        text: "What are you proud of lately?",
        source: SRC_0003,
      },
      {
        text: "When do you feel most listened to by me?",
        source: SRC_0003,
      },
      {
        text: "What's something you'd like to be able to talk to me about more easily?",
        source: SRC_0003,
      },
    ],
  },
];

export function questionPageBySlug(slug: string): QuestionPage | null {
  return QUESTION_PAGES.find((p) => p.slug === slug) ?? null;
}

export const QUESTIONS_HUB = {
  metaTitle: "Questions to ask — partners, friends, family, and more",
  metaDescription:
    "Questions to ask a partner, friend, family member, sibling, coworker, mentor, or teen — answered in private and revealed together. Free for up to 3 connections.",
  title: "Questions to ask",
  intro:
    "These are the same questions you'll answer in Relationship Copilot. Pick a relationship, browse the questions, then start a connection and answer the honest way.",
};
