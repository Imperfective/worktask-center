import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { DEPARTMENTS } from "@/lib/domain";
import { hashPassword, createSession, isHandlerDept, normalizeEmail } from "@/lib/auth";
import { bad, text, readJson } from "@/lib/validate";

export async function POST(req: NextRequest) {
  const b = await readJson(req);
  if (!b) return bad("요청 본문이 올바른 JSON이 아닙니다");

  const email = normalizeEmail(b.email);
  if (!email) return bad("이메일 형식이 올바르지 않습니다");
  const name = text(b.name, 30);
  if (!name) return bad("이름을 입력하세요 (1~30자)");
  const dept = typeof b.department === "string" ? b.department : "";
  if (!(DEPARTMENTS as readonly string[]).includes(dept)) return bad("부서를 선택하세요");
  const pw = typeof b.password === "string" ? b.password : "";
  if (pw.length < 8 || pw.length > 72) return bad("비밀번호는 8자 이상 72자 이하로 입력하세요");

  if (await prisma.user.findUnique({ where: { email } }))
    return bad("이미 가입된 이메일입니다");

  // 담당자 여부는 본인이 고르는 값이 아니라 부서에서 결정한다.
  // 체크박스로 두면 누구나 담당자가 되어 남의 부서 큐를 볼 수 있다.
  const user = await prisma.user.create({
    data: {
      id: "u_" + randomUUID().slice(0, 12),
      email, name, department: dept,
      isHandler: isHandlerDept(dept),
      passwordHash: await hashPassword(pw),
    },
  });
  await createSession(user.id);
  return NextResponse.json({
    user: { id: user.id, name: user.name, department: user.department, isHandler: user.isHandler },
  });
}
