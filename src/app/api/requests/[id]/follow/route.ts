import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser, logEvent, detailDTO } from "@/lib/serve";
import { canFollow } from "@/lib/transitions";
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
  if (!canFollow(r.status as Status)) return bad("참여할 수 없는 상태");
  if (r.requesterId === user.id) return bad("본인 요청");

  const body = (await readJson(req)) ?? {};
  const via = ["register", "detail", "duplicate"].includes(body.via) ? body.via : "detail";

  // 이미 참여 중이면 조용히 넘어간다. 그대로 이벤트를 남기면
  // 버튼을 여러 번 누른 것만으로 타임라인이 같은 줄로 채워진다.
  const already = await prisma.requestFollower.findUnique({
    where: { requestId_userId: { requestId: rid, userId: user.id } },
  });
  if (!already) {
    await prisma.requestFollower.create({ data: { requestId: rid, userId: user.id, via } });
    await logEvent(rid, user.id, EVENT.FOLLOWED, { user_id: user.id, via });
  }
  return NextResponse.json(await detailDTO(rid, user.id));
}
