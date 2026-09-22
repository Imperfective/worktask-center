#!/bin/sh
set -e
# 첫 기동에만 템플릿 DB를 볼륨으로 복사. 이후 데이터는 볼륨에 유지된다.
if [ ! -f /app/data/app.db ]; then
  echo "▸ 최초 기동 — 시드 DB 배치"
  cp /app/seed/app.db /app/data/app.db
fi
echo "▸ 서버 시작 :3300"
exec node server.js
