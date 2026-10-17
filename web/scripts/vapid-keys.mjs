#!/usr/bin/env node
// Generate a VAPID key pair for web push and store it as Worker secrets
// without printing the private key.
//
//   node scripts/vapid-keys.mjs              # prints the public key only
//   node scripts/vapid-keys.mjs --wrangler   # also runs `wrangler secret put`
//                                            # for VAPID_PUBLIC_KEY and
//                                            # VAPID_PRIVATE_KEY on the Worker
//
// For Vercel (until the cutover), add the same two values as Sensitive env
// vars; run with --print-private to see the private key once, in a private
// terminal. Rotating the pair silently retires every existing browser
// subscription (people turn notifications on again from Account).
import { execFileSync } from "node:child_process";
import { webcrypto as crypto } from "node:crypto";

const b64url = (buf) => Buffer.from(buf).toString("base64url");

const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const publicKey = b64url(await crypto.subtle.exportKey("raw", pair.publicKey));
const privateKey = (await crypto.subtle.exportKey("jwk", pair.privateKey)).d;

console.log(`VAPID_PUBLIC_KEY=${publicKey}`);

if (process.argv.includes("--print-private")) {
  console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
}

if (process.argv.includes("--wrangler")) {
  const put = (name, value) =>
    execFileSync(
      "npx",
      ["wrangler", "secret", "put", name, "--name", "relationship-copilot"],
      { input: value, stdio: ["pipe", "inherit", "inherit"] },
    );
  put("VAPID_PUBLIC_KEY", publicKey);
  put("VAPID_PRIVATE_KEY", privateKey);
  console.log("Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY on the Worker.");
}
