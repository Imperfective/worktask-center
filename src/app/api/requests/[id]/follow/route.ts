import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser, logEvent, detailDTO } from "@/lib/serve";
import { canFollow } from "@/lib/transitions";
import { Status, EVENT } from "@/lib/domain";
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser(req);
  const { id } = await ctx.params;
  const rid = Number(id);
  const r = await prisma.request.findUnique({ where: { id: rid } });
  if (!user || !r) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!canFollow(r.status as Status)) return NextResponse.json({ error: "참여할 수 없는 상태" }, { status: 400 });
  if (r.requesterId === user.id) return NextResponse.json({ error: "본인 요청" }, { status: 400 });
  const via = (await req.json().catch(() => ({}))).via ?? "detail";
  await prisma.requestFollower.upsert({
    where: { requestId_userId: { requestId: rid, userId: user.id } },
    create: { requestId: rid, userId: user.id, via }, update: {},
  });
  await logEvent(rid, user.id, EVENT.FOLLOWED, { user_id: user.id, via });
  return NextResponse.json(await detailDTO(rid, user.id));
}
