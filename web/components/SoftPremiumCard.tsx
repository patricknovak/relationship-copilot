"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SOFT_PREMIUM } from "@/lib/firstRevealCopy";
import { Icon } from "@/components/ui/Icon";

const STORAGE_KEY = "rc-soft-premium-after-reveal-dismissed";

// Optional, dismissible Premium path — only after a mutual reveal, never
// blocking answers/discussion. Local dismiss so it stays soft.
export default function SoftPremiumCard() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") return;
    } catch {
      /* storage unavailable — still show once this session */
    }
    setVisible(true);
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <aside
      className="card-tint mt-8 animate-fade-up"
      aria-label="Optional Premium"
    >
      <h3 className="flex items-center gap-2 font-display text-lg text-ink">
        <Icon name="wand" className="h-5 w-5 text-brand-600 dark:text-brand-300" />
        {SOFT_PREMIUM.headline}
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
        {SOFT_PREMIUM.body}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Link href="/pricing" className="btn-secondary btn-sm">
          {SOFT_PREMIUM.primaryCta}
        </Link>
        <button
          type="button"
          onClick={dismiss}
          className="btn-ghost btn-sm"
        >
          {SOFT_PREMIUM.dismiss}
        </button>
      </div>
    </aside>
  );
}
