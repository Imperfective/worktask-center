import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser, serializeReq, logEvent } from "@/lib/serve";
import { OPEN_STATUSES, deptOfCategory, PRIORITY_ORDER, EVENT } from "@/lib/domain";
import { classify } from "@/lib/ai";

// GET /api/requests?view=mine|queue&tab=...
export async function GET(req: NextRequest) {
  const user = await currentUser(req);
  if (!user) return NextResponse.json({ error: "no user" }, { status: 400 });
  const view = req.nextUrl.searchParams.get("view") ?? "mine";
  const tab = req.nextUrl.searchParams.get("tab") ?? "";

  let where: any = {};
  if (view === "mine") {
    // 내 요청 = 내가 낸 것 + 내가 참여(follow)한 것 (설계서 §9)
    const followed = await prisma.requestFollower.findMany({ where: { userId: user.id }, select: { requestId: true } });
    const ids = followed.map((f) => f.requestId);
    where.OR = [{ requesterId: user.id }, { id: { in: ids } }];
    if (tab === "progress") where.status = { in: OPEN_STATUSES };
    else if (tab === "resolved") where.status = "RESOLVED";
    else if (tab === "closed") where.status = { in: ["CLOSED", "REJECTED"] };
  } else {
    // 처리할 요청 = 담당자 부서 큐 (설계서 §9)
    where.department = user.department;
    if (tab === "unassigned") where.status = "SUBMITTED";
    else if (tab === "mine") { where.assigneeId = user.id; where.status = { in: ["IN_PROGRESS"] }; }
    else if (tab === "hold") where.status = "ON_HOLD";
    else if (tab === "resolved") where.status = { in: ["RESOLVED", "CLOSED"] };
  }

  const rows = await prisma.request.findMany({
    where,
    include: { requester: true, assignee: true, _count: { select: { followers: true } } },
    orderBy: [{ updatedAt: "desc" }],
  });
  // 긴급 우선 정렬 (설계서 §7: 긴급 → 접수순)
  const pr = (p: string) => PRIORITY_ORDER.indexOf(p as any);
  rows.sort((a, b) => pr(a.priority) - pr(b.priority));
  const items = rows.map((r) => ({
    ...serializeReq(r),
    requesterName: r.requester.name,
    assigneeName: r.assignee?.name ?? null,
    followerCount: (r as any)._count.followers,
  }));
  return NextResponse.json({ items });
}

// POST /api/requests — 등록
export async function POST(req: NextRequest) {
  const user = await currentUser(req);
  if (!user) return NextResponse.json({ error: "no user" }, { status: 400 });
  const b = await req.json();
  const { title, description, category, priority, summary, mode, aiSuggestion, acceptedFields } = b;
  const cat = category as string;
  if (!title || !description || !cat) return NextResponse.json({ error: "필수 항목 누락" }, { status: 400 });
  const dept = deptOfCategory(cat);

  const created = await prisma.request.create({
    data: {
      title, description, summary: summary ?? "", category: cat, department: dept,
      priority: priority ?? "normal", status: "SUBMITTED", requesterId: user.id,
      aiSuggestion: aiSuggestion ? JSON.stringify(aiSuggestion) : null,
    },
  });
  await logEvent(created.id, user.id, EVENT.CREATED, { title, category: cat, priority, mode: mode ?? "ai" });
  if (aiSuggestion) await logEvent(created.id, user.id, EVENT.AI_SUGGESTED, { suggestion: aiSuggestion, accepted: acceptedFields ?? {} });
  return NextResponse.json({ id: created.id });
}
