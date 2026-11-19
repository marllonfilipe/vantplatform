#!/usr/bin/env bash
set -euo pipefail
export APP_ENV=test
npm install --ignore-scripts --no-audit --no-fund
npm test
npm run migrate
npm run migrate
node scripts/create-runtime.mjs
npm run test:integration
for test_file in tests/*.integration.mjs; do
  if [ -f "$test_file" ]; then node --test "$test_file"; fi
done
# Os clientes administrativos do contêiner compartilham a versão do servidor.
db="$(docker ps --filter ancestor=pgvector/pgvector:pg17 --format '{{.ID}}' | head -n1)"
test -n "$db"
docker exec "$db" pg_dump -U postgres -Fc vant_test > "$RUNNER_TEMP/vant_test.dump"
docker exec "$db" createdb -U postgres vant_restore
docker exec -i "$db" pg_restore -U postgres --exit-on-error -d vant_restore < "$RUNNER_TEMP/vant_test.dump"
sql="SELECT count(*) FROM vant.audit WHERE action='team.created'"
before="$(docker exec "$db" psql -U postgres -d vant_test -Atc "$sql")"
after="$(docker exec "$db" psql -U postgres -d vant_restore -Atc "$sql")"
test "$before" -gt 0 && test "$after" = "$before"
echo "Restauração validada: $after registro(s) de criação de equipe."
