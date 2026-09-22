// 인증 — 외부 의존성 없이 Node 내장 crypto 만 쓴다.
// 비밀번호는 scrypt 로 해시해 저장하고, 세션은 DB 행으로 관리한다.
// 세션을 DB 에 두면 로그아웃이 "쿠키를 지운다"가 아니라 "서버에서 무효화한다"가 된다.
import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "./db";
import { HANDLER_DEPTS } from "./domain";

export { hashPassword, verifyPassword, normalizeEmail } from "./password";

export { SESSION_COOKIE } from "./session-cookie";
import { SESSION_COOKIE } from "./session-cookie";
const SESSION_DAYS = 14;

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5);
  await prisma.session.create({ data: { token, userId, expiresAt } });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,                      // 스크립트가 읽지 못하게
    sameSite: "lax",                     // 외부 사이트에서 넘어온 요청에 실리지 않게
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
  return token;
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { token } });
  jar.delete(SESSION_COOKIE);
}

// 쿠키 → 세션 → 사용자. 만료된 세션은 보는 김에 지운다.
export async function userFromSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const s = await prisma.session.findUnique({ where: { token }, include: { user: true } });
  if (!s) return null;
  if (s.expiresAt < new Date()) {
    await prisma.session.delete({ where: { token } }).catch(() => {});
    return null;
  }
  return s.user;
}

// 담당자 여부는 사용자가 고르는 값이 아니라 부서에서 결정된다.
export const isHandlerDept = (dept: string) => (HANDLER_DEPTS as readonly string[]).includes(dept);

