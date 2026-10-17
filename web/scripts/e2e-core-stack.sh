#!/usr/bin/env bash
# Start a throwaway local Supabase stack (Docker) with this repo's
# migrations, for the signed-in core-loop e2e (playwright.core.config.ts).
# Writes the stack's local demo keys to $1 (default ./e2e-core.env) as
# E2E_SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL and
# NEXT_PUBLIC_SUPABASE_ANON_KEY. Never points at production.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="${1:-$PWD/e2e-core.env}"
DIR="$(mktemp -d)"
CLI="npx --yes supabase@2.121.0"

cd "$DIR"
$CLI init --force >/dev/null
rm -rf supabase/migrations
cp -r "$ROOT/supabase/migrations" supabase/migrations
$CLI start -x studio,imgproxy,edge-runtime,logflare,vector,supavisor,postgres-meta,storage-api,mailpit

eval "$($CLI status -o env 2>/dev/null | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=')"
{
  echo "E2E_SUPABASE_URL=$API_URL"
  echo "E2E_SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY"
  echo "NEXT_PUBLIC_SUPABASE_URL=$API_URL"
  echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY"
} > "$OUT"
echo "local Supabase stack ready at $API_URL (env in $OUT)"
