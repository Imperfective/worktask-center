// 비밀번호 해시 — Next 런타임에 의존하지 않는다.
// 시드 스크립트에서도 그대로 쓰기 위해 auth.ts(next/headers 사용)와 분리한다.
import { randomBytes, scrypt as _scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scrypt = promisify(_scrypt) as (p: string, s: Buffer, l: number) => Promise<Buffer>;
const KEY_LEN = 64;

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(plain, salt, KEY_LEN);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(plain: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [algo, saltHex, keyHex] = stored.split("$");
  if (algo !== "scrypt" || !saltHex || !keyHex) return false;
  const key = await scrypt(plain, Buffer.from(saltHex, "hex"), KEY_LEN);
  const want = Buffer.from(keyHex, "hex");
  // 길이가 다르면 timingSafeEqual 이 던지므로 먼저 확인한다
  return key.length === want.length && timingSafeEqual(key, want);
}

export function normalizeEmail(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const e = v.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 120 ? e : null;
}
