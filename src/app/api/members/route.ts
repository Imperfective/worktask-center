import { NextRequest, NextResponse } from "next/server";
import { currentUser, membersOf } from "@/lib/serve";
import { bad } from "@/lib/validate";

// 배정 드롭다운용 — 내 부서(또는 지정한 부서)의 담당자 목록
export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return bad("로그인이 필요합니다", 401);
  const dept = req.nextUrl.searchParams.get("dept") || user.department;
  return NextResponse.json({ members: await membersOf(dept) });
}
