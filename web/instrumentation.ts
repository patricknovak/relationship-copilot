import type { Instrumentation } from "next";
import { reportRequestError } from "@/lib/errorReporting";

// Unhandled errors in route handlers, server actions, rendering and the
// proxy. Only the method and the route pattern are passed on; the real path,
// headers and body stay here (lib/errorReporting.ts).
export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  reportRequestError(error, {
    method: request.method,
    routePath: context.routePath,
    routeType: context.routeType,
  });
};
