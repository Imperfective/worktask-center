import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser, logEvent, detailDTO } from "@/lib/serve";
import { canComment } from "@/lib/transitions";
import { Status, EVENT } from "@/lib/domain";
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser(req);
  const { id } = await ctx.params;
  const rid = Number(id);
  const r = await prisma.request.findUnique({ where: { id: rid } });
  if (!user || !r) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!canComment(r.status as Status)) return NextResponse.json({ error: "종료된 요청입니다" }, { status: 400 });
  const { body } = await req.json();
  if (!body?.trim()) return NextResponse.json({ error: "내용을 입력하세요" }, { status: 400 });
  await logEvent(rid, user.id, EVENT.COMMENTED, { body });
  await prisma.request.update({ where: { id: rid }, data: { updatedAt: new Date() } });
  return NextResponse.json(await detailDTO(rid, user.id));
}
