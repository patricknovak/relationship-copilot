// Shared loading skeletons — shimmering blocks in the brand tint.
function Bone({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-shimmer rounded-full bg-[linear-gradient(90deg,rgb(var(--surface-line))_0%,rgb(var(--paper-warm))_50%,rgb(var(--surface-line))_100%)] bg-[length:200%_100%] ${className}`}
    />
  );
}

export function SkeletonCard({ lines = 2 }: { lines?: number }) {
  return (
    <div className="card">
      <div className="flex items-center gap-3">
        <Bone className="h-10 w-10 !rounded-full" />
        <Bone className="h-5 w-2/5" />
      </div>
      {Array.from({ length: lines }).map((_, i) => (
        <Bone key={i} className="mt-3 h-3.5" />
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
    <div className="page">
      {title && (
        <div>
          <Bone className="h-3 w-24" />
          <Bone className="mt-3 h-9 w-1/2" />
          <Bone className="mt-3 h-4 w-3/4" />
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
