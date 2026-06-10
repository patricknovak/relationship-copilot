// Validate post-login redirect targets. Only same-origin absolute paths are
// allowed — anything else (protocol-relative //host, schemes, backslash
// tricks, header-splitting chars) falls back. Pure so it runs on both the
// client (login page) and the server (auth callback, the authority).

export function safeNextPath(
  next: string | null | undefined,
  fallback = "/connections",
): string {
  if (!next) return fallback;
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (next.includes("\\") || /[\r\n]/.test(next)) return fallback;
  return next;
}
