"use client";

import { useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import type { ShareChannel, ShareTarget } from "@/lib/share";

// One share surface for the whole app: the native share sheet when the
// browser has one, copy-link always, then the messaging apps (and, for
// public pages, the social networks). Callers pass the exact text and URL,
// so nothing private can leak through here by accident.

const CHANNEL_META: Record<ShareChannel, { icon: IconName; tone: string }> = {
  native: { icon: "share", tone: "" },
  copy: { icon: "copy", tone: "" },
  sms: { icon: "message", tone: "text-emerald-600 dark:text-emerald-300" },
  whatsapp: { icon: "phone", tone: "text-green-600 dark:text-green-300" },
  telegram: { icon: "send", tone: "text-sky-600 dark:text-sky-300" },
  email: { icon: "mail", tone: "text-brand-700 dark:text-brand-300" },
  x: { icon: "x", tone: "text-ink" },
  facebook: { icon: "users", tone: "text-blue-600 dark:text-blue-300" },
  linkedin: { icon: "briefcase", tone: "text-sky-700 dark:text-sky-300" },
  threads: { icon: "chat", tone: "text-ink" },
  reddit: { icon: "compass", tone: "text-orange-600 dark:text-orange-300" },
};

export default function ShareSheet({
  url,
  text,
  title = "Relationship Copilot",
  targets,
  primaryLabel = "Share",
  onShared,
  compact = false,
}: {
  url: string;
  /** Text handed to the native sheet / clipboard message. */
  text: string;
  title?: string;
  targets: ShareTarget[];
  primaryLabel?: string;
  onShared?: (channel: ShareChannel) => void;
  compact?: boolean;
}) {
  const [canShare, setCanShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && !!navigator.share);
  }, []);

  async function native() {
    try {
      await navigator.share({ title, text, url });
      onShared?.("native");
    } catch {
      setNotice("Share cancelled. You can copy the link instead.");
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      onShared?.("copy");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setNotice("Couldn't copy automatically. Long-press the link to copy it.");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {canShare ? (
          <button type="button" onClick={native} className="btn-primary">
            <Icon name="share" className="h-4 w-4" />
            {primaryLabel}
          </button>
        ) : null}
        <button type="button" onClick={copy} className={canShare ? "btn-secondary" : "btn-primary"}>
          <Icon name={copied ? "check" : "copy"} className="h-4 w-4" />
          {copied ? "Link copied" : "Copy link"}
        </button>
      </div>

      <ul
        className={`grid gap-2 ${compact ? "grid-cols-4" : "grid-cols-4 sm:grid-cols-5"}`}
        aria-label="Share via"
      >
        {targets.map((t) => {
          const meta = CHANNEL_META[t.channel];
          const external = !t.href.startsWith("sms:") && !t.href.startsWith("mailto:");
          return (
            <li key={t.channel}>
              <a
                href={t.href}
                target={external ? "_blank" : undefined}
                rel={external ? "noreferrer" : undefined}
                onClick={() => onShared?.(t.channel)}
                className="group flex flex-col items-center gap-1.5 rounded-2xl border border-surface-line bg-surface px-2 py-3 text-center text-[11px] font-medium text-ink-soft transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-soft dark:bg-surface-raised"
              >
                <span className={`flex h-9 w-9 items-center justify-center rounded-full bg-paper-warm transition group-hover:scale-105 ${meta.tone}`}>
                  <Icon name={meta.icon} className="h-[18px] w-[18px]" />
                </span>
                {t.label}
              </a>
            </li>
          );
        })}
      </ul>

      {notice && (
        <p className="text-sm text-ink-soft" role="status">
          {notice}
        </p>
      )}
    </div>
  );
}
