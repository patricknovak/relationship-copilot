// Stand-ins for the outbound providers, for the signed-in e2e suite only.
// Listens on loopback, records what the app sent and answers the way the real
// API would for the happy path. Nothing here ever reaches Resend, Stripe or
// xAI: the app is pointed at this server through E2E_RESEND_API_URL,
// E2E_STRIPE_API_URL (lib/e2eProviders.ts, loopback only) and XAI_BASE_URL.
//
//   POST /resend/emails                 Resend "send email"
//   POST /v1/checkout/sessions          Stripe Checkout session
//   POST /v1/billing_portal/sessions    Stripe Customer Portal session
//   DELETE /v1/subscriptions/:id        Stripe cancel subscription
//   GET  /pay/* and /portal/*           the pages those sessions redirect to
//   POST /xai/v1/chat/completions       refuses (no test may depend on AI text)
//   GET  /__emails, /__stripe           what was recorded, as JSON
//   GET  /__health
//
// Run by playwright.core.config.ts; `node e2e-core/fake-providers.mjs` works
// on its own too.
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

const port = Number(process.env.E2E_FAKE_PROVIDERS_PORT || 3199);
const origin = `http://127.0.0.1:${port}`;

/** @type {Array<Record<string, unknown>>} */
const emails = [];
/** @type {Array<Record<string, unknown>>} */
const stripeCalls = [];
// Resend answers a repeated Idempotency-Key with the first result.
const emailIdsByKey = new Map();

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function json(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json", "Request-Id": `req_${randomUUID()}` });
  res.end(text);
}

function html(res, title) {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(`<!DOCTYPE html><html lang="en"><head><title>${title}</title></head><body><h1>${title}</h1></body></html>`);
}

// Stripe sends application/x-www-form-urlencoded with bracketed keys
// (line_items[0][price]=…). Kept flat: tests read the keys as sent.
function form(body) {
  return Object.fromEntries(new URLSearchParams(body));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", origin);
  const path = url.pathname;
  try {
    if (req.method === "GET" && path === "/__health") return json(res, 200, { ok: true });
    if (req.method === "GET" && path === "/__emails") return json(res, 200, emails);
    if (req.method === "GET" && path === "/__stripe") return json(res, 200, stripeCalls);

    if (req.method === "POST" && path === "/resend/emails") {
      const auth = req.headers.authorization ?? "";
      if (!auth.startsWith("Bearer ")) {
        return json(res, 401, { name: "missing_api_key", message: "Missing API key" });
      }
      const payload = JSON.parse((await readBody(req)) || "{}");
      const key = req.headers["idempotency-key"] ?? null;
      if (typeof key === "string" && emailIdsByKey.has(key)) {
        return json(res, 200, { id: emailIdsByKey.get(key) });
      }
      const id = randomUUID();
      if (typeof key === "string") emailIdsByKey.set(key, id);
      emails.push({
        id,
        at: new Date().toISOString(),
        idempotencyKey: key,
        from: payload.from,
        to: payload.to,
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
        headers: payload.headers ?? {},
      });
      return json(res, 200, { id });
    }

    if (path.startsWith("/v1/")) {
      const auth = req.headers.authorization ?? "";
      if (!auth.startsWith("Bearer sk_test_")) {
        return json(res, 401, { error: { type: "invalid_request_error", message: "Invalid API Key provided" } });
      }
      const params = form(await readBody(req));
      const call = { at: new Date().toISOString(), method: req.method, path, params };

      if (req.method === "POST" && path === "/v1/checkout/sessions") {
        const id = `cs_test_${randomUUID().replace(/-/g, "")}`;
        stripeCalls.push({ ...call, id });
        return json(res, 200, {
          id,
          object: "checkout.session",
          mode: params.mode,
          url: `${origin}/pay/${id}`,
        });
      }
      if (req.method === "POST" && path === "/v1/billing_portal/sessions") {
        const id = `bps_test_${randomUUID().replace(/-/g, "")}`;
        stripeCalls.push({ ...call, id });
        return json(res, 200, {
          id,
          object: "billing_portal.session",
          customer: params.customer,
          url: `${origin}/portal/${id}`,
        });
      }
      const cancel = /^\/v1\/subscriptions\/([^/]+)$/.exec(path);
      if (req.method === "DELETE" && cancel) {
        stripeCalls.push({ ...call, id: cancel[1] });
        return json(res, 200, { id: cancel[1], object: "subscription", status: "canceled" });
      }
      stripeCalls.push({ ...call, unhandled: true });
      return json(res, 404, {
        error: { type: "invalid_request_error", message: `Unrecognized request URL (${req.method}: ${path}).` },
      });
    }

    if (req.method === "GET" && path.startsWith("/pay/")) return html(res, "Fake Stripe Checkout");
    if (req.method === "GET" && path.startsWith("/portal/")) return html(res, "Fake Stripe Billing Portal");

    // AI is "on" for the billing project only so checkout opens; no test
    // generates anything, and a call here should fail loudly, not invent text.
    if (path.startsWith("/xai/")) {
      return json(res, 503, { error: { message: "fake xAI: no completions in e2e" } });
    }

    return json(res, 404, { error: "not found" });
  } catch (err) {
    return json(res, 500, { error: err instanceof Error ? err.message : "fake provider error" });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`fake providers listening on ${origin}`);
});
