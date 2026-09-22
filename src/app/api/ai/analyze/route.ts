import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/serve";
import { classify, similarity } from "@/lib/ai";
import { OPEN_STATUSES } from "@/lib/domain";
import { bad, readJson } from "@/lib/validate";

// POST /api/ai/analyze { text, mode: "ai"|"manual" }
export async function POST(req: NextRequest) {
  const user = await currentUser(req);
  const body = await readJson(req);
  if (!body) return bad("요청 본문이 올바른 JSON이 아닙니다");
  const { mode } = body;
  // 분석 입력은 화면 한도(500자)보다 넉넉히 받되 상한은 둔다.
  const text = typeof body.text === "string" ? body.text.trim().slice(0, 2000) : "";
  if (!text) return bad("내용을 입력하세요");

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
