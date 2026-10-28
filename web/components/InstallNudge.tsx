"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";

const STORAGE_KEY = "rc-install-nudge-dismissed";

type Mode = "ios" | "prompt" | null;

// Chromium's install event; not in the DOM typings.
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
}

function isIos(): boolean {
  const ua = window.navigator.userAgent;
  // iPadOS reports a Mac user agent; touch points tell them apart.
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/**
 * After a pair's first reveal, on a phone, one dismissable card suggests
 * adding the site to the Home Screen. On iPhone that is the only way web push
 * can reach someone, so without it "your turn" nudges never arrive there.
 * Shown once: dismissing (or installing) hides it on this device for good.
 */
export default function InstallNudge({ pushAvailable }: { pushAvailable: boolean }) {
  const [mode, setMode] = useState<Mode>(null);
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") return;
    } catch {
      /* storage unavailable: still fine to show */
    }
    if (isStandalone()) return;
    if (!window.matchMedia("(pointer: coarse)").matches) return;

    if (isIos()) {
      setMode("ios");
      return;
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallPromptEvent);
      setMode("prompt");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setMode(null);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice.catch(() => undefined);
    dismiss();
  }

  if (!mode) return null;

  const why = pushAvailable
    ? "so it can tell you when it's your turn"
    : "so today's question is one tap away";

  return (
    <aside className="card-tint mt-6 animate-fade-up" aria-label="Add to Home Screen">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-surface text-brand-700 shadow-soft dark:text-brand-200">
          <Icon name="bell" className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-lg text-ink">Keep it on your Home Screen</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            Add Relationship Copilot to your Home Screen {why}.
          </p>
          {mode === "ios" ? (
            <ol className="mt-3 space-y-1.5 text-sm text-ink">
              <li className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-800 dark:bg-brand-900/40 dark:text-brand-100">1</span>
                Tap <Icon name="share" className="h-4 w-4" /> Share in Safari&apos;s toolbar.
              </li>
              <li className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-800 dark:bg-brand-900/40 dark:text-brand-100">2</span>
                Choose &ldquo;Add to Home Screen&rdquo;.
              </li>
              {pushAvailable && (
                <li className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-800 dark:bg-brand-900/40 dark:text-brand-100">3</span>
                  Open it from there, then turn on notifications in Account.
                </li>
              )}
            </ol>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {mode === "prompt" && (
              <button type="button" onClick={install} className="btn-primary btn-sm">
                Add to Home Screen
              </button>
            )}
            <button type="button" onClick={dismiss} className="btn-ghost btn-sm">
              {mode === "ios" ? "Got it" : "Not now"}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
