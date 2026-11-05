declare namespace NodeJS {
  interface ProcessEnv {
    /** GA4 Measurement Protocol measurement id (non-secret; also wrangler vars). */
    GA4_MEASUREMENT_ID?: string;
    /** GA4 Measurement Protocol API secret (Worker secret). */
    GA4_API_SECRET?: string;
    /**
     * Server-only HMAC salt for pseudonymous MP client_id.
     * Required for any Measurement Protocol send; unset → fail closed.
     * Set with: npx wrangler secret put GA4_CLIENT_ID_SALT --name relationship-copilot
     */
    GA4_CLIENT_ID_SALT?: string;
  }
}

export {};
