// 입력 검증을 한 곳에 모은다. 라우트마다 제각기 검사하면
// 한 군데만 빠져도 잘못된 값이 DB에 들어가고, 그 값이 목록 정렬 같은
// 엉뚱한 곳에서 터진다(QA G2가 그 사례).
import { NextRequest, NextResponse } from "next/server";

export const LIMITS = {
  title: 120, description: 500, summary: 200,
  reason: 500, result: 1000, comment: 1000,
} as const;

export const bad = (msg: string, code = 400) => NextResponse.json({ error: msg }, { status: code });

// 요청 id는 양의 정수만. Number("abc")=NaN을 그대로 넘기면 Prisma가 500으로 터진다.
export function reqId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// 공백만 있는 문자열과 길이 초과를 함께 막는다.
export function text(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s && s.length <= max ? s : null;
}

// 본문이 JSON이 아니면 500이 아니라 400으로 답해야 한다.
export async function readJson(req: NextRequest): Promise<any | null> {
  try { return await req.json(); } catch { return null; }
}
