import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/serve";
import { classify, similarity } from "@/lib/ai";
import { OPEN_STATUSES } from "@/lib/domain";

// POST /api/ai/analyze { text, mode: "ai"|"manual" }
export async function POST(req: NextRequest) {
  const user = await currentUser(req);
  const { text, mode } = await req.json();
  if (!text?.trim()) return NextResponse.json({ error: "내용을 입력하세요" }, { status: 400 });

  const suggestion = await classify(text, mode ?? "ai");

  // 유사 요청: 열린 상태 + 완료, 본인·종료·반려 제외 (설계서 §4.4)
  const candidates = await prisma.request.findMany({
    where: { status: { in: [...OPEN_STATUSES, "RESOLVED"] }, NOT: { requesterId: user?.id ?? "" } },
    include: { assignee: true, _count: { select: { followers: true } } },
    take: 40, orderBy: { updatedAt: "desc" },
  });
  const scored = candidates
    .map((r) => ({ r, s: similarity(text, r.title + " " + r.description) }))
    .filter((x) => x.s >= 0.18)
    .sort((a, b) => b.s - a.s)
    .slice(0, 3)
    .map(({ r, s }) => ({
      id: r.id, title: r.title, status: r.status, priority: r.priority,
      assigneeName: r.assignee?.name ?? null, followerCount: (r as any)._count.followers,
      score: Math.round(s * 100),
    }));

  return NextResponse.json({ suggestion, similar: scored });
}
