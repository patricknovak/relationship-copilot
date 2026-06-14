import Link from "next/link";

const TYPES = [
  "Romantic partners",
  "Friends",
  "Family",
  "Coworkers",
  "Parents & teens",
  "Siblings",
  "Mentors",
];

const STAGES = [
  { label: "New love", note: "the first 20 questions" },
  { label: "New parents", note: "protect the friendship" },
  { label: "Growing teens", note: "trust, not surveillance" },
  { label: "Caring for parents", note: "share the load" },
  { label: "Grief & endings", note: "remember together" },
];

const FAQS = [
  {
    q: "Can the other person see my answer before I share mine?",
    a: "No — and it's not just a promise in the app. The rule that hides an answer until you've both responded lives in the database itself, so no bug in the app could leak it early. You answer first, then you both see everything at once.",
  },
  {
    q: "Is this therapy?",
    a: "No. Relationship Copilot offers relationship-wellness and coaching-style prompts grounded in research, but it isn't therapy, counseling, or medical advice, and it never diagnoses. If you're in crisis, our Safety page lists free, confidential support — always one tap away.",
  },
  {
    q: "What happens to what I write — and what does the AI see?",
    a: "Your words are yours: you can export everything as JSON or delete your account anytime. We don't sell your data. The optional AI features send only the relevant answers — with names, emails, and phone numbers stripped out first — to generate a reflection for you, and that text isn't used to train models.",
  },
  {
    q: "Is it really free?",
    a: "The core experience — every relationship type, the 20 questions, daily prompts, reveals, discussions, and the library — is free. Premium ($18/mo) adds the AI Blueprint and weekly digests. Safety resources are never behind the paywall.",
  },
  {
    q: "Is it only for couples?",
    a: "No. It's built for the whole arc of a relationship — romantic partners, friends, family, siblings, coworkers, mentors, and a trust-first parent–teen track. Each connection gets its own private space.",
  },
  {
    q: "What if I'm in an unsafe relationship?",
    a: "Safety comes first and free. The app screens for signs of harm and, when it sees them, withholds AI output and surfaces support resources instead. There's a quick-exit button on the Safety page, and we never notify the other person when you view resources or leave a connection.",
  },
];

