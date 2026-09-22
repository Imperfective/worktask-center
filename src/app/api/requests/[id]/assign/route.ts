import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser, roleFor, logEvent, detailDTO, membersOf } from "@/lib/serve";
import { findRule } from "@/lib/transitions";
import { Status, EVENT } from "@/lib/domain";
import { bad, reqId, readJson } from "@/lib/validate";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return bad("로그인이 필요합니다", 401);
  const { id } = await ctx.params;
  const rid = reqId(id);
  if (!rid) return bad("요청을 찾을 수 없습니다", 404);
  const r = await prisma.request.findUnique({ where: { id: rid } });
  if (!user || !r) return bad("요청을 찾을 수 없습니다", 404);
  if (roleFor(user, r.department) !== "handler") return bad("권한 없음", 403);

  const body = await readJson(req);
  if (!body) return bad("요청 본문이 올바른 JSON이 아닙니다");
  const target = typeof body.toUserId === "string" && body.toUserId ? body.toUserId : user.id;
  // 대상이 해당 부서 담당자인지 검증 (설계서 §9)
  const members = await membersOf(r.department);
  if (!members.some((m) => m.id === target)) return bad("부서 담당자가 아닙니다");

  // 배정도 전이 규칙을 따른다. 완료·종료·반려된 요청의 담당자를
  // 바꿀 수 있으면 종료 이후에도 이력이 계속 바뀌어 기록을 신뢰할 수 없다.
  const st = r.status as Status;
  const action = st === "SUBMITTED" ? (target === user.id ? "assign_self" : "assign_member") : "reassign";
  const rule = findRule(action, st, "handler");
  if (!rule) return bad("이 상태에서는 담당자를 배정할 수 없습니다");

  const by = target === user.id ? "self" : "member";
  if (st === "SUBMITTED") {
    // 접수 → 처리중으로 함께 전이 (설계서 §4.2: 별도 착수 단계 없음)
    await prisma.request.update({ where: { id: rid }, data: { assigneeId: target, status: "IN_PROGRESS" } });
    await logEvent(rid, user.id, EVENT.ASSIGNED, { to_user_id: target, by });
    await logEvent(rid, user.id, EVENT.STATUS_CHANGED, { from: "SUBMITTED", to: "IN_PROGRESS" });
  } else {
    // 담당 변경 (상태 유지)
    if (r.assigneeId === target) return bad("이미 이 담당자에게 배정되어 있습니다");
    await prisma.request.update({ where: { id: rid }, data: { assigneeId: target } });
    await logEvent(rid, user.id, EVENT.ASSIGNED, { from_user_id: r.assigneeId, to_user_id: target, by: "member" });
  }
  return NextResponse.json(await detailDTO(rid, user.id));
}
