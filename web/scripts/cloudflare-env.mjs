#!/usr/bin/env node
/**
 * One-time copy of the web app's environment from Vercel to Cloudflare.
 *
 * Usage (from `web/`, logged in to the Vercel and Cloudflare CLIs):
 *
 *   npx vercel env pull .env.cloudflare --environment=production
 *   node scripts/cloudflare-env.mjs .env.cloudflare --dry-run   # names only
 *   node scripts/cloudflare-env.mjs .env.cloudflare             # upload
 *   rm .env.cloudflare
 *
 * What it does:
 *   - Server variables (everything except NEXT_PUBLIC_*, Vercel system and
 *     unused Vercel Postgres variables) go to the Worker with
 *     `wrangler secret bulk`. Secrets persist across deploys.
 *   - NEXT_PUBLIC_* values are build-time only. They live in
 *     `web/.env.production` (committed public config). CI builds from that
 *     file — do **not** set them as GitHub Actions variables (an empty GH
 *     variable overrides the file). This script never uploads them.
 *   - Variables Vercel marks "sensitive" come back from `env pull` as the
 *     placeholder "[SENSITIVE]" (older CLIs: empty). They are listed and
 *     never uploaded; set them with `npx wrangler secret put NAME`.
 *
 * No value is ever printed.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/** Server variables the deployed app cannot run without. */
const REQUIRED = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "XAI_API_KEY",
  "XAI_MODEL",
];

// POSTGRES_* and the extra SUPABASE_* names are injected by the Vercel
// Supabase integration; the app does not read them.
const SKIP_PREFIXES = ["VERCEL", "TURBO_", "NX_", "POSTGRES_"];
const SKIP_NAMES = new Set(["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_JWT_SECRET", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]);

/** The Worker in wrangler.jsonc. Named explicitly so the upload does not
 *  depend on which commit (and wrangler config) the local checkout has. */
const WORKER_NAME = "relationship-copilot";

/** What `vercel env pull` writes instead of a sensitive value. */
const VERCEL_SENSITIVE_PLACEHOLDER = "[SENSITIVE]";

/** True when the pulled value is not a real value (empty or placeholder). */
function isUnpulledValue(value) {
  const v = (value ?? "").trim();
  return v === "" || v === VERCEL_SENSITIVE_PLACEHOLDER;
}

/** Minimal dotenv parser for `vercel env pull` output (KEY="value"). */
export function parseDotenv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let value = m[2];
    if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
      value = value.slice(1, -1).replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    } else if (value.startsWith("'") && value.endsWith("'") && value.length >= 2) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, "");
    }
    out[m[1]] = value;
  }
  return out;
}

/** Split pulled variables into Worker secrets, public build vars, empties. */
export function classify(vars) {
  const secrets = {};
  const publicVars = {};
  const empty = [];
  for (const [key, value] of Object.entries(vars)) {
    if (SKIP_PREFIXES.some((p) => key.startsWith(p)) || SKIP_NAMES.has(key)) continue;
    if (isUnpulledValue(value)) {
      empty.push(key);
      continue;
    }
    if (key.startsWith("NEXT_PUBLIC_")) publicVars[key] = value;
    else secrets[key] = value;
  }
  const missing = REQUIRED.filter((k) => !(k in secrets));
  return { secrets, publicVars, empty: empty.sort(), missing };
}

function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  const dryRun = args.includes("--dry-run");
  const toGithub = args.includes("--github");
  if (!file) {
    console.error("Usage: node scripts/cloudflare-env.mjs <pulled .env file> [--dry-run]");
    process.exit(2);
  }

  const { secrets, publicVars, empty, missing } = classify(parseDotenv(readFileSync(file, "utf8")));

  console.log(`Worker secrets (${Object.keys(secrets).length}): ${Object.keys(secrets).sort().join(", ")}`);
  console.log(
    `Build-time NEXT_PUBLIC_* (${Object.keys(publicVars).length}) — already in web/.env.production; not uploaded: ${Object.keys(publicVars).sort().join(", ")}`,
  );
  if (empty.length) {
    console.log(`\nNot pulled (Vercel "sensitive": empty or [SENSITIVE]); set by hand with \`npx wrangler secret put NAME\`:\n  ${empty.join("\n  ")}`);
  }
  if (missing.length) {
    console.log(`\nRequired but not in the pull (set before cutover):\n  ${missing.join("\n  ")}`);
  }
  if (toGithub) {
    console.log(
      "\n--github is ignored: NEXT_PUBLIC_* must stay in web/.env.production. Setting them as GitHub Actions variables would override the file with empty values when unset.",
    );
  }
  if (dryRun) return;

  const dir = mkdtempSync(path.join(tmpdir(), "rc-cf-"));
  const secretsFile = path.join(dir, "secrets.json");
  try {
    writeFileSync(secretsFile, JSON.stringify(secrets), { mode: 0o600 });
    execFileSync("npx", ["wrangler", "secret", "bulk", secretsFile, "--name", WORKER_NAME], {
      stdio: "inherit",
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  console.log("\nWorker secrets uploaded. Confirm web/.env.production matches production NEXT_PUBLIC_* before the next deploy.");
}

if (import.meta.url === `file://${process.argv[1]}`) main();