export default function Home() {
  return (
    <div>
      {/* ------------------------------------------------ Hero */}
      <section className="hero-glow">
        <div className="mx-auto max-w-5xl px-4 pb-20 pt-16 text-center sm:pt-24">
          <p className="eyebrow animate-fade-up">
            For every relationship that matters
          </p>
          <h1 className="mx-auto mt-4 max-w-3xl animate-fade-up text-5xl leading-[1.05] sm:text-7xl">
            Closer, on purpose.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl animate-fade-up text-lg leading-relaxed text-ink-soft [animation-delay:120ms]">
            Answer thoughtful questions together — and see each other&apos;s
            answers only when you&apos;ve both shared. Honest by design,
            grounded in real research, for the whole arc of a relationship.
          </p>
          <div className="mt-9 flex animate-fade-up items-center justify-center gap-3 [animation-delay:200ms]">
            <Link href="/login" className="btn-primary !px-7 !py-3 !text-base">
              Start free
            </Link>
            <Link href="/library" className="btn-secondary !px-7 !py-3 !text-base">
              Browse the library
            </Link>
          </div>
          <p className="mt-4 animate-fade-up text-xs text-ink-soft/70 [animation-delay:260ms]">
            Free for the core experience · Safety resources always free
          </p>

          {/* The signature moment: mutual reveal, as a living mockup. */}
          <div className="relative mx-auto mt-16 max-w-3xl animate-fade-up [animation-delay:340ms]">
            <div className="card !rounded-3xl !bg-white/90 dark:!bg-surface !p-6 text-left shadow-lift sm:!p-8">
              <p className="eyebrow">Today&apos;s question</p>
              <p className="mt-2 font-display text-xl text-ink sm:text-2xl">
                &ldquo;When do you feel most appreciated by me?&rdquo;
              </p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-brand-100 dark:border-surface-line bg-brand-50/60 dark:bg-brand-900/20 p-4">
                  <p className="text-xs font-semibold text-brand-700">You</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                    When you notice the small stuff — like Tuesday, when you
                    just said &ldquo;I saw how hard that was.&rdquo;
                  </p>
                </div>
                <div className="relative overflow-hidden rounded-2xl border border-brand-100 dark:border-surface-line bg-brand-50/60 dark:bg-brand-900/20 p-4">
                  <p className="text-xs font-semibold text-brand-700">Them</p>
                  <p
                    aria-hidden
                    className="mt-1.5 select-none text-sm leading-relaxed text-ink-soft blur-[7px]"
                  >
                    Honestly, it&apos;s the mornings. You always remember the
                    little rituals that make us, us.
                  </p>
                  <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-white/85 via-white/30 to-transparent p-3 dark:from-surface dark:via-surface/40">
                    <span className="rounded-full bg-brand-800 px-3 py-1 text-xs font-medium text-white dark:bg-brand-500">
                      Reveals when you both answer ✨
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div
              aria-hidden
              className="absolute -inset-x-8 -bottom-10 -z-10 h-24 rounded-[100%] bg-brand-300/30 blur-3xl"
            />
          </div>

          <div className="mt-16 flex flex-wrap justify-center gap-2">
            {TYPES.map((t, i) => (
              <span
                key={t}
                className="chip animate-fade-up"
                style={{ animationDelay: `${380 + i * 60}ms` }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ How it works */}
      <section className="mx-auto max-w-5xl px-4 py-20">
        <p className="eyebrow text-center">How it works</p>
        <h2 className="mt-3 text-center text-3xl sm:text-4xl">
          Three small habits. One closer relationship.
        </h2>
        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          <Step
            n="1"
            title="Invite your person"
            body="One link, one tap. Partner, friend, sibling, parent, teammate — every connection gets its own private space."
          />
          <Step
            n="2"
            title="Answer in private"
            body="A daily question and deeper packs, written for your kind of relationship. Neither of you can peek early — it's enforced, not promised."
          />
          <Step
            n="3"
            title="Reveal together"
            body="Both answered? Everything unlocks side by side, with a place to talk about it. That moment is the whole point."
          />
        </div>
      </section>

      {/* ------------------------------------------------ Features */}
      <section className="bg-paper-warm/70">
        <div className="mx-auto max-w-5xl px-4 py-20">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Feature
              icon={<IconSpark />}
              title="Grounded in research"
              body="Questions draw on Gottman, attachment theory, and the science of closeness — with the weaker ideas flagged honestly."
            />
            <Feature
              icon={<IconArc />}
              title="Cradle to grave"
              body="New love, new parents, teens, caring for aging parents, grief — packs for the seasons most apps pretend don't exist."
            />
            <Feature
              icon={<IconFlame />}
              title="Streaks that forgive"
              body="A daily rhythm worth keeping, without the guilt mechanics. Miss a day? Life happens. Pick it back up."
            />
            <Feature
              icon={<IconLock />}
              title="Private by architecture"
              body="The reveal rule lives in the database itself — no app bug can leak an answer early. Your words are yours to export or erase."
            />
            <Feature
              icon={<IconBook />}
              title="A library worth reading"
              body="Short, evidence-rated reads — the four horsemen, bids for connection, grieving differently — free where it matters most."
            />
            <Feature
              icon={<IconHeartHand />}
              title="Safety, never paywalled"
              body="Crisis resources are free for everyone, always one tap away, with a quick-exit button when privacy matters."
            />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ Life stages */}
      <section className="mx-auto max-w-5xl px-4 py-20">
        <p className="eyebrow text-center">The whole arc</p>
        <h2 className="mt-3 text-center text-3xl sm:text-4xl">
          Built for seasons, not just sparks
        </h2>
        <div className="relative mt-12">
          <div
            aria-hidden
            className="absolute left-4 right-4 top-5 hidden h-px bg-gradient-to-r from-transparent via-brand-300 to-transparent sm:block"
          />
          <ol className="grid gap-6 sm:grid-cols-5">
            {STAGES.map((s) => (
              <li key={s.label} className="text-center">
                <span className="relative mx-auto block h-10 w-10 rounded-full border-2 border-brand-300 bg-paper">
                  <span className="absolute inset-2 rounded-full bg-brand-400/70" />
                </span>
                <p className="mt-3 font-display text-lg text-ink">{s.label}</p>
                <p className="mt-1 text-sm text-ink-soft">{s.note}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------ FAQ */}
      <section className="mx-auto max-w-2xl px-4 py-20">
        <p className="eyebrow text-center">Good questions</p>
        <h2 className="mt-3 text-center text-3xl sm:text-4xl">
          Before you start
        </h2>
        <div className="mt-10 space-y-3">
          {FAQS.map((f) => (
            <details key={f.q} className="card group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-ink">
                {f.q}
                <span
                  aria-hidden
                  className="text-brand-500 transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------ Final CTA */}
      <section className="mx-auto max-w-5xl px-4 pb-24">
        <div className="hero-glow card !rounded-3xl !border-brand-200 !p-10 text-center shadow-lift sm:!p-14">
          <h2 className="text-3xl sm:text-4xl">
            The people you love are one question away.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-ink-soft">
            Start free. Invite one person. See what you learn about each other
            by Friday.
          </p>
          <div className="mt-7 flex items-center justify-center gap-3">
            <Link href="/login" className="btn-primary !px-7 !py-3 !text-base">
              Start free
            </Link>
            <Link href="/pricing" className="btn-ghost">
              See pricing
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="card card-hover">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-700 font-display text-lg text-white">
        {n}
      </span>
      <h3 className="mt-4 font-display text-xl text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">{body}</p>
    </div>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="card card-hover">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 dark:bg-brand-900/40 text-brand-700">
        {icon}
      </span>
      <h3 className="mt-4 font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">{body}</p>
    </div>
  );
}

/* Minimal inline icons — no dependency, consistent stroke. */
const iconProps = {
  className: "h-5 w-5",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
  "aria-hidden": true,
};

function IconSpark() {
  return (
    <svg {...iconProps}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
    </svg>
  );
}
function IconArc() {
  return (
    <svg {...iconProps}>
      <path d="M3 17c0-7 4-11 9-11s9 4 9 11" />
      <circle cx="3" cy="17" r="1.6" />
      <circle cx="12" cy="6" r="1.6" />
      <circle cx="21" cy="17" r="1.6" />
    </svg>
  );
}
function IconFlame() {
  return (
    <svg {...iconProps}>
      <path d="M12 21c3.9 0 6.5-2.5 6.5-6 0-4-3.5-6.5-4.5-9.5-2 1.5-2.6 3.6-2.5 5.5-1-.6-2-1.8-2.3-3C7.6 9.6 5.5 11.6 5.5 15c0 3.5 2.6 6 6.5 6Z" />
    </svg>
  );
}
function IconLock() {
  return (
    <svg {...iconProps}>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </svg>
  );
}
function IconBook() {
  return (
    <svg {...iconProps}>
      <path d="M12 6.5C10.5 5 8.4 4.5 4 4.5v13c4.4 0 6.5.5 8 2 1.5-1.5 3.6-2 8-2v-13c-4.4 0-6.5.5-8 2ZM12 6.5v13" />
    </svg>
  );
}
function IconHeartHand() {
  return (
    <svg {...iconProps}>
      <path d="M12 20s-6.5-4.1-8.4-8C2.3 9.3 3.6 6.5 6.4 6.1c1.7-.2 3.4.7 4.3 2.1.2.4.4.8.5 1.2.4-1.7 1.9-3.2 3.8-3.4 2.8-.3 4.6 2.4 4 5-.9 4-7 9-7 9Z" />
    </svg>
  );
}
