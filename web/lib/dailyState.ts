// Pure helpers for the daily loop's "where are we today" state, shared by the
// connection hub (today's question card) and the connections list ("your
// turn" badges). Inputs are booleans the caller already read through RLS, so
// nothing here can see an answer early.

export type DailyState =
  | "none" // no instance for today (connection not active, or pool empty)
  | "answer" // nobody has answered yet
  | "waiting" // you answered; waiting on them
  | "your_turn" // they answered; waiting on you
  | "revealed"; // both answered

export function dailyState(input: {
  hasInstance: boolean;
  status?: string | null;
  iAnswered: boolean;
  theyAnswered: boolean;
}): DailyState {
  if (!input.hasInstance) return "none";
  if (input.status === "revealed") return "revealed";
  if (input.iAnswered && !input.theyAnswered) return "waiting";
  if (!input.iAnswered && input.theyAnswered) return "your_turn";
  // Both answered but not yet revealed only happens in the instant before the
  // trigger flips the row; treat it as revealed-in-progress rather than lying.
  if (input.iAnswered && input.theyAnswered) return "revealed";
  return "answer";
}

// Short badge copy for the connections list. `null` means no badge.
export function dailyBadge(state: DailyState): {
  label: string;
  tone: "action" | "quiet" | "done";
} | null {
  switch (state) {
    case "your_turn":
      return { label: "Your turn", tone: "action" };
    case "answer":
      return { label: "Today's question", tone: "action" };
    case "waiting":
      return { label: "Waiting on them", tone: "quiet" };
    case "revealed":
      return { label: "Revealed today", tone: "done" };
    default:
      return null;
  }
}

// Card copy for the hub. `them` is the other person's first name or null.
export function dailyCardCopy(
  state: DailyState,
  them: string | null,
): { headline: string; body: string; cta: string } {
  const who = them?.trim() || "they";
  const Who = them?.trim() || "They";
  switch (state) {
    case "your_turn":
      return {
        headline: "Your turn.",
        body: `${Who} answered today's question. Finish yours to reveal both.`,
        cta: "Answer now",
      };
    case "waiting":
      return {
        headline: "You're done for today.",
        body: `Your answer stays private until ${who} share${who === "they" ? "" : "s"} too.`,
        cta: "Review your answer",
      };
    case "revealed":
      return {
        headline: "You both answered.",
        body: "See today's answers side by side and talk about it.",
        cta: "See the reveal",
      };
    case "answer":
      return {
        headline: "Today's question",
        body: "A fresh prompt each day. Answer in private; it reveals when you both have.",
        cta: "Answer today's question",
      };
    default:
      return {
        headline: "Today's question",
        body: "A fresh prompt each day to keep learning about each other.",
        cta: "Open today's question",
      };
  }
}

// Daily instances are keyed on the connection's local calendar date
// (migration 0025: `connections.timezone`, UTC until a member's browser sets
// it). These helpers produce the same YYYY-MM-DD the database would.
export function todayUtc(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function todayIn(tz: string | null | undefined, now: Date = new Date()): string {
  const zone = isValidTimeZone(tz) ? tz : "UTC";
  try {
    // en-CA formats as YYYY-MM-DD.
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    return todayUtc(now);
  }
}
