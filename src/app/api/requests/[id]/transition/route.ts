import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser, rolesFor, logEvent, detailDTO } from "@/lib/serve";
import { findRule } from "@/lib/transitions";
import { Status, EVENT } from "@/lib/domain";
import { LIMITS, bad, reqId, text, readJson } from "@/lib/validate";

// 배정 계열은 담당자까지 함께 바꿔야 하므로 assign API가 전담한다.
// 여기서 처리하면 상태만 처리중으로 바뀌고 담당자가 비는 요청이 생긴다.
const ASSIGN_ACTIONS = ["assign_self", "assign_member", "reassign"];

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser(req);
  const { id } = await ctx.params;
  const rid = reqId(id);
  if (!rid) return bad("요청을 찾을 수 없습니다", 404);
  const r = await prisma.request.findUnique({ where: { id: rid } });
  if (!user || !r) return bad("요청을 찾을 수 없습니다", 404);

  const body = await readJson(req);
  if (!body) return bad("요청 본문이 올바른 JSON이 아닙니다");
  const action = String(body.action ?? "");
  if (ASSIGN_ACTIONS.includes(action)) return bad("담당자 배정은 배정 API로 처리합니다");

  // 한 사람이 담당자이면서 요청자일 수 있다. 가진 역할 중 하나라도
  // 이 전이를 허용하면 통과시키되, 규칙 자체는 전이 맵에서만 읽는다.
  const roles = rolesFor(user, r.department, r.requesterId);
  const rule = roles.map((rl) => findRule(action as any, r.status as Status, rl)).find(Boolean);
  if (!rule || !rule.to) {
    const isRequesterAction = findRule(action as any, r.status as Status, "requester");
    if (isRequesterAction && user.id !== r.requesterId) return bad("요청자만 가능합니다", 403);
    return bad("허용되지 않는 전이입니다");
  }

  // 필수 입력 검증 — 공백만 있는 사유·내역도 막는다.
  const reason = text(body.reason, LIMITS.reason);
  const result = text(body.result, LIMITS.result);
  if (rule.needs?.includes("reason") && !reason) return bad(`${rule.reasonLabel} 을(를) 입력하세요 (1~${LIMITS.reason}자)`);
  if (rule.needs?.includes("result") && !result) return bad(`처리 내역을 입력하세요 (1~${LIMITS.result}자)`);

  // 중복 반려의 원본 지정 검증 — 없는 번호나 자기 자신이면 여기서 막는다.
  let dupId: number | null = null;
  if (action === "reject" && body.duplicateOfId !== undefined && body.duplicateOfId !== null && body.duplicateOfId !== "") {
    dupId = reqId(String(body.duplicateOfId));
    if (!dupId) return bad("원본 요청 ID가 올바르지 않습니다");
    if (dupId === rid) return bad("자기 자신을 원본으로 지정할 수 없습니다");
    const orig = await prisma.request.findUnique({ where: { id: dupId } });
    if (!orig) return bad(`원본 요청 #${dupId} 을(를) 찾을 수 없습니다`);
    if (orig.status === "CLOSED" || orig.status === "REJECTED") return bad("이미 종료·반려된 요청은 원본으로 지정할 수 없습니다");
  }

  const data: any = { status: rule.to };
  const payload: any = { from: r.status, to: rule.to };
  if (action === "hold") {
    data.holdReason = reason; data.holdResumeDate = body.resumeDate || null;
    payload.reason = reason; payload.resume_date = body.resumeDate ?? null;
  }
  if (action === "resume") { data.holdReason = null; data.holdResumeDate = null; }
  if (action === "resolve") { data.result = result; data.resolvedAt = new Date(); payload.result = result; }
  if (action === "reject") {
    data.rejectReason = reason; payload.reason = reason;
    if (dupId) { data.duplicateOfId = dupId; payload.duplicate_of_id = dupId; }
  }
  if (action === "reopen") { data.rejectReason = null; payload.reason = reason; }

  await prisma.request.update({ where: { id: rid }, data });
  await logEvent(rid, user.id, EVENT.STATUS_CHANGED, payload);

  // 중복 반려 시: 반려된 요청의 요청자를 원본 참여자로 자동 추가 (설계서 §4.4)
  // 원본을 낸 사람이 같은 사람이면 자기 요청을 참여하는 꼴이므로 건너뛴다.
  if (dupId) {
    const orig = await prisma.request.findUnique({ where: { id: dupId } });
    if (orig && orig.requesterId !== r.requesterId) {
      const already = await prisma.requestFollower.findUnique({
        where: { requestId_userId: { requestId: dupId, userId: r.requesterId } },
      });
      if (!already) {
        await prisma.requestFollower.create({ data: { requestId: dupId, userId: r.requesterId, via: "duplicate" } });
        // 행위자는 담당자가 아니라 참여하게 된 요청자 본인 (타임라인 표기 정확성)
        await logEvent(dupId, r.requesterId, EVENT.FOLLOWED, { user_id: r.requesterId, via: "duplicate" });
      }
    }
  }
  return NextResponse.json(await detailDTO(rid, user.id));
}
