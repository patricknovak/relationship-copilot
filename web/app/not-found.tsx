import Link from "next/link";

export default function NotFound() {
  return (
    <div className="hero-glow relative overflow-hidden">
      <div className="blob -left-20 top-10 h-72 w-72 bg-brand-200/50 dark:bg-brand-900/25" />
      <div className="blob -right-16 bottom-0 h-72 w-72 bg-accent-200/50 dark:bg-accent-900/20" />
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
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link href="/" className="btn-primary">
            Go home
          </Link>
          <Link href="/connections" className="btn-secondary auth-in">
            Your connections
          </Link>
          <Link href="/library" className="btn-secondary auth-out">
            Browse the library
          </Link>
        </div>
      </div>
    </div>
  );
}
