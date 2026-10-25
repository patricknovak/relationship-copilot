import { Icon } from "@/components/ui/Icon";

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
      ? "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200"
      : tone === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200"
        : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200";
  const icon = tone === "error" ? "x" : tone === "success" ? "check" : "sparkles";
  return (
    <div
      className={`mt-4 flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm animate-fade-up ${styles}`}
      role="status"
    >
      <Icon name={icon} className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.2} />
      <span>{message}</span>
    </div>
  );
}
