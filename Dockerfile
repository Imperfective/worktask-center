# 멀티스테이지: 빌드 시점에 스키마+시드까지 끝낸 DB 템플릿을 만들어 두고,
# 런타임에는 standalone 서버만 돈다 (prisma CLI·tsx 불필요 → 가볍고 빠른 기동)
FROM node:22-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

FROM node:22-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# 템플릿 DB를 /app/seed 에 생성 (스키마 + 시드 데이터)
ENV DATABASE_URL="file:/app/seed/app.db"
RUN mkdir -p /app/seed \
 && npx prisma generate \
 && npx prisma db push --skip-generate --accept-data-loss \
 && npx tsx prisma/seed.ts \
 && npm run build

FROM node:22-slim AS runner
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production PORT=3300 HOSTNAME=0.0.0.0
ENV DATABASE_URL="file:/app/data/app.db"
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/seed/app.db /app/seed/app.db
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh && mkdir -p /app/data
EXPOSE 3300
ENTRYPOINT ["./docker-entrypoint.sh"]
