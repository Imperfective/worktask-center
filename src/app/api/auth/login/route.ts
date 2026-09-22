import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword, createSession, normalizeEmail } from "@/lib/auth";
import { bad, readJson } from "@/lib/validate";

export async function POST(req: NextRequest) {
  const b = await readJson(req);
  if (!b) return bad("요청 본문이 올바른 JSON이 아닙니다");
  const email = normalizeEmail(b.email);
  const pw = typeof b.password === "string" ? b.password : "";

  // 이메일이 없어도 비밀번호 검증을 돌려 응답 시간을 비슷하게 맞춘다.
  // "없는 계정"과 "틀린 비밀번호"를 구분해 알려주면 계정 존재 여부가 새어 나간다.
  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
  const ok = await verifyPassword(pw, user?.passwordHash ?? null);
  if (!user || !ok) return bad("이메일 또는 비밀번호가 올바르지 않습니다", 401);

  await createSession(user.id);
  return NextResponse.json({
    user: { id: user.id, name: user.name, department: user.department, isHandler: user.isHandler },
  });
}
