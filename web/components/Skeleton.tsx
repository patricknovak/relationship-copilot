// Shared loading skeletons — pulse blocks in the brand tint.
export function SkeletonCard({ lines = 2 }: { lines?: number }) {
  return (
    <div className="card animate-pulse">
      <div className="h-5 w-2/5 rounded-full bg-brand-100 dark:bg-surface-line" />
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="mt-3 h-3.5 rounded-full bg-brand-100/70"
          style={{ width: `${85 - i * 18}%` }}
        />
      ))}
    </div>
  );
}

export function SkeletonPage({
  cards = 3,
  title = true,
}: {
  cards?: number;
  title?: boolean;
}) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      {title && (
        <div className="animate-pulse">
          <div className="h-8 w-1/2 rounded-full bg-brand-100 dark:bg-surface-line" />
          <div className="mt-3 h-4 w-3/4 rounded-full bg-brand-100/70" />
        </div>
      )}
      <div className="mt-8 space-y-4">
        {Array.from({ length: cards }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}
