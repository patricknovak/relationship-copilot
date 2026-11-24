// Validate post-login redirect targets. Only same-origin absolute paths are
// allowed — anything else (protocol-relative //host, schemes, backslash
// tricks, control characters) falls back. Browsers strip tabs and newlines
// from a URL before resolving it, so "/\t/evil.example" would otherwise be
// followed as "//evil.example"; every control character is refused. Pure so
// it runs on both the client (login page) and the server (auth callback, the
// authority).

export function safeNextPath(
  next: string | null | undefined,
  fallback = "/connections",
): string {
  if (!next) return fallback;
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (next.includes("\\") || /[\u0000-\u001f\u007f]/.test(next)) return fallback;
  return next;
}
