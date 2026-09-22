import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser, roleFor, logEvent, detailDTO, membersOf } from "@/lib/serve";
import { EVENT } from "@/lib/domain";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser(req);
  const { id } = await ctx.params;
  const rid = Number(id);
  const r = await prisma.request.findUnique({ where: { id: rid } });
  if (!user || !r) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (roleFor(user, r.department) !== "handler")
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const { toUserId } = await req.json();
  const target = toUserId || user.id;
  // 대상이 해당 부서 담당자인지 검증 (설계서 §9)
  if (!membersOf(r.department).includes(target))
    return NextResponse.json({ error: "부서 담당자가 아닙니다" }, { status: 400 });

  const by = target === user.id ? "self" : "member";
  if (r.status === "SUBMITTED") {
    // 접수 → 처리중으로 함께 전이 (설계서 §4.2: 별도 착수 단계 없음)
    await prisma.request.update({ where: { id: rid }, data: { assigneeId: target, status: "IN_PROGRESS" } });
    await logEvent(rid, user.id, EVENT.ASSIGNED, { to_user_id: target, by });
    await logEvent(rid, user.id, EVENT.STATUS_CHANGED, { from: "SUBMITTED", to: "IN_PROGRESS" });
  } else {
    // 담당 변경 (상태 유지)
    await prisma.request.update({ where: { id: rid }, data: { assigneeId: target } });
    await logEvent(rid, user.id, EVENT.ASSIGNED, { from_user_id: r.assigneeId, to_user_id: target, by: "member" });
  }
  return NextResponse.json(await detailDTO(rid, user.id));
}
