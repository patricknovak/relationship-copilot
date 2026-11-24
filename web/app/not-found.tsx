import Link from "next/link";

export default function NotFound() {
  return (
    <div className="hero-glow relative overflow-hidden">
      <div aria-hidden className="blob -left-20 top-10 h-72 w-72 bg-brand-200/50 dark:bg-brand-900/25" />
      <div aria-hidden className="blob -right-16 bottom-0 h-72 w-72 bg-accent-200/50 dark:bg-accent-900/20" />
      <div className="relative mx-auto max-w-md px-4 py-24 text-center">
        <svg
          viewBox="0 0 40 20"
          aria-hidden
          className="mx-auto h-12 w-24 text-brand-700 dark:text-brand-300"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="10" cy="10" r="7.5" className="animate-drift" />
          <circle cx="30" cy="10" r="7.5" className="text-accent-500 dark:text-accent-300" />
        </svg>
        <h1 className="mt-6 text-display-md">This page drifted apart</h1>
        <p className="mt-3 text-ink-soft">
          The page you&apos;re looking for doesn&apos;t exist — or it was never
          revealed. Let&apos;s get you back to the people who matter.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/" className="btn-primary">
            Go home
          </Link>
          {/* The auth wrappers are display: contents, so they go around the
              button rather than on it (on the link they erase its box). */}
          <span className="auth-in">
            <Link href="/connections" className="btn-secondary">
              Your connections
            </Link>
          </span>
          <span className="auth-out">
            <Link href="/library" className="btn-secondary">
              Browse the library
            </Link>
          </span>
        </div>
      </div>
    </div>
  );
}
