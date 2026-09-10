#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-http://localhost:3000}"
SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:?NEXT_PUBLIC_SUPABASE_URL missing}"
ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY:?NEXT_PUBLIC_SUPABASE_ANON_KEY missing}"
TMP_DIR="${TMPDIR:-/tmp}/supracodex-real"
mkdir -p "$TMP_DIR"
rm -f "$TMP_DIR"/token_*.json
expect_status() {
  local expected="$1" url="$2"; shift 2
  local body status
  body=$(curl -sS -X GET -w '\n__STATUS__%{http_code}' "$@" "$url")
  status="${body##*__STATUS__}"
  body="${body%__STATUS__*}"
  printf '%-5s %s\n' "$status" "$url"
  test "$status" = "$expected"
  printf '%s' "$body"
}
login() {
  local role="$1" email="$2" password="$3"
  curl -sS -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
    -H "apikey: $ANON_KEY" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$email\",\"password\":\"$password\"}" > "$TMP_DIR/token_${role}.json"
  test "$(jq -r '.access_token // empty' "$TMP_DIR/token_${role}.json")" != ""
  printf 'auth %-7s 200\n' "$role"
}
expect_status 200 "$BASE/api/v1/expertises"
expect_status 200 "$BASE/api/v1/expertises?limit=2&page=1"
expect_status 422 "$BASE/api/v1/expertises?page=0"
expect_status 422 "$BASE/api/v1/expertises?limit=51"
expect_status 200 "$BASE/api/v1/expertises/cloud-devops"
expect_status 404 "$BASE/api/v1/expertises/formation-technique"
expect_status 422 "$BASE/api/v1/expertises/Cloud-DevOps"
expect_status 200 "$BASE/api/v1/projects?featured=true"
expect_status 422 "$BASE/api/v1/projects?featured=yes"
expect_status 200 "$BASE/api/v1/articles?category=technique"
expect_status 200 "$BASE/api/v1/articles?q=API"
expect_status 200 "$BASE/api/v1/site-config/public"
expect_status 404 "$BASE/api/v1/nimporte-quoi"
expect_status 404 "$BASE/api/v1/articles" -X POST
expect_status 422 "$BASE/api/v1/contact-messages" -X POST -H 'Content-Type: application/json' -d '{"name":"A","email":"bad","sujet":"x","message":"court"}'
expect_status 202 "$BASE/api/v1/contact-messages" -X POST -H 'Content-Type: application/json' -d '{"name":"Bot","email":"bot@x.fr","sujet":"Sujet","message":"0123456789","website":"http://spam"}'
login admin test-admin@supracodex.test 'Supra#Admin-2026!'
login editor test-editor@supracodex.test 'Supra#Editor-2026!'
login reviewer test-reviewer@supracodex.test 'Supra#Reviewer-2026!'
login readonly test-readonly@supracodex.test 'Supra#Readonly-2026!'
for role in admin editor reviewer readonly; do
  token=$(jq -r .access_token "$TMP_DIR/token_${role}.json")
  expect_status 200 "$BASE/api/v1/admin/me" -H "Authorization: Bearer $token"
done
admin=$(jq -r .access_token "$TMP_DIR/token_admin.json")
editor=$(jq -r .access_token "$TMP_DIR/token_editor.json")
reviewer=$(jq -r .access_token "$TMP_DIR/token_reviewer.json")
readonly=$(jq -r .access_token "$TMP_DIR/token_readonly.json")
expect_status 401 "$BASE/api/v1/admin/me" -H 'Authorization: Bearer abc.def.ghi'
expect_status 200 "$BASE/api/v1/admin/dashboard" -H "Authorization: Bearer $admin"
expect_status 200 "$BASE/api/v1/admin/dashboard" -H "Authorization: Bearer $editor"
expect_status 403 "$BASE/api/v1/admin/dashboard" -H "Authorization: Bearer $reviewer"
expect_status 403 "$BASE/api/v1/admin/dashboard" -H "Authorization: Bearer $readonly"
printf 'real smoke tests passed\n'
