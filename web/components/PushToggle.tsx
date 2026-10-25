"use client";

import { useEffect, useState } from "react";
import { deletePushSubscription, savePushSubscription } from "@/app/actions/push";
import {
  currentSubscription,
  keyBytes,
  needsHomeScreenInstall,
  pushSupported,
  sameServerKey,
} from "@/components/pushDevice";

type State = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on";

// Account → Notifications: turn web push on or off for this browser. The
// same switches as email decide what is sent. Renders nothing when push
// isn't configured on the server (no VAPID key).
export default function PushToggle({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!vapidPublicKey) return;
    let cancelled = false;
    (async () => {
      if (!pushSupported()) {
        if (!cancelled) setState(needsHomeScreenInstall() ? "ios-install" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setState("denied");
        return;
      }
      let sub = await currentSubscription();
      if (sub && !sameServerKey(sub, vapidPublicKey)) {
        // The server's key pair was rotated, so this subscription is dead.
        // Replace it quietly when permission is already granted.
        await sub.unsubscribe();
        sub = null;
        if (Notification.permission === "granted") {
          const reg = await navigator.serviceWorker.getRegistration("/");
          sub =
            (await reg?.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: keyBytes(vapidPublicKey),
            })) ?? null;
        }
      }
      if (sub) {
        // Re-link to whoever is signed in now (a shared browser follows the
        // latest account; migration 0034).
        await savePushSubscription(sub.toJSON());
      }
      if (!cancelled) setState(sub ? "on" : "off");
    })().catch(() => {
      if (!cancelled) setState("unsupported");
    });
    return () => {
      cancelled = true;
    };
  }, [vapidPublicKey]);

  if (!vapidPublicKey) return null;

  async function turnOn() {
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(vapidPublicKey!),
      });
      const result = await savePushSubscription(sub.toJSON());
      if (!result.ok) {
        await sub.unsubscribe();
        setError(result.error ?? "Couldn't turn notifications on.");
        return;
      }
      setState("on");
    } catch {
      setError("Couldn't turn notifications on in this browser.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    setError(null);
    try {
      const sub = await currentSubscription();
      if (sub) {
        await deletePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    } catch {
      setError("Couldn't turn notifications off. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h2 className="text-sm font-semibold text-ink">Notifications on this device</h2>
      <p className="mt-1 text-sm text-ink-soft">
        A short alert when it&apos;s your turn, with the same switches as email.
        Never the answers themselves.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {state === "on" && (
          <>
            <span className="text-sm font-medium text-brand-700 dark:text-brand-300">
              On for this browser
            </span>
            <button
              type="button"
              onClick={turnOff}
              disabled={busy}
              className="btn-secondary btn-sm"
            >
              {busy ? "Turning off…" : "Turn off"}
            </button>
          </>
        )}
        {state === "off" && (
          <button type="button" onClick={turnOn} disabled={busy} className="btn-primary btn-sm">
            {busy ? "Turning on…" : "Turn on notifications"}
          </button>
        )}
        {state === "denied" && (
          <p className="text-sm text-ink-soft">
            Notifications are blocked for this site. Allow them in your browser&apos;s
            site settings, then reload this page.
          </p>
        )}
        {state === "ios-install" && (
          <p className="text-sm text-ink-soft">
            On iPhone and iPad, tap Share, then &ldquo;Add to Home Screen&rdquo;, and
            open Relationship Copilot from there to turn notifications on.
          </p>
        )}
        {state === "unsupported" && (
          <p className="text-sm text-ink-soft">This browser doesn&apos;t support notifications.</p>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </div>
  );
}
