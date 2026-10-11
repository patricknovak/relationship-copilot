/**
 * Cloudflare Worker entry: vinext's request handler, unchanged. The app has
 * no scheduled jobs, so there is no `scheduled` handler.
 */
import vinextHandler from "vinext/server/fetch-handler";

export * from "vinext/server/fetch-handler";
export default vinextHandler;
