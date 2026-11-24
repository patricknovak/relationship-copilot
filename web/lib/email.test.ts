import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isRetryableStatus, sendEmail } from "./email";

const mail = {
  to: "sam@example.com",
  subject: "Sam answered",
  text: "t",
  html: "<p>t</p>",
  unsubscribeUrl: "https://relationshipcopilot.com/api/notifications/unsubscribe?u=x&t=y",
  idempotencyKey: "notify/your_turn/i/u",
};

const ok = () => new Response(JSON.stringify({ id: "email_1" }), { status: 200 });
const status = (code: number, name = "x") =>
  new Response(JSON.stringify({ name, message: "sam@example.com is bad" }), { status: code });

describe("sendEmail", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    errorSpy.mockRestore();
  });

  it("does not call the provider without an API key", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    expect(await sendEmail(mail)).toEqual({ sent: false, reason: "not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends once with the idempotency key and one-click unsubscribe headers", async () => {
    fetchMock.mockResolvedValueOnce(ok());
    expect(await sendEmail(mail)).toEqual({ sent: true, id: "email_1" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers["Idempotency-Key"]).toBe("notify/your_turn/i/u");
    const body = JSON.parse(init.body);
    expect(body.to).toEqual(["sam@example.com"]);
    expect(body.headers["List-Unsubscribe"]).toBe(`<${mail.unsubscribeUrl}>`);
    expect(body.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });

  it("retries once on a provider error, with the same key", async () => {
    fetchMock.mockResolvedValueOnce(status(503)).mockResolvedValueOnce(ok());
    expect(await sendEmail(mail, { retryDelayMs: 0 })).toEqual({ sent: true, id: "email_1" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].headers["Idempotency-Key"]).toBe("notify/your_turn/i/u");
  });

  it("retries once on a rate limit and on a network error", async () => {
    fetchMock.mockResolvedValueOnce(status(429)).mockResolvedValueOnce(ok());
    expect((await sendEmail(mail, { retryDelayMs: 0 })).sent).toBe(true);
    fetchMock.mockRejectedValueOnce(new TypeError("network")).mockResolvedValueOnce(ok());
    expect((await sendEmail(mail, { retryDelayMs: 0 })).sent).toBe(true);
  });

  it("gives up after two attempts", async () => {
    fetchMock.mockResolvedValue(status(500));
    expect(await sendEmail(mail, { retryDelayMs: 0 })).toEqual({ sent: false, reason: "rejected" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fetchMock.mockReset();
    fetchMock.mockRejectedValue(new TypeError("network"));
    expect(await sendEmail(mail, { retryDelayMs: 0 })).toEqual({ sent: false, reason: "failed" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry a request the provider will reject again", async () => {
    fetchMock.mockResolvedValue(status(422, "validation_error"));
    expect(await sendEmail(mail, { retryDelayMs: 0 })).toEqual({ sent: false, reason: "rejected" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("treats a 409 on our key as already delivered", async () => {
    fetchMock.mockResolvedValueOnce(status(409, "invalid_idempotent_request"));
    expect(await sendEmail(mail)).toEqual({ sent: true, id: null });
    // Without a key a 409 is just a rejection.
    fetchMock.mockResolvedValueOnce(status(409));
    const { idempotencyKey: _omit, ...noKey } = mail;
    void _omit;
    expect(await sendEmail(noKey)).toEqual({ sent: false, reason: "rejected" });
  });

  it("logs the provider's error code but never the address or message", async () => {
    fetchMock.mockResolvedValue(status(422, "validation_error"));
    await sendEmail(mail);
    fetchMock.mockRejectedValue(new TypeError("fetch to sam@example.com failed"));
    await sendEmail(mail, { retryDelayMs: 0 });
    const logged = JSON.stringify(errorSpy.mock.calls);
    expect(logged).toContain("validation_error");
    expect(logged).not.toContain("sam@example.com");
  });
});

describe("isRetryableStatus", () => {
  it("retries rate limits and server errors only", () => {
    expect([429, 500, 502, 503].every(isRetryableStatus)).toBe(true);
    expect([400, 401, 403, 404, 409, 422].some(isRetryableStatus)).toBe(false);
  });
});
