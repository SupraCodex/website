#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-http://localhost:3000}"
TMP="${TMPDIR:-/tmp}/supra-phase-a"
rm -rf "$TMP"; mkdir -p "$TMP"
run() {
  local name="$1" expected="$2" method="$3" path="$4"; shift 4
  local status body
  body=$(curl -sS -X "$method" -w '\n__STATUS__%{http_code}' "$@" "$BASE$path")
  status="${body##*__STATUS__}"; body="${body%__STATUS__*}"
  printf '%-34s %s (attendu %s)\n' "$name" "$status" "$expected"
  test "$status" = "$expected"
  printf '%s' "$body" > "$TMP/$name.json"
}
run 'A01 expertises-list' 200 GET /api/v1/expertises
jq -e '.data|length==3 and (map(.slug)|sort==["cloud-devops","cybersecurite-hacking-ethique","developpement-web-mobile"])' "$TMP/A01 expertises-list.json" >/dev/null
run 'A02 expertises-page' 200 GET '/api/v1/expertises?limit=2&page=1'
jq -e '.meta.total==3 and (.data|length)<=2' "$TMP/A02 expertises-page.json" >/dev/null
run 'A03 expertises-tag' 200 GET '/api/v1/expertises?tag=cloud-devops'
jq -e '.data|length==1 and .[0].slug=="cloud-devops"' "$TMP/A03 expertises-tag.json" >/dev/null
run 'A04 expertises-page0' 422 GET '/api/v1/expertises?page=0'
run 'A05 expertises-limit51' 422 GET '/api/v1/expertises?limit=51'
run 'A06 expertises-badtag' 422 GET '/api/v1/expertises?tag=NAVIGU%40'
run 'A07 expertise-detail' 200 GET /api/v1/expertises/cloud-devops
run 'A08 expertise-draft' 404 GET /api/v1/expertises/formation-technique
run 'A09 expertise-missing' 404 GET /api/v1/expertises/inexistant
run 'A10 expertise-badslug' 422 GET /api/v1/expertises/Cloud-DevOps
run 'A11 projects-list' 200 GET /api/v1/projects
jq -e '.data|length==3' "$TMP/A11 projects-list.json" >/dev/null
run 'A12 projects-featured' 200 GET '/api/v1/projects?featured=true'
jq -e '.data|length==1 and .[0].slug=="supracodex-hub"' "$TMP/A12 projects-featured.json" >/dev/null
run 'A13 projects-badfeatured' 422 GET '/api/v1/projects?featured=yes'
run 'A14 projects-expertise' 200 GET '/api/v1/projects?expertise=cloud-devops'
jq -e '.data|length==1' "$TMP/A14 projects-expertise.json" >/dev/null
run 'A15 projects-emptyexpertise' 200 GET '/api/v1/projects?expertise=formation-technique'
jq -e '.data|length==0' "$TMP/A15 projects-emptyexpertise.json" >/dev/null
run 'A16 project-detail' 200 GET /api/v1/projects/supracodex-hub
run 'A17 project-missing' 404 GET /api/v1/projects/inexistant
run 'A18 project-badslug' 422 GET /api/v1/projects/Introuvable
run 'A19 articles-list' 200 GET /api/v1/articles
run 'A20 articles-category' 200 GET '/api/v1/articles?category=technique'
jq -e '.data|length==2' "$TMP/A20 articles-category.json" >/dev/null
run 'A21 articles-absentcategory' 200 GET '/api/v1/articles?category=homepods'
jq -e '.data|length==0' "$TMP/A21 articles-absentcategory.json" >/dev/null
run 'A22 articles-search' 200 GET '/api/v1/articles?q=API'
run 'A23 articles-specialq' 200 GET '/api/v1/articles?q=()%2C*'
run 'A24 article-detail' 200 GET /api/v1/articles/securiser-un-formulaire-de-contact
jq -e '.data.body|type=="array"' "$TMP/A24 article-detail.json" >/dev/null
run 'A25 article-missing' 404 GET /api/v1/articles/inexistant
run 'A26 careers-list' 200 GET /api/v1/careers
jq -e '.data|type=="array"' "$TMP/A26 careers-list.json" >/dev/null
career=$(jq -r '.data[0].slug // empty' "$TMP/A26 careers-list.json")
if [ -n "$career" ]; then run 'A27 career-detail' 200 GET "/api/v1/careers/$career"; else echo 'A27 career-detail SKIP (aucune carrière staging)'; fi
run 'A28 site-config' 200 GET /api/v1/site-config/public
jq -e '.data.settings.site_name|type=="string"' "$TMP/A28 site-config.json" >/dev/null
run 'A29 contact-valid' 202 POST /api/v1/contact-messages -H 'Content-Type: application/json' -d '{"name":"Jean Test","email":"jean.test@example.com","sujet":"Demande de démo","message":"Bonjour, je souhaite en savoir plus sur vos services."}'
run 'A30 contact-shortname' 422 POST /api/v1/contact-messages -H 'Content-Type: application/json' -d '{"name":"A","email":"a@b.fr","sujet":"Sujet","message":"0123456789"}'
run 'A31 contact-shortmessage' 422 POST /api/v1/contact-messages -H 'Content-Type: application/json' -d '{"name":"Jean","email":"a@b.fr","sujet":"Sujet","message":"court"}'
run 'A32 contact-bademail' 422 POST /api/v1/contact-messages -H 'Content-Type: application/json' -d '{"name":"Jean","email":"pas-un-email","sujet":"Sujet","message":"0123456789"}'
run 'A33 contact-badjson' 422 POST /api/v1/contact-messages -H 'Content-Type: application/json' --data-raw '{invalide'
run 'A34 contact-honeypot' 202 POST /api/v1/contact-messages -H 'Content-Type: application/json' -d '{"name":"Bot","email":"bot@x.fr","sujet":"Sujet","message":"0123456789","website":"http://spam"}'
run 'A35 unknown-route' 404 GET /api/v1/nimporte-quoi
run 'A36 public-post-list' 404 POST /api/v1/articles
run 'A37 public-delete' 404 DELETE /api/v1/expertises/x
printf 'PHASE A PASSED\n'
