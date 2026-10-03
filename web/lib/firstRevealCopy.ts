// In-product first-reveal prompt copy (Patrick-approved activation package).
// Keep trust/privacy language aligned with LIVE Privacy / mutual-reveal FAQ.
// Prefer "your person" — not couples-only.

export const EMPTY_STATE = {
  headline: "Answer in private. Reveal together.",
  body: "Your person can't see your answers until you've both shared this prompt. That rule lives in the product — not only in the interface.",
  primaryCta: "Start answering",
  secondaryCta: "Invite your person",
  trustLine: "Safety resources are always free.",
} as const;

// Both members joined, onboarding instance ready, nobody has answered yet.
// `{n}` is the real question count for this connection's pack — never hardcode.
export const BOTH_JOINED = {
  headline: "You're both here.",
  primaryCta: "Start answering",
  secondaryCta: "Nudge them",
  reminderLink: "Not now? Add a reminder",
} as const;

export function bothJoinedBody(questionCount: number): string {
  // Never render "Your first 0 questions" if the pack is missing/empty.
  if (!Number.isFinite(questionCount) || questionCount < 1) {
    return "Your first questions are ready. Answer in private — your person can't see your answers until you've both shared.";
  }
  return `Your first ${questionCount} questions are ready. Answer in private — your person can't see your answers until you've both shared.`;
}

export function nudgeStartMessage(connectionUrl: string): string {
  return `We're both in on Relationship Copilot — want to answer our first questions this week? Designed so neither of us sees the other's answers until we've both shared.\n\n${connectionUrl}`;
}

export function nudgeFinishMessage(
  inviterName: string | null | undefined,
  connectionUrl: string,
): string {
  const who = inviterName?.trim() || "I";
  return `${who === "I" ? "I've" : `${who} has`} answered on Relationship Copilot — when you're ready, finish yours so we can reveal together. No peeking either way.\n\n${connectionUrl}`;
}

export const REMINDER_ICS = {
  title: "Answer our questions",
  description: (connectionUrl: string) =>
    `Your answers stay private until you've both shared. ${connectionUrl}`,
} as const;

export const WAITING_ON_THEM = {
  headline: "You're done. Waiting on them.",
  body: "Your answers stay hidden until they share too. No peeking — for either of you.",
  primaryCta: "Nudge them",
  secondaryCta: "Review your answers (still private)",
  helper:
    "You can change your mind before the reveal unlocks — until both have shared.",
} as const;

export const WAITING_ON_YOU = {
  headline: "They're ready when you are.",
  body: "They've answered in private. Finish yours to unlock the reveal side by side.",
  primaryCta: "Finish your answers",
  trustLine: "Neither of you can see the other's words early.",
} as const;

export const FIRST_REVEAL_UNLOCK = {
  headline: "You revealed together.",
  subhead: "Closer, on purpose.",
  body: "Here are your answers side by side. Talk about what surprised you — there's a place to discuss below.",
  primaryCta: "Read both answers",
  secondaryCta: "Start a discussion",
  tertiaryCta: "Continue to today's question",
} as const;

export const SOFT_PREMIUM = {
  headline: "Want a deeper reflection?",
  body: "Premium ($18/mo) adds the AI Blueprint and weekly digests. Reveals, discussion, the core library, and Safety stay free. Optional AI uses redacted inputs — we don't train models on your intimate answers.",
  primaryCta: "See Premium",
  dismiss: "Not now",
} as const;

export const MICROCOPY = {
  aboveQuestion: "Answer honestly. They'll only see this when you've both shared.",
  belowQuestion: "Private until mutual reveal.",
  submit: "Share when ready",
  updateSubmit: "Update my answers",
  confirmOnSubmit:
    "Shared. Still private to them until they share too.",
} as const;

export const SAFETY_INTERRUPT = {
  calm: "If you need support, Safety is free and private. Viewing resources doesn't notify anyone.",
} as const;

export const ACQUISITION = {
  headline: "Closer, on purpose.",
  body: "Answer thoughtful questions in private. Reveal together — only when you've both shared. One mutual reveal is enough to feel the difference: honesty without peeking, built into how the product works, not just promised in the app.",
  trustLine:
    "Free for the core experience. Safety always free. Premium ($18/mo) is optional for Blueprint and digests.",
  inviteCta: "Invite your person",
  startCta: "Start free",
} as const;
