import Link from "next/link";

const TYPES = [
  "Romantic partners",
  "Friends",
  "Family",
  "Coworkers",
  "Parents & teens",
];

export default function Home() {
  return (
    <div className="mx-auto max-w-5xl px-4">
      <section className="py-16 sm:py-24 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
          Closer, on purpose.
        </h1>
        <p className="mt-5 mx-auto max-w-2xl text-lg text-gray-600">
          Relationship Copilot helps you build deeper, healthier connections
          with the people who matter — across the whole arc of a relationship.
          Answer thoughtful questions together, reveal at the same time, and
          grow with guidance grounded in real research.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/login"
            className="rounded-md bg-brand-600 px-5 py-2.5 text-white font-medium hover:bg-brand-700"
          >
            Get started
          </Link>
          <Link
            href="/safety"
            className="rounded-md px-5 py-2.5 font-medium text-gray-700 hover:bg-gray-50"
          >
            Safety resources
          </Link>
        </div>
        <div className="mt-10 flex flex-wrap justify-center gap-2">
          {TYPES.map((t) => (
            <span
              key={t}
              className="rounded-full bg-brand-50 text-brand-700 px-3 py-1 text-sm"
            >
              {t}
            </span>
          ))}
        </div>
      </section>

      <section className="grid gap-6 sm:grid-cols-3 pb-20">
        <Feature
          title="Mutual reveal"
          body="You answer first, then see each other's answers together — honest, low-pressure, and surprisingly fun."
        />
        <Feature
          title="Grounded in research"
          body="Questions draw on Gottman, attachment theory, and the science of closeness — with the weaker ideas flagged honestly."
        />
        <Feature
          title="Every relationship"
          body="One place for partners, friends, family, and coworkers — not just couples."
        />
      </section>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-gray-100 p-5">
      <h3 className="font-semibold text-brand-700">{title}</h3>
      <p className="mt-2 text-sm text-gray-600">{body}</p>
    </div>
  );
}
