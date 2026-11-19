#!/usr/bin/env bash
set -euo pipefail
export APP_ENV=test EVOLUTION_URL=http://127.0.0.1:8181 WA_CALLBACK_ORIGIN=http://127.0.0.1:3192
EVOLUTION_API_KEY="$(openssl rand -hex 32)"
WA_WEBHOOK_KEY="$(openssl rand -hex 32)"
export EVOLUTION_API_KEY WA_WEBHOOK_KEY
echo "::add-mask::$EVOLUTION_API_KEY"
echo "::add-mask::$WA_WEBHOOK_KEY"
db="$(docker ps --filter ancestor=pgvector/pgvector:pg17 --format '{{.ID}}' | head -n1)"
docker exec "$db" createdb -U postgres evolution_ci
docker run -d --name vant_evo_cache --network host redis:7-alpine redis-server --bind 127.0.0.1 --port 6385 >/dev/null
trap 'docker rm -f vant_evo_ci vant_evo_cache >/dev/null 2>&1 || true' EXIT
docker run -d --name vant_evo_ci --network host \
 -e SERVER_PORT=8181 -e SERVER_URL="$EVOLUTION_URL" -e AUTHENTICATION_API_KEY="$EVOLUTION_API_KEY" \
 -e DATABASE_PROVIDER=postgresql -e "DATABASE_CONNECTION_URI=${ADMIN_DATABASE_URL%/*}/evolution_ci" \
 -e CACHE_REDIS_ENABLED=true -e CACHE_REDIS_URI=redis://127.0.0.1:6385 -e TELEMETRY_ENABLED=false \
 -e LOG_LEVEL=ERROR evoapicloud/evolution-api:v2.3.7 >/dev/null
for i in $(seq 1 60); do
 if curl -fsS --max-time 3 "$EVOLUTION_URL/" >/dev/null 2>&1; then break; fi
 sleep 2
done
curl -fsS --max-time 5 "$EVOLUTION_URL/" >/dev/null
node scripts/evolution-smoke.mjs
