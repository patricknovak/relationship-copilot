// What the notification system needs from the environment, and what is
// missing. Pure (takes the env as an argument) so it is unit-tested; the
// callers are lib/notify.ts, the cron routes and /api/health.
//
// Why this exists: for the first week of real use the Worker had push keys
// but no RESEND_API_KEY / NOTIFY_SECRET, and every "your turn" and reveal
// email was skipped without a trace. A missing secret must be loud:
//   * every skipped event is written to audit_log (notify.skipped_config),
//     so it can be counted from the database;
//   * each hourly cron tick reports it as an error (Sentry + Workers Logs);
//   * /api/health says which channels can send.
// Only variable names ever appear here, never values.

type Env = Record<string, string | undefined>;

export interface NotificationConfigReport {
  /** Email can send: RESEND_API_KEY and NOTIFY_SECRET are both set. */
  email: boolean;
  /** Web push can send: both VAPID keys are set. */
  push: boolean;
  /** Names of the variables that are missing for a channel to work. */
  missing: string[];
}

const set = (env: Env, name: string) => !!env[name]?.trim();

export function notificationConfigReport(env: Env = process.env): NotificationConfigReport {
  const missing: string[] = [];
  for (const name of ["RESEND_API_KEY", "NOTIFY_SECRET", "VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"]) {
    if (!set(env, name)) missing.push(name);
  }
  return {
    email: set(env, "RESEND_API_KEY") && set(env, "NOTIFY_SECRET"),
    push: set(env, "VAPID_PUBLIC_KEY") && set(env, "VAPID_PRIVATE_KEY"),
    missing,
  };
}

/** The variables email is waiting on (empty when email can send). */
export function missingForEmail(env: Env = process.env): string[] {
  return ["RESEND_API_KEY", "NOTIFY_SECRET"].filter((name) => !set(env, name));
}

/**
 * Email is the channel everyone has (push is opt-in per device), so a
 * production deploy without it is a misconfiguration, not a quiet mode.
 * Carries variable names only.
 */
export class NotificationConfigError extends Error {
  constructor(missing: readonly string[]) {
    super(`notification email is off: missing ${missing.join(" and ")}`);
    this.name = "NotificationConfigError";
  }
}

/**
 * The error to raise for this environment, or null when email can send or
 * this is not a production build (local dev and tests run without email).
 */
export function emailConfigProblem(env: Env = process.env): NotificationConfigError | null {
  if (env.NODE_ENV !== "production") return null;
  const missing = missingForEmail(env);
  return missing.length ? new NotificationConfigError(missing) : null;
}
