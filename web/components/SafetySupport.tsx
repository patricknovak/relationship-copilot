import Link from "next/link";
import { INLINE_RESOURCES, SAFETY_NOTE, SAFETY_PRIVACY_LINE } from "@/lib/safety";
import { Icon } from "@/components/ui/Icon";

// What the writer sees after the free safety screen flags something they
// wrote. "high": crisis resources. "elevated": a quiet, private pointer.
// Rendered only for the writer; the other person is never told.
export default function SafetySupport({ level }: { level: "high" | "elevated" }) {
  if (level === "elevated") {
    return (
      <p
        role="status"
        className="flex items-start gap-2 rounded-2xl border border-surface-line bg-surface/70 px-4 py-3 text-sm text-ink-soft dark:bg-surface-raised/60"
      >
        <Icon name="lifebuoy" className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-300" />
        <span>
          If any of this is weighing on you, support is free and private.{" "}
          <Link href="/safety" className="link">
            See Safety resources
          </Link>
          . Nobody is notified.
        </span>
      </p>
    );
  }
  return (
    <div
      role="status"
      className="rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/50 dark:bg-rose-950/40"
    >
      <p className="text-sm text-rose-900 dark:text-rose-200">{SAFETY_NOTE}</p>
      <p className="mt-2 text-xs text-rose-800/80 dark:text-rose-200/80">{SAFETY_PRIVACY_LINE}</p>
      <ul className="mt-3 space-y-1.5 text-sm text-rose-900 dark:text-rose-100">
        {INLINE_RESOURCES.map((r) => (
          <li key={r.name}>
            <span className="font-medium">{r.name}</span>
            {" — "}
            {r.contact}
          </li>
        ))}
      </ul>
      <Link href="/safety" className="link mt-3 inline-block text-sm">
        More Safety resources
      </Link>
    </div>
  );
}
