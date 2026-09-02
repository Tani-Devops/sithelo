#!/usr/bin/env bash
# ====================================================================
# Edge function authorization smoke tests.
# pgTAP (supabase/tests/database/) tests the DATABASE layer. This tests
# the HTTP layer — that internal-only functions actually reject calls
# without the service-role key, and that role-gated functions reject
# callers of the wrong role. Requires a running local Supabase instance
# (`supabase start`) and real test user access tokens.
#
# Usage:
#   export SUPABASE_URL=http://127.0.0.1:54321
#   export SUPABASE_ANON_KEY=...
#   export SUPABASE_SERVICE_ROLE_KEY=...
#   export ENTREPRENEUR_ACCESS_TOKEN=...   # a real logged-in entrepreneur's token
#   export INSTITUTION_ACCESS_TOKEN=...    # a real logged-in institution user's token
#   ./scripts/test-edge-function-auth.sh
# ====================================================================
set -uo pipefail

PASS=0
FAIL=0

expect_status() {
  local description="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then
    echo "PASS: $description (got $actual)"
    PASS=$((PASS + 1))
  else
    echo "FAIL: $description (expected $expected, got $actual)"
    FAIL=$((FAIL + 1))
  fi
}

echo "== Internal-only functions reject calls without the service-role key =="

for fn in calculate-trust-score match-businesses audit-logger compliance-monitor notification-engine; do
  status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$SUPABASE_URL/functions/v1/$fn" \
    -H "Authorization: Bearer ${ENTREPRENEUR_ACCESS_TOKEN:-invalid}" \
    -H "Content-Type: application/json" -d '{}')
  expect_status "$fn rejects a non-service-role caller" "403" "$status"
done

echo ""
echo "== Role-gated functions reject the wrong role =="

status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$SUPABASE_URL/functions/v1/admin-verification" \
  -H "Authorization: Bearer ${ENTREPRENEUR_ACCESS_TOKEN:-invalid}" \
  -H "Content-Type: application/json" \
  -d '{"verification_id":"00000000-0000-0000-0000-000000000000","decision":"approve"}')
expect_status "admin-verification rejects an entrepreneur caller" "403" "$status"

status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$SUPABASE_URL/functions/v1/bulk-import" \
  -H "Authorization: Bearer ${INSTITUTION_ACCESS_TOKEN:-invalid}" \
  -H "Content-Type: application/json" \
  -d '{"csv_storage_path":"fake.csv"}')
expect_status "bulk-import rejects an institution caller (admin-only)" "403" "$status"

status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$SUPABASE_URL/functions/v1/create-opportunity" \
  -H "Authorization: Bearer ${ENTREPRENEUR_ACCESS_TOKEN:-invalid}" \
  -H "Content-Type: application/json" \
  -d '{"title":"test","opportunity_type":"procurement"}')
expect_status "create-opportunity rejects an entrepreneur caller (institution/admin-only)" "403" "$status"

echo ""
echo "== No Authorization header at all =="

for fn in admin-verification bulk-import create-opportunity verify-business-passport generate-business-passport-pdf; do
  status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$SUPABASE_URL/functions/v1/$fn" \
    -H "Content-Type: application/json" -d '{}')
  expect_status "$fn rejects a request with no Authorization header" "401" "$status"
done

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
