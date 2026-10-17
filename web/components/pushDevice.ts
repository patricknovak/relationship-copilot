// Browser-only helpers for this device's web push subscription.

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

// iPhone/iPad only allow web push from a site added to the Home Screen.
export function needsHomeScreenInstall(): boolean {
  if (typeof window === "undefined") return false;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

export function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const b64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Whether a subscription was made with this server key (rotation check). */
export function sameServerKey(sub: PushSubscription, base64url: string): boolean {
  const have = sub.options?.applicationServerKey;
  if (!have) return true; // browser doesn't expose it; assume current
  const a = new Uint8Array(have);
  const b = keyBytes(base64url);
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration("/");
  return (await reg?.pushManager.getSubscription()) ?? null;
}

// Stop notifications on this device (sign-out on a shared browser). Local
// only: the push service then answers 410 and the server drops the row on
// the next send, so this works even after the session cookie is gone.
export async function forgetPushOnThisDevice(): Promise<void> {
  try {
    const sub = await currentSubscription();
    await sub?.unsubscribe();
  } catch {
    /* best effort */
  }
}
