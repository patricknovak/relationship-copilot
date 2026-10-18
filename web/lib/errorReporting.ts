// Request errors reach Sentry through Next's onRequestError hook
// (instrumentation.ts). On Cloudflare, worker/index.ts registers a reporter
// that forwards to Sentry; under `next dev` or on Vercel nothing is
// registered and errors only reach the platform logs. A globalThis hook keeps
// the Sentry SDK out of the Next.js bundle. The reporter only gets the route
// pattern ("/connections/[id]"), never the real path, headers or body.

export interface RequestErrorInfo {
  method: string;
  routePath: string;
  routeType: string;
}

export type RequestErrorReporter = (error: unknown, info: RequestErrorInfo) => void;

const KEY = Symbol.for("relationship-copilot.requestErrorReporter");

type WithReporter = { [KEY]?: RequestErrorReporter };

export function setRequestErrorReporter(reporter: RequestErrorReporter | undefined): void {
  (globalThis as WithReporter)[KEY] = reporter;
}

// Framework control flow (redirect(), notFound(), dynamic bailouts) is thrown
// as an error with a well-known digest; it is not a failure.
const CONTROL_FLOW_DIGEST = /^(NEXT_REDIRECT|NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK|DYNAMIC_SERVER_USAGE|BAILOUT_TO_CLIENT_SIDE_RENDERING)/;

export function isFrameworkControlFlow(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const digest = (error as { digest?: unknown }).digest;
  return typeof digest === "string" && CONTROL_FLOW_DIGEST.test(digest);
}

export function reportRequestError(error: unknown, info: RequestErrorInfo): void {
  if (isFrameworkControlFlow(error)) return;
  const reporter = (globalThis as WithReporter)[KEY];
  if (typeof reporter !== "function") return;
  try {
    reporter(error, info);
  } catch {
    // Reporting must never turn into a second failure.
  }
}
