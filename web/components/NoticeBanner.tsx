// Server-rendered banner for ?error= / ?notice= query params — the landing
// spot for server actions that redirect back with a message instead of
// crashing into the error boundary.
export default function NoticeBanner({
  message,
  tone = "error",
}: {
  message?: string | null;
  tone?: "error" | "info" | "success";
}) {
  if (!message) return null;
  const styles =
    tone === "error"
      ? "border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200"
      : tone === "success"
        ? "border-brand-200 dark:border-brand-800/60 bg-brand-50/70 dark:bg-brand-900/25 text-brand-800 dark:text-brand-200"
        : "border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200";
  return (
    <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${styles}`} role="status">
      {message}
    </div>
  );
}
