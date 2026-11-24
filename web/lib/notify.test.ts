import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// notifyUser against a fake service-role client: what gets claimed, what
// gets released, and (the 2026-11 incident) what happens when no channel is
// configured. Email, audit and the admin client are mocked; nothing leaves.

const sendEmail = vi.fn();
const logAudit = vi.fn();
vi.mock("@/lib/email", () => ({
  emailConfigured: () => !!process.env.RESEND_API_KEY,
  sendEmail: (...args: unknown[]) => sendEmail(...args),
}));
vi.mock("@/lib/audit", () => ({ logAudit: (...args: unknown[]) => logAudit(...args) }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    throw new Error("tests pass their own admin client");
  },
}));

import { notifyUser } from "./notify";
import { setRequestErrorReporter } from "./errorReporting";
import { NotificationConfigError } from "./notifyConfig";

type Result = { data?: unknown; error?: { code?: string } | null; count?: number };

// A chainable stand-in for the query builder: every method returns the
// builder, and awaiting it yields the result registered for "table.verb".
function fakeAdmin(results: Record<string, Result>) {
  const calls: { table: string; verb: string; payload?: unknown }[] = [];
  const builder = (table: string) => {
    let verb = "select";
    const b: Record<string, unknown> = {};
    const chain = () => b;
    for (const m of ["eq", "in", "gte", "not", "maybeSingle"]) b[m] = chain;
    b.select = () => b;
    for (const m of ["insert", "update", "delete"]) {
      b[m] = (payload?: unknown) => {
        verb = m;
        calls.push({ table, verb, payload });
        return b;
      };
    }
    b.then = (resolve: (r: Result) => unknown) =>
      resolve(results[`${table}.${verb}`] ?? { data: null, error: null });
    return b;
  };
  const admin = {
    from: (table: string) => builder(table),
    auth: { admin: { getUserById: async () => ({ data: { user: { email: "sam@example.com" } }, error: null }) } },
  };
  return { admin: admin as never, calls };
}

const input = {
  userId: "user-1",
  instanceId: "inst-1",
  connectionId: "conn-1",
  kind: "your_turn" as const,
  themName: "Sam",
};

const claimed = { "notification_log.insert": { data: [{ instance_id: "inst-1" }], error: null } };

describe("notifyUser", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  const reporter = vi.fn();

  beforeEach(() => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("NOTIFY_SECRET", "secret");
    vi.stubEnv("VAPID_PUBLIC_KEY", "");
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    setRequestErrorReporter(reporter);
    sendEmail.mockReset();
    logAudit.mockReset();
    reporter.mockReset();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    errorSpy.mockRestore();
    setRequestErrorReporter(undefined);
  });

  it("claims, sends with a stable idempotency key, and audits", async () => {
    sendEmail.mockResolvedValue({ sent: true, id: "e1" });
    const { admin, calls } = fakeAdmin(claimed);
    expect(await notifyUser({ admin, ...input })).toBe("sent");
    expect(calls.filter((c) => c.verb === "insert")).toEqual([
      { table: "notification_log", verb: "insert", payload: { instance_id: "inst-1", user_id: "user-1", kind: "your_turn" } },
    ]);
    expect(calls.some((c) => c.verb === "delete")).toBe(false);
    const sent = sendEmail.mock.calls[0][0];
    expect(sent.to).toBe("sam@example.com");
    expect(sent.idempotencyKey).toBe("notify/your_turn/inst-1/user-1");
    expect(sent.unsubscribeUrl).toContain("/api/notifications/unsubscribe?u=user-1");
    expect(logAudit).toHaveBeenCalledWith("user-1", "notify.email", "inst-1", { kind: "your_turn" });
  });

  it("releases the claim when nothing was delivered, so a later run can retry", async () => {
    sendEmail.mockResolvedValue({ sent: false, reason: "rejected" });
    const { admin, calls } = fakeAdmin(claimed);
    expect(await notifyUser({ admin, ...input })).toBe("failed");
    expect(calls.filter((c) => c.table === "notification_log").map((c) => c.verb)).toEqual(["insert", "delete"]);
    expect(logAudit).not.toHaveBeenCalled();
  });

  it("treats only a unique violation as 'already sent'", async () => {
    const dup = fakeAdmin({ "notification_log.insert": { data: null, error: { code: "23505" } } });
    expect(await notifyUser({ admin: dup.admin, ...input })).toBe("skipped_dup");
    // A check-constraint or connection error is a failure, not a duplicate.
    const broken = fakeAdmin({ "notification_log.insert": { data: null, error: { code: "23514" } } });
    expect(await notifyUser({ admin: broken.admin, ...input })).toBe("failed");
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("respects the preference switch", async () => {
    const { admin, calls } = fakeAdmin({
      ...claimed,
      "profiles.select": { data: { preferences: { notifications: { your_turn: false } } }, error: null },
    });
    expect(await notifyUser({ admin, ...input })).toBe("skipped_pref");
    expect(calls).toEqual([]);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("does not email when preferences could not be read", async () => {
    const { admin } = fakeAdmin({ ...claimed, "profiles.select": { data: null, error: { code: "57014" } } });
    expect(await notifyUser({ admin, ...input })).toBe("failed");
    expect(sendEmail).not.toHaveBeenCalled();
  });

  describe("with email not configured", () => {
    beforeEach(() => {
      vi.stubEnv("RESEND_API_KEY", "");
      vi.stubEnv("NOTIFY_SECRET", "");
    });

    it("in production: records the skip in audit_log and reports it", async () => {
      vi.stubEnv("NODE_ENV", "production");
      const { admin, calls } = fakeAdmin(claimed);
      expect(await notifyUser({ admin, ...input })).toBe("skipped_config");
      expect(calls).toEqual([]); // nothing claimed: a later run can still send
      expect(logAudit).toHaveBeenCalledWith(null, "notify.skipped_config", "inst-1", {
        kind: "your_turn",
        missing: ["RESEND_API_KEY", "NOTIFY_SECRET"],
      });
      expect(reporter).toHaveBeenCalledTimes(1);
      expect(reporter.mock.calls[0][0]).toBeInstanceOf(NotificationConfigError);
      expect(JSON.stringify(errorSpy.mock.calls)).toContain("notify_skipped_config");
    });

    it("in production with push keys but no device: same loud skip", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("VAPID_PUBLIC_KEY", "pub");
      vi.stubEnv("VAPID_PRIVATE_KEY", "priv");
      const { admin } = fakeAdmin({ ...claimed, "push_subscriptions.select": { count: 0, error: null } });
      expect(await notifyUser({ admin, ...input })).toBe("skipped_config");
      expect(logAudit).toHaveBeenCalledWith(null, "notify.skipped_config", "inst-1", expect.anything());
    });

    it("cron callers skip without writing a row per candidate", async () => {
      vi.stubEnv("NODE_ENV", "production");
      const { admin } = fakeAdmin(claimed);
      expect(await notifyUser({ admin, ...input, recordConfigSkip: false })).toBe("skipped_config");
      expect(logAudit).not.toHaveBeenCalled();
      expect(reporter).not.toHaveBeenCalled();
    });

    it("outside production: logs, but no audit row and no error report", async () => {
      const { admin } = fakeAdmin(claimed);
      expect(await notifyUser({ admin, ...input })).toBe("skipped_config");
      expect(logAudit).not.toHaveBeenCalled();
      expect(reporter).not.toHaveBeenCalled();
    });
  });
});
