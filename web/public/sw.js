// Relationship Copilot service worker: web push only (no offline caching).
// Payloads are decrypted by the browser; they carry a title, a generic line
// and a same-origin path, never answer text.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

function safePath(url) {
  return typeof url === "string" && url.startsWith("/") && !url.startsWith("//")
    ? url
    : "/connections";
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title =
    typeof data.title === "string" && data.title ? data.title.slice(0, 80) : "Relationship Copilot";
  const body = typeof data.body === "string" ? data.body.slice(0, 200) : "";
  const options = {
    body,
    icon: "/push-icon.png",
    badge: "/push-icon.png",
    data: { url: safePath(data.url) },
  };
  if (typeof data.tag === "string" && data.tag) options.tag = data.tag.slice(0, 64);
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(safePath(event.notification.data && event.notification.data.url), self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const w of windows) {
        if (w.url === target && "focus" in w) return w.focus();
      }
      return self.clients.openWindow(target);
    })(),
  );
});
