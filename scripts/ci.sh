#!/usr/bin/env bash
set -euo pipefail
export APP_ENV=test
npm install --ignore-scripts --no-audit --no-fund
node --check scripts/verify-whatsapp.mjs
npm test
npm run migrate
npm run migrate
node scripts/create-runtime.mjs
npm run test:integration
node --test --test-concurrency=1 tests/*.integration.mjs
# Os clientes administrativos do contêiner compartilham a versão do servidor.
db="$(docker ps --filter ancestor=pgvector/pgvector:pg17 --format '{{.ID}}' | head -n1)"
test -n "$db"
export TENANT_NAME='Validação de recuperação' OWNER_EMAIL='restore@example.invalid'
OWNER_PASSWORD="$(node -p "require('node:crypto').randomUUID()")"
export OWNER_PASSWORD
provisioned="$(node scripts/provision.mjs)"
RESTORE_TENANT_ID="${provisioned#Tenant criado: }"
export RESTORE_TENANT_ID
node scripts/verify-restored-access.mjs prepare
docker exec "$db" pg_dump -U postgres -Fc vant_test > "$RUNNER_TEMP/vant_test.dump"
docker exec "$db" createdb -U postgres vant_restore
docker exec -i "$db" pg_restore -U postgres --exit-on-error -d vant_restore < "$RUNNER_TEMP/vant_test.dump"
sql="SELECT count(*) FROM vant.audit WHERE action='team.created'"
before="$(docker exec "$db" psql -U postgres -d vant_test -Atc "$sql")"
after="$(docker exec "$db" psql -U postgres -d vant_restore -Atc "$sql")"
test "$before" -gt 0 && test "$after" = "$before"
echo "Restauração validada: $after registro(s) de criação de equipe."

DATABASE_URL="${DATABASE_URL%/vant_test}/vant_restore" node scripts/verify-restored-access.mjs verify
unset OWNER_PASSWORD OWNER_EMAIL TENANT_NAME RESTORE_TENANT_ID

bash scripts/evolution-ci.sh
