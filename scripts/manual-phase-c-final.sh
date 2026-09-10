#!/usr/bin/env bash
set -euo pipefail
BASE=http://localhost:3000; ROOT="${1:?root}"; id="${2:?article}"; media="${3:?media}"
set -a; . ./.env; set +a
admin=$(jq -r .access_token "$ROOT/admin-token.json"); editor=$(jq -r .access_token "$ROOT/editor-token.json"); readonly=$(jq -r .access_token "$ROOT/readonly-token.json")
api(){ name=$1; expected=$2; method=$3; path=$4; token=$5; shift 5; if [ -n "$token" ]; then body=$(curl -sS -X "$method" -w '\n__STATUS__%{http_code}' -H "Authorization: Bearer $token" "$@" "$BASE$path"); else body=$(curl -sS -X "$method" -w '\n__STATUS__%{http_code}' "$@" "$BASE$path"); fi; status=${body##*__STATUS__}; body=${body%__STATUS__*}; printf '%-36s %s (attendu %s)\n' "$name" "$status" "$expected"; test "$status" = "$expected"; printf '%s' "$body" > "$ROOT/$name.json"; }
api C44-media-orphans 200 GET /api/v1/admin/media/orphans "$editor"
api C45-media-delete-editor-403 403 DELETE "/api/v1/admin/media/$media" "$editor"
api C46-article-patch-cover 200 PATCH "/api/v1/admin/articles/$id" "$editor" -H 'Content-Type: application/json' -d "{\"type\":\"article\",\"title\":\"Article publiable\",\"excerpt\":\"Résumé publiable.\",\"slug\":\"recette-reprise-v3\",\"body\":[{\"type\":\"p\",\"text\":\"Couverture fournie\"}],\"coverMediaId\":\"$media\",\"categoryId\":null,\"tagIds\":[]}"
api C47-publish-admin 200 POST "/api/v1/admin/articles/$id/publish" "$admin"
api C48-patch-published-409 409 PATCH "/api/v1/admin/articles/$id" "$editor" -H 'Content-Type: application/json' -d '{"type":"article","title":"x","excerpt":"x","slug":"x","body":[],"categoryId":null,"tagIds":[]}'
api C49-archive-admin 200 POST "/api/v1/admin/articles/$id/archive" "$admin"
api C50-unarchive-admin 200 POST "/api/v1/admin/articles/$id/unarchive" "$admin"
api C51-delete-draft-editor-403 403 DELETE "/api/v1/admin/articles/$id" "$editor"
api C52-delete-draft-admin 204 DELETE "/api/v1/admin/articles/$id" "$admin"
api C53-media-delete-admin 204 DELETE "/api/v1/admin/media/$media" "$admin"
api C54-messages-admin 200 GET /api/v1/admin/messages "$admin"
api C55-messages-editor-403 403 GET /api/v1/admin/messages "$editor"
api C56-messages-badstatus 422 GET '/api/v1/admin/messages?status=foo' "$admin"
message=$(jq -r '.data[0].id // empty' "$ROOT/C54-messages-admin.json"); if [ -n "$message" ]; then api C57-message-patch 200 PATCH "/api/v1/admin/messages/$message" "$admin" -H 'Content-Type: application/json' -d '{"status":"read","assignedTo":null}'; fi
api C58-message-missing 404 PATCH /api/v1/admin/messages/00000000-0000-0000-0000-000000000000 "$admin" -H 'Content-Type: application/json' -d '{"status":"read"}'
api C59-audit-admin 200 GET /api/v1/admin/audit-events "$admin"
api C60-audit-editor-403 403 GET /api/v1/admin/audit-events "$editor"
api C61-audit-readonly-403 403 GET /api/v1/admin/audit-events "$readonly"
api C62-audit-pagination 200 GET '/api/v1/admin/audit-events?limit=5&page=2' "$admin"
api C63-users-admin 200 GET '/api/v1/admin/users?limit=10&page=1' "$admin"
api C64-users-editor-403 403 GET /api/v1/admin/users "$editor"
api C65-users-pagination 200 GET '/api/v1/admin/users?limit=2&page=1' "$admin"
api C66-role-bad 422 POST /api/v1/admin/users/217d5384-67f4-43c5-a298-bc14043e791d/roles "$admin" -H 'Content-Type: application/json' -d '{"role":"superboss"}'
api C67-role-missing 404 POST /api/v1/admin/users/00000000-0000-0000-0000-000000000000/roles "$admin" -H 'Content-Type: application/json' -d '{"role":"editor"}'
api C68-role-editor-403 403 POST /api/v1/admin/users/c134403c-bb05-427e-82d6-d025a839666b/roles "$editor" -H 'Content-Type: application/json' -d '{"role":"editor"}'
api C69-role-remove-bad 422 DELETE /api/v1/admin/users/217d5384-67f4-43c5-a298-bc14043e791d/roles/boss "$admin"
api C70-role-self-admin-409 409 DELETE /api/v1/admin/users/217d5384-67f4-43c5-a298-bc14043e791d/roles/admin "$admin"
printf 'PHASE C FINAL PASSED\n'
