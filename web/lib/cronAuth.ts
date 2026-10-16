import { timingSafeEqual } from "node:crypto";

/**
 * Authorize a cron route via `Authorization: Bearer <CRON_SECRET>`.
 * Comparison is constant-time so a guessed prefix cannot leak the secret.
 */
export function authorizeCronBearer(
  req: Request,
  secret: string | undefined | null = process.env.CRON_SECRET,
): boolean {
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
