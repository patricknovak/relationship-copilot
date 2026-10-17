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
echo "running daily-loop test"
run -f "$ROOT/supabase/tests/02_daily_test.sql"
echo "running account-lifecycle test"
run -f "$ROOT/supabase/tests/03_account_lifecycle_test.sql"
echo "running membership/profile RLS test"
run -f "$ROOT/supabase/tests/04_rls_membership_profiles_test.sql"
echo "running security-advisor cleanup test"
run -f "$ROOT/supabase/tests/05_security_advisor_cleanup_test.sql"
echo "running GA4 first-reveal claim test"
run -f "$ROOT/supabase/tests/06_ga4_first_reveal_claim_test.sql"
echo "running funnel step claims test"
run -f "$ROOT/supabase/tests/07_funnel_step_claims_test.sql"
echo "running retired-invite-codes test"
run -f "$ROOT/supabase/tests/08_retired_invite_codes_test.sql"
echo "running notification-log test"
run -f "$ROOT/supabase/tests/09_notification_log_test.sql"
echo "running connection-premium test"
run -f "$ROOT/supabase/tests/10_connection_premium_test.sql"
echo "running answer-reactions test"
run -f "$ROOT/supabase/tests/11_answer_reactions_test.sql"
echo "running connection-timezone test"
run -f "$ROOT/supabase/tests/12_connection_timezone_test.sql"
echo "running connection-goals test"
run -f "$ROOT/supabase/tests/14_connection_goals_test.sql"
echo "running timezone search_path test"
run -f "$ROOT/supabase/tests/15_timezone_search_path_test.sql"
echo "running others_have_answered_many test"
run -f "$ROOT/supabase/tests/16_others_have_answered_many_test.sql"
echo "running answer-first test"
run -f "$ROOT/supabase/tests/17_answer_first_test.sql"
echo "running push-subscriptions test"
run -f "$ROOT/supabase/tests/18_push_subscriptions_test.sql"
echo "running invite-notes test"
run -f "$ROOT/supabase/tests/19_invite_notes_test.sql"
echo "re-applying content seeds 0020 and 0024 (must be no-ops)"
run -f "$ROOT/supabase/migrations/0020_daily_pool_depth.sql"
run -f "$ROOT/supabase/migrations/0024_electives_depth.sql"
run -f "$ROOT/supabase/migrations/0029_first_twenty_everywhere.sql"
echo "running seed-idempotency test"
run -f "$ROOT/supabase/tests/13_seed_idempotency_test.sql"

psql -h "$HOST" -p "$PORT" -U "$USER" -d postgres -q -c "drop database if exists $DB;"
echo "OK"
