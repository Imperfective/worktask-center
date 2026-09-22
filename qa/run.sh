#!/usr/bin/env bash
# QA 전용 DB와 포트로 서버를 띄워 스위트를 돌리고, 끝나면 정리한다.
# 개발용 dev.db는 건드리지 않는다.
set -uo pipefail
cd "$(dirname "$0")/.."

PORT="${QA_PORT:-3310}"
DB="qa.db"
export DATABASE_URL="file:./$DB"
export QA_BASE="http://localhost:$PORT"

cleanup() { [ -n "${SRV:-}" ] && kill "$SRV" 2>/dev/null; lsof -ti:"$PORT" | xargs kill -9 2>/dev/null; }
trap cleanup EXIT

echo "▶ QA DB 초기화 (prisma/$DB)"
rm -f "prisma/$DB"
npx prisma db push --skip-generate --accept-data-loss >/dev/null 2>&1 || { echo "db push 실패"; exit 1; }
npx tsx prisma/seed.ts >/dev/null 2>&1 || { echo "seed 실패"; exit 1; }

if [ ! -d .next ]; then echo "▶ 빌드"; npm run build >/dev/null || exit 1; fi

echo "▶ QA 서버 기동 (:$PORT)"
lsof -ti:"$PORT" | xargs kill -9 2>/dev/null
npx next start -p "$PORT" > /tmp/qa-server.log 2>&1 &
SRV=$!
for i in $(seq 1 40); do
  curl -s -o /dev/null "http://localhost:$PORT/api/users" && break
  sleep 0.5
done

node qa/run.mjs "$@"
RC=$?
echo "▶ 서버 로그: /tmp/qa-server.log"
exit $RC
