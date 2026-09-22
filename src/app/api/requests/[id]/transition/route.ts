import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser, roleFor, logEvent, detailDTO } from "@/lib/serve";
import { findRule } from "@/lib/transitions";
import { Status, EVENT } from "@/lib/domain";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser(req);
  const { id } = await ctx.params;
  const rid = Number(id);
  const r = await prisma.request.findUnique({ where: { id: rid } });
  if (!user || !r) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json();
  const action = body.action as string;
  const role = roleFor(user, r.department);
  // 요청자 액션(완료→종료/다시요청, 반려→다시요청)은 요청 당사자만
  if (role === "requester" && user.id !== r.requesterId)
    return NextResponse.json({ error: "요청자만 가능합니다" }, { status: 403 });

  // ★ 전이 검증은 전이 맵 한 곳에서만 (설계서 §9)
  const rule = findRule(action as any, r.status as Status, role);
  if (!rule || !rule.to) return NextResponse.json({ error: "허용되지 않는 전이입니다" }, { status: 400 });

  // 필수 입력 검증
  const { reason, result, resumeDate, duplicateOfId } = body;
  if (rule.needs?.includes("reason") && !reason?.trim())
    return NextResponse.json({ error: `${rule.reasonLabel} 을(를) 입력하세요` }, { status: 400 });
  if (rule.needs?.includes("result") && !result?.trim())
    return NextResponse.json({ error: "처리 내역을 입력하세요" }, { status: 400 });

  const data: any = { status: rule.to };
  const payload: any = { from: r.status, to: rule.to };
  if (action === "hold") { data.holdReason = reason; data.holdResumeDate = resumeDate || null; payload.reason = reason; payload.resume_date = resumeDate; }
  if (action === "resume") { data.holdReason = null; data.holdResumeDate = null; }
  if (action === "resolve") { data.result = result; data.resolvedAt = new Date(); payload.result = result; }
  if (action === "reject") {
    data.rejectReason = reason; payload.reason = reason;
    if (duplicateOfId) { data.duplicateOfId = Number(duplicateOfId); payload.duplicate_of_id = Number(duplicateOfId); }
  }
  if (action === "reopen") { data.rejectReason = null; payload.reason = reason; }

  await prisma.request.update({ where: { id: rid }, data });
  await logEvent(rid, user.id, EVENT.STATUS_CHANGED, payload);

  // 중복 반려 시: 반려된 요청의 요청자를 원본 참여자로 자동 추가 (설계서 §4.4)
  if (action === "reject" && duplicateOfId) {
    await prisma.requestFollower.upsert({
      where: { requestId_userId: { requestId: Number(duplicateOfId), userId: r.requesterId } },
      create: { requestId: Number(duplicateOfId), userId: r.requesterId, via: "duplicate" },
      update: {},
    });
    // 행위자는 담당자가 아니라 참여하게 된 요청자 본인 (타임라인 표기 정확성)
    await logEvent(Number(duplicateOfId), r.requesterId, EVENT.FOLLOWED, { user_id: r.requesterId, via: "duplicate" });
  }
  return NextResponse.json(await detailDTO(rid, user.id));
}
