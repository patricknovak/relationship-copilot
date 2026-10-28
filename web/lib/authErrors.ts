// Plain-language versions of the errors Supabase Auth returns to the login
// form. Raw messages ("captcha protection: request disallowed
// (invalid-input-secret)") read like the site is broken and leak config
// details; these say what happened and what to do.

export function friendlyAuthError(message: string | null | undefined): string {
  const m = (message ?? "").toLowerCase();
  if (!m) return "Something went wrong sending your link. Please try again.";
  if (m.includes("captcha"))
    return "The security check didn't go through. Refresh the page and try again, or continue with Google.";
  if (m.includes("rate limit") || m.includes("too many") || m.includes("for security purposes"))
    return "That's a few links in a short time. Please wait a minute, then try again.";
  if (m.includes("invalid") && m.includes("email"))
    return "That email address doesn't look right. Check it and try again.";
  if (m.includes("signups not allowed") || m.includes("signup is disabled"))
    return "New sign-ups by email aren't open right now. Please continue with Google.";
  if (m.includes("network") || m.includes("fetch"))
    return "We couldn't reach the server. Check your connection and try again.";
  return "We couldn't send your link just now. Please try again in a moment.";
}
