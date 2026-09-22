import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { userFromSession } from "@/lib/auth";

export async function GET() {
  // 로그인한 사람만. 비밀번호 해시와 이메일은 내보내지 않는다.
  if (!(await userFromSession())) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  const users = await prisma.user.findMany({
    select: { id: true, name: true, department: true, isHandler: true },
    orderBy: [{ isHandler: "asc" }, { name: "asc" }],
  });
  return NextResponse.json({ users });
}
