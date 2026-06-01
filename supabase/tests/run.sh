#!/usr/bin/env bash
# Validate the Supabase migrations + RLS reveal gate against a throwaway Postgres.
#
# Works with either:
#   - the Supabase CLI's local db, or
#   - a plain Postgres (we apply supabase/tests/00_supabase_stubs.sql first).
#
# Usage:
#   PGHOST=/tmp PGPORT=55432 PGUSER=postgres ./supabase/tests/run.sh
set -euo pipefail

HOST="${PGHOST:-/tmp}"
PORT="${PGPORT:-55432}"
USER="${PGUSER:-postgres}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DB="rc_test_$$"

psql -h "$HOST" -p "$PORT" -U "$USER" -d postgres -q \
  -c "drop database if exists $DB;" -c "create database $DB;"

run() { psql -h "$HOST" -p "$PORT" -U "$USER" -d "$DB" -v ON_ERROR_STOP=1 -q "$@"; }

run -f "$ROOT/supabase/tests/00_supabase_stubs.sql"
for m in "$ROOT"/supabase/migrations/*.sql; do
  echo "applying $(basename "$m")"
  run -f "$m"
done
echo "running reveal-gate test"
run -f "$ROOT/supabase/tests/01_reveal_gate_test.sql"

psql -h "$HOST" -p "$PORT" -U "$USER" -d postgres -q -c "drop database if exists $DB;"
echo "OK"
