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

// Badge for a connection still on its first set of questions (status
// pending or onboarding). With answer-first the inviter may have answered
// before their person joined. `null` falls back to the status label.
export function firstSetBadge(
  state: DailyState,
  partnerJoined: boolean,
): { label: string; tone: "action" | "quiet" | "done" } | null {
  switch (state) {
    case "your_turn":
      return { label: "Your turn", tone: "action" };
    case "waiting":
      return partnerJoined
        ? { label: "Waiting on them", tone: "quiet" }
        : { label: "Answered · invite pending", tone: "quiet" };
    case "answer":
    case "none":
      return partnerJoined ? { label: "First questions", tone: "action" } : null;
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

// ---- Catching up on earlier days ----
//
// A new daily question opens every local day, so a pair who answer on
// different days never meet on the same one: the first person's answer sits
// on yesterday's instance while the hub shows the second person a fresh
// question. These helpers pick out the earlier days that are waiting on the
// viewer, from booleans the caller already read through RLS (their own
// response rows and the boolean-only others_have_answered signal).

/** How far back the hub looks for earlier questions waiting on the viewer. */
export const CATCH_UP_WINDOW_DAYS = 30;
/** How many of them the hub lists at once (newest first). */
export const CATCH_UP_LIMIT = 5;

/** YYYY-MM-DD shifted by whole days (calendar arithmetic, no time zone). */
export function shiftDate(dateStr: string, deltaDays: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

/**
 * Earlier daily questions the other person has answered and the viewer has
 * not: still open, dated before the connection's local today. Newest first.
 */
export function catchUpDailies<
  T extends { id: string; scheduled_for: string | null; status?: string | null },
>(input: {
  instances: T[];
  today: string;
  answeredByMe: ReadonlySet<string>;
  answeredByThem: ReadonlySet<string>;
  limit?: number;
}): T[] {
  return input.instances
    .filter(
      (i) =>
        !!i.scheduled_for &&
        i.scheduled_for < input.today &&
        (i.status ?? "open") === "open" &&
        !input.answeredByMe.has(i.id) &&
        input.answeredByThem.has(i.id),
    )
    .sort((a, b) => (a.scheduled_for! < b.scheduled_for! ? 1 : -1))
    .slice(0, input.limit ?? CATCH_UP_LIMIT);
}

/** "November 19" for a YYYY-MM-DD calendar date, independent of server zone. */
export function formatDay(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Heading for a daily instance. Only the connection's current local day is
 * "Today's question"; an earlier one opened from the catch-up card, the
 * history, or an old link is named by its date.
 */
export function dailyHeading(
  scheduledFor: string | null | undefined,
  today: string,
): string {
  if (!scheduledFor || scheduledFor === today) return "Today's question";
  return `Question from ${formatDay(scheduledFor)}`;
}

/**
 * Copy for the hub's catch-up card: earlier daily questions, quizzes and
 * challenges the other person has answered. `them` is a first name or null.
 */
export function catchUpCopy(
  count: number,
  them: string | null,
): { headline: string; body: string } {
  const Who = them?.trim() || "They";
  const who = them?.trim() || "they";
  const verb = them?.trim() ? "is" : "are";
  return {
    headline:
      count === 1
        ? `${Who} ${verb} waiting on your answer.`
        : `${Who} ${verb} waiting on ${count} of your answers.`,
    body: `What ${who} wrote stays private until you answer too. Each one reveals as soon as you do.`,
  };
}
