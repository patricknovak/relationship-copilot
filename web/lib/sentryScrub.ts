// Scrubs every Sentry event before it leaves the Worker (worker/index.ts,
// `beforeSend`). The rule: no relationship text and no personal data may
// reach Sentry. So this is an allowlist, not a denylist: an event keeps only
// what locates a failure in code (exception type, a sanitised first line of
// the message, stack frames, the route pattern, release) and drops the rest
// (request headers, cookies, body, query, user, extra, breadcrumbs).
// Pure and unit-tested (sentryScrub.test.ts).

type Obj = Record<string, unknown>;

const MAX_MESSAGE = 200;
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

/**
 * The first line of an error message with anything that could carry user
 * text or identifiers replaced: quoted strings (Postgres echoes values in
 * quotes, providers return JSON), parenthesised row tuples, URLs, emails,
 * ids, long tokens and phone-like numbers. Later lines (Postgres DETAIL,
 * stack dumps) are dropped entirely.
 */
export function scrubMessage(input: unknown): string {
  if (typeof input !== "string" || input === "") return "";
  let s = input.split(/\r?\n/, 1)[0];
  s = s.replace(/https?:\/\/[^\s"'<>)]+/gi, (u) => {
    try {
      return `[url ${new URL(u).host}]`;
    } catch {
      return "[url]";
    }
  });
  s = s.replace(/"(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?|“[^”]*”?|‘[^’]*’?|`[^`]*`?/g, "[redacted]");
  s = s.replace(/\(([^()]*,[^()]*)\)/g, "([redacted])");
  s = s.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]");
  s = s.replace(UUID, "[id]");
  // Keys and JWT segments: any long run, except a digit-free path such as
  // /api/cron/daily-reminder, which stays readable.
  s = s.replace(/[A-Za-z0-9_\-+/=]{24,}/g, (t) => (t.includes("/") && !/\d/.test(t) ? t : "[token]"));
  s = s.replace(/\+?\d[\d\s().-]{6,}\d/g, "[number]");
  return s.length > MAX_MESSAGE ? `${s.slice(0, MAX_MESSAGE)}…` : s;
}

// A path segment survives only if it reads like a route name: lowercase
// letters joined by "-" or "." (file routes like robots.txt), an optional
// leading "_" (/_vinext), or a route-pattern param like "[id]". Invite codes
// are 8 characters, so 8-letter words are dropped too unless they are a known
// static route (routeSegments.test in sentryScrub.test.ts walks app/).
const ROUTE_WORD = /^_?[a-z]+(?:[.-][a-z]+)*$/;
const PATTERN_PARAM = /^\[{1,2}(?:\.\.\.)?[A-Za-z]+\]{1,2}$/;
const STATIC_EIGHT = new Set(["callback"]);

function keepSegment(seg: string): boolean {
  if (seg === "") return true;
  if (PATTERN_PARAM.test(seg)) return true;
  if (!ROUTE_WORD.test(seg)) return false;
  return seg.length !== 8 || STATIC_EIGHT.has(seg);
}

/** Pathname only (no origin, query or fragment), dynamic segments as ":param". */
export function scrubPath(input: unknown): string {
  if (typeof input !== "string" || input === "") return "";
  let path = input;
  try {
    path = new URL(input, "https://x.invalid").pathname;
  } catch {
    path = input.split(/[?#]/, 1)[0];
  }
  return path
    .split("/")
    .map((seg) => (keepSegment(seg) ? seg : ":param"))
    .join("/");
}

/** "GET /invite/AB12CD34" → "GET /invite/:param". */
export function scrubTransaction(input: unknown): string {
  if (typeof input !== "string" || input === "") return "";
  const m = /^([A-Z]+)\s+(\S+)$/.exec(input);
  if (m) return `${m[1]} ${scrubPath(m[2])}`;
  return input.startsWith("/") ? scrubPath(input) : scrubMessage(input);
}

function pick(src: unknown, keys: readonly string[]): Obj | undefined {
  if (!src || typeof src !== "object") return undefined;
  const out: Obj = {};
  for (const k of keys) {
    const v = (src as Obj)[k];
    if (v !== undefined) out[k] = v;
  }
  return out;
}

const TOP_LEVEL = [
  "event_id",
  "timestamp",
  "start_timestamp",
  "platform",
  "level",
  "release",
  "dist",
  "environment",
  "sdk",
  "type",
  "fingerprint",
  "logger",
  "debug_meta",
] as const;

const FRAME_KEYS = ["filename", "abs_path", "module", "function", "lineno", "colno", "in_app", "platform"] as const;

/** Tags we set ourselves (worker/index.ts); everything else is dropped. */
export const ALLOWED_TAGS = ["route", "route_type", "handler", "cron"] as const;

function scrubException(value: unknown): Obj | undefined {
  if (!value || typeof value !== "object") return undefined;
  const v = value as Obj;
  const out: Obj = {};
  if (typeof v.type === "string") out.type = scrubMessage(v.type);
  if (v.value !== undefined) out.value = scrubMessage(v.value);
  const mechanism = pick(v.mechanism, ["type", "handled", "synthetic", "exception_id", "parent_id", "is_exception_group", "source"]);
  if (mechanism) out.mechanism = mechanism;
  const frames = (v.stacktrace as Obj | undefined)?.frames;
  if (Array.isArray(frames)) {
    out.stacktrace = { frames: frames.map((f) => pick(f, FRAME_KEYS) ?? {}) };
  }
  return out;
}

/**
 * The event Sentry may receive. Never throws: if anything about the event is
 * unexpected, the worst case is a sparser event, not a leak.
 */
export function scrubEvent<T extends object>(event: T): T {
  const src = event as Obj;
  const out: Obj = {};
  for (const k of TOP_LEVEL) if (src[k] !== undefined) out[k] = src[k];

  if (src.transaction !== undefined) out.transaction = scrubTransaction(src.transaction);
  if (src.message !== undefined) out.message = scrubMessage(src.message);
  if (src.logentry && typeof src.logentry === "object") {
    out.logentry = { message: scrubMessage((src.logentry as Obj).message) };
  }

  const values = (src.exception as Obj | undefined)?.values;
  if (Array.isArray(values)) {
    out.exception = { values: values.map(scrubException).filter(Boolean) };
  }

  const req = src.request as Obj | undefined;
  if (req && typeof req === "object") {
    const r: Obj = {};
    if (typeof req.method === "string") r.method = req.method;
    if (req.url !== undefined) r.url = scrubPath(req.url);
    out.request = r;
  }

  const tags = pick(src.tags, ALLOWED_TAGS);
  if (tags && Object.keys(tags).length) {
    for (const k of Object.keys(tags)) {
      tags[k] = k === "route" ? scrubPath(String(tags[k])) : scrubMessage(String(tags[k]));
    }
    out.tags = tags;
  }

  const contexts = src.contexts as Obj | undefined;
  if (contexts && typeof contexts === "object") {
    const c: Obj = {};
    const runtime = pick(contexts.runtime, ["name", "version"]);
    if (runtime) c.runtime = runtime;
    const trace = pick(contexts.trace, ["trace_id", "span_id", "parent_span_id"]);
    if (trace) c.trace = trace;
    if (Object.keys(c).length) out.contexts = c;
  }

  return out as T;
}
