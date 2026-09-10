#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-http://localhost:3000}"
ROOT="${TMPDIR:-/tmp}/supra-phase-c-$$"; mkdir -p "$ROOT"
set -a; . ./.env; set +a
api() {
  local name="$1" expected="$2" method="$3" path="$4" token="$5"; shift 5
  local status body
  if [ -n "$token" ]; then body=$(curl -sS -X "$method" -w '\n__STATUS__%{http_code}' -H "Authorization: Bearer $token" "$@" "$BASE$path"); else body=$(curl -sS -X "$method" -w '\n__STATUS__%{http_code}' "$@" "$BASE$path"); fi
  status="${body##*__STATUS__}"; body="${body%__STATUS__*}"
  printf '%-38s %s (attendu %s)\n' "$name" "$status" "$expected"
  test "$status" = "$expected" || { printf '%s' "$body" > "$ROOT/fail-$name.json"; return 1; }
  printf '%s' "$body" > "$ROOT/$name.json"
}
login() { local role="$1" email="$2" password="$3"; curl -sS -X POST "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/token?grant_type=password" -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" -H 'Content-Type: application/json' -d "{\"email\":\"$email\",\"password\":\"$password\"}" > "$ROOT/$role-token.json"; jq -e '.access_token' "$ROOT/$role-token.json" >/dev/null; }
login admin test-admin@supracodex.test 'Supra#Admin-2026!'; login editor test-editor@supracodex.test 'Supra#Editor-2026!'; login reviewer test-reviewer@supracodex.test 'Supra#Reviewer-2026!'; login readonly test-readonly@supracodex.test 'Supra#Readonly-2026!'
admin=$(jq -r .access_token "$ROOT/admin-token.json"); editor=$(jq -r .access_token "$ROOT/editor-token.json"); reviewer=$(jq -r .access_token "$ROOT/reviewer-token.json"); readonly=$(jq -r .access_token "$ROOT/readonly-token.json")
api C01-admin-me 200 GET /api/v1/admin/me "$admin"; jq -e '.data.role=="admin"' "$ROOT/C01-admin-me.json" >/dev/null
api C02-editor-me 200 GET /api/v1/admin/me "$editor"; jq -e '.data.role=="editor"' "$ROOT/C02-editor-me.json" >/dev/null
api C03-reviewer-me 200 GET /api/v1/admin/me "$reviewer"; jq -e '.data.role=="reviewer"' "$ROOT/C03-reviewer-me.json" >/dev/null
api C04-readonly-me 200 GET /api/v1/admin/me "$readonly"; jq -e '.data.role=="readonly"' "$ROOT/C04-readonly-me.json" >/dev/null
api C05-no-token 401 GET /api/v1/admin/me ''
api C06-invalid-token 401 GET /api/v1/admin/me 'abc.def.ghi'
api C07-dashboard-admin 200 GET /api/v1/admin/dashboard "$admin"
api C08-dashboard-editor 200 GET /api/v1/admin/dashboard "$editor"
api C09-dashboard-reviewer 403 GET /api/v1/admin/dashboard "$reviewer"
api C10-dashboard-readonly 403 GET /api/v1/admin/dashboard "$readonly"
api C11-admin-articles 200 GET /api/v1/admin/articles "$editor"
api C12-admin-articles-published 200 GET '/api/v1/admin/articles?status=published' "$editor"
api C13-admin-articles-badstatus 422 GET '/api/v1/admin/articles?status=foo' "$editor"
api C14-reviewer-articles 403 GET /api/v1/admin/articles "$reviewer"
slug="recette-finale-$$"
article_body="{\"type\":\"article\",\"title\":\"Article recette finale\",\"excerpt\":\"Résumé de recette finale.\",\"slug\":\"$slug\",\"body\":[{\"type\":\"p\",\"text\":\"Contenu de test réel\"}],\"categoryId\":null,\"tagIds\":[]}"
api C15-create-article 201 POST /api/v1/admin/articles "$editor" -H 'Content-Type: application/json' -d "$article_body"
id=$(jq -r '.data.id' "$ROOT/C15-create-article.json"); test "$id" != null -a "$id" != ""
api C16-get-article 200 GET "/api/v1/admin/articles/$id" "$editor"; jq -e '.data.status=="draft"' "$ROOT/C16-get-article.json" >/dev/null
api C17-get-bad-uuid 422 GET /api/v1/admin/articles/abc "$editor"
api C18-get-missing 404 GET /api/v1/admin/articles/00000000-0000-0000-0000-000000000000 "$editor"
api C19-patch-draft 200 PATCH "/api/v1/admin/articles/$id" "$editor" -H 'Content-Type: application/json' -d "{\"type\":\"article\",\"title\":\"Article recette finale v2\",\"excerpt\":\"Résumé v2.\",\"slug\":\"${slug}-v2\",\"body\":[{\"type\":\"p\",\"text\":\"Contenu v2\"}],\"categoryId\":null,\"tagIds":[]}"
api C20-patch-reviewer-403 403 PATCH "/api/v1/admin/articles/$id" "$reviewer" -H 'Content-Type: application/json' -d "$article_body"
api C21-submit-editor 200 POST "/api/v1/admin/articles/$id/submit" "$editor"; jq -e '.data.status=="review"' "$ROOT/C21-submit-editor.json" >/dev/null
api C22-reject-editor-403 403 POST "/api/v1/admin/articles/$id/reject" "$editor"
api C23-reject-reviewer 200 POST "/api/v1/admin/articles/$id/reject" "$reviewer"; jq -e '.data.status=="draft"' "$ROOT/C23-reject-reviewer.json" >/dev/null
api C24-publish-direct-409 409 POST "/api/v1/admin/articles/$id/publish" "$admin"
api C25-submit-again 200 POST "/api/v1/admin/articles/$id/submit" "$editor"
api C26-publish-no-cover-409 409 POST "/api/v1/admin/articles/$id/publish" "$admin"
api C27-preview-editor 201 POST "/api/v1/admin/articles/$id/preview" "$editor"
preview=$(jq -r '.data.token' "$ROOT/C27-preview-editor.json"); test "$preview" != null -a "$preview" != ""
api C28-preview-public 200 GET "/api/v1/admin/preview/$preview" ''
api C29-preview-readonly-403 403 POST "/api/v1/admin/articles/$id/preview" "$readonly"
media_body='{"filename":"recette-final.png","contentBase64":"iVBORw0KGgo=","mimeType":"image/png","visibility":"public","altText":"Visuel recette finale"}'
api C30-media-list-admin 200 GET /api/v1/admin/media "$admin"
api C31-media-list-public 200 GET '/api/v1/admin/media?visibility=public' "$editor"
api C32-media-list-badvisibility 422 GET '/api/v1/admin/media?visibility=secret' "$editor"
api C33-media-list-reviewer-403 403 GET /api/v1/admin/media "$reviewer"
api C34-media-upload-editor 201 POST /api/v1/admin/media "$editor" -H 'Content-Type: application/json' -d "$media_body"
media=$(jq -r '.data.id' "$ROOT/C34-media-upload-editor.json"); test "$media" != null -a "$media" != ""
api C35-media-upload-reviewer-403 403 POST /api/v1/admin/media "$reviewer" -H 'Content-Type: application/json' -d "$media_body"
api C36-media-bad-extension 422 POST /api/v1/admin/media "$editor" -H 'Content-Type: application/json' -d "${media_body/recette-final.png/note.exe}"
api C37-media-bad-mime 422 POST /api/v1/admin/media "$editor" -H 'Content-Type: application/json' -d "${media_body/image\/png/application\/pdf}"
api C38-media-missing-alt 422 POST /api/v1/admin/media "$editor" -H 'Content-Type: application/json' -d '{"filename":"no-alt.png","contentBase64":"iVBORw0KGgo=","mimeType":"image/png"}'
api C39-media-detail 200 GET "/api/v1/admin/media/$media" "$editor"
api C40-media-bad-id 422 GET /api/v1/admin/media/abc "$editor"
api C41-media-patch 200 PATCH "/api/v1/admin/media/$media" "$editor" -H 'Content-Type: application/json' -d '{"altText":"Visuel mis à jour"}'
api C42-media-signed-url 200 POST "/api/v1/admin/media/$media/signed-url" "$editor" -H 'Content-Type: application/json' -d '{"expiresIn":3600}'
api C43-media-derivatives 200 GET "/api/v1/admin/media/$media/derivatives" "$editor"
api C44-media-orphans 200 GET /api/v1/admin/media/orphans "$editor"
api C45-media-delete-editor-403 403 DELETE "/api/v1/admin/media/$media" "$editor"
api C46-article-patch-cover 200 PATCH "/api/v1/admin/articles/$id" "$editor" -H 'Content-Type: application/json' -d "{\"type\":\"article\",\"title\":\"Article publiable\",\"excerpt\":\"Résumé publiable.\",\"slug\":\"${slug}-v3\",\"body\":[{\"type\":\"p\",\"text\":\"Couverture fournie\"}],\"coverMediaId\":\"$media\",\"categoryId\":null,\"tagIds":[]}"
api C47-publish-admin 200 POST "/api/v1/admin/articles/$id/publish" "$admin"; jq -e '.data.status=="published"' "$ROOT/C47-publish-admin.json" >/dev/null
api C48-patch-published-409 409 PATCH "/api/v1/admin/articles/$id" "$editor" -H 'Content-Type: application/json' -d "$article_body"
api C49-archive-admin 200 POST "/api/v1/admin/articles/$id/archive" "$admin"; jq -e '.data.status=="archived"' "$ROOT/C49-archive-admin.json" >/dev/null
api C50-unarchive-admin 200 POST "/api/v1/admin/articles/$id/unarchive" "$admin"; jq -e '.data.status=="draft"' "$ROOT/C50-unarchive-admin.json" >/dev/null
api C51-delete-published-editor-403 403 DELETE "/api/v1/admin/articles/$id" "$editor"
api C52-delete-draft-admin 204 DELETE "/api/v1/admin/articles/$id" "$admin"
api C53-media-delete-admin 204 DELETE "/api/v1/admin/media/$media" "$admin"
api C54-messages-admin 200 GET /api/v1/admin/messages "$admin"
api C55-messages-editor-403 403 GET /api/v1/admin/messages "$editor"
api C56-messages-badstatus 422 GET '/api/v1/admin/messages?status=foo' "$admin"
message=$(jq -r '.data[0].id // empty' "$ROOT/C54-messages-admin.json")
if [ -n "$message" ]; then api C57-message-patch 200 PATCH "/api/v1/admin/messages/$message" "$admin" -H 'Content-Type: application/json' -d '{"status":"read","assignedTo":null}'; else echo 'C57-message-patch SKIP (aucun message)'; fi
api C58-message-missing 404 PATCH /api/v1/admin/messages/00000000-0000-0000-0000-000000000000 "$admin" -H 'Content-Type: application/json' -d '{"status":"read"}'
api C59-audit-admin 200 GET /api/v1/admin/audit-events "$admin"
api C60-audit-editor-403 403 GET /api/v1/admin/audit-events "$editor"
api C61-audit-readonly-403 403 GET /api/v1/admin/audit-events "$readonly"
api C62-audit-pagination 200 GET '/api/v1/admin/audit-events?limit=5&page=2' "$admin"
api C63-users-admin 200 GET '/api/v1/admin/users?limit=10&page=1' "$admin"
jq -e '.data|map(.email)|index("test-admin@supracodex.test")' "$ROOT/C63-users-admin.json" >/dev/null
api C64-users-editor-403 403 GET /api/v1/admin/users "$editor"
api C65-users-pagination 200 GET '/api/v1/admin/users?limit=2&page=1' "$admin"
api C66-role-bad 422 POST /api/v1/admin/users/217d5384-67f4-43c5-a298-bc14043e791d/roles "$admin" -H 'Content-Type: application/json' -d '{"role":"superboss"}'
api C67-role-missing 404 POST /api/v1/admin/users/00000000-0000-0000-0000-000000000000/roles "$admin" -H 'Content-Type: application/json' -d '{"role":"editor"}'
api C68-role-editor-403 403 POST /api/v1/admin/users/c134403c-bb05-427e-82d6-d025a839666b/roles "$editor" -H 'Content-Type: application/json' -d '{"role":"editor"}'
api C69-role-remove-bad 422 DELETE /api/v1/admin/users/217d5384-67f4-43c5-a298-bc14043e791d/roles/boss "$admin"
api C70-role-self-admin-409 409 DELETE /api/v1/admin/users/217d5384-67f4-43c5-a298-bc14043e791d/roles/admin "$admin"
printf 'PHASE C PASSED\n'
