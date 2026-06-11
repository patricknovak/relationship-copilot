import Link from "next/link";

export default function NotFound() {
  return (
    <div className="hero-glow">
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <svg
          viewBox="0 0 28 20"
          aria-hidden
          className="mx-auto h-10 w-14 text-brand-700"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="10" cy="10" r="7.5" />
          <circle cx="18" cy="10" r="7.5" className="text-brand-400" />
        </svg>
        <h1 className="mt-6 text-4xl">This page drifted apart</h1>
        <p className="mt-3 text-ink-soft">
          The page you&apos;re looking for doesn&apos;t exist — or it was never
          revealed. Let&apos;s get you back to the people who matter.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link href="/" className="btn-primary">
            Go home
          </Link>
          <Link href="/connections" className="btn-secondary">
            Your connections
          </Link>
        </div>
      </div>
    </div>
  );
}
