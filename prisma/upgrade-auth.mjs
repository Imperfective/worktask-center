// 운영 DB 를 인증 스키마로 올린다. 추가만 하는 DDL 이라 기존 행을 건드리지 않는다.
// 사용자 행을 다시 만들면 요청·이력의 참조가 전부 끊기므로 절대 지우지 않는다.
// 실행: docker exec worktask-app node /app/upgrade-auth.mjs
import { PrismaClient } from "@prisma/client";
import { randomBytes, scrypt as _scrypt } from "crypto";
import { promisify } from "util";
const scrypt = promisify(_scrypt);
const db = new PrismaClient();

const SEED = [
  ["u_fac", "fac@example.com"], ["u_it", "it@example.com"], ["u_ga", "ga@example.com"],
  ["u_sales", "sales@example.com"], ["u_design", "design@example.com"],
];
const PASSWORD = "worktask1234";

async function hash(plain) {
  const salt = randomBytes(16);
  const key = await scrypt(plain, salt, 64);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

// 이미 적용된 DDL 은 조용히 넘어간다 (재실행해도 안전하게)
async function tryExec(sql) {
  try { await db.$executeRawUnsafe(sql); console.log("  ✓", sql.slice(0, 62)); }
  catch (e) {
    const m = String(e.message);
    if (/duplicate column|already exists/i.test(m)) console.log("  · 이미 적용됨:", sql.slice(0, 48));
    else throw e;
  }
}

await tryExec(`ALTER TABLE "User" ADD COLUMN "email" TEXT`);
await tryExec(`ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT`);
// SQLite 는 ADD COLUMN 에 상수가 아닌 기본값(CURRENT_TIMESTAMP)을 허용하지 않는다.
// 널로 추가한 뒤 채운다. Prisma 스키마상 필수라 NULL 이 남지 않게 한다.
await tryExec(`ALTER TABLE "User" ADD COLUMN "createdAt" DATETIME`);
await tryExec(`UPDATE "User" SET "createdAt" = CURRENT_TIMESTAMP WHERE "createdAt" IS NULL`);
await tryExec(`CREATE UNIQUE INDEX "User_email_key" ON "User"("email")`);
await tryExec(`CREATE TABLE "Session" (
  "token" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" DATETIME NOT NULL,
  CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
)`);
await tryExec(`CREATE INDEX "Session_userId_idx" ON "Session"("userId")`);

const pw = await hash(PASSWORD);
for (const [id, email] of SEED) {
  const n = await db.$executeRawUnsafe(
    `UPDATE "User" SET "email" = ?, "passwordHash" = ? WHERE "id" = ? AND "email" IS NULL`,
    email, pw, id);
  console.log(`  ${id.padEnd(10)} ${email.padEnd(22)} ${n ? "자격 증명 부여" : "이미 있음 — 건너뜀"}`);
}
const rows = await db.$queryRawUnsafe(`SELECT id, email, department, isHandler FROM "User" ORDER BY isHandler DESC, id`);
console.log("\n  현재 계정:");
for (const r of rows) console.log(`   ${r.id.padEnd(10)} ${(r.email ?? "(없음)").padEnd(22)} ${r.department} ${r.isHandler ? "· 처리 담당" : "· 요청자"}`);
await db.$disconnect();
