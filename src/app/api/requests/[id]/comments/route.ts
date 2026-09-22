import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser, logEvent, detailDTO } from "@/lib/serve";
import { canComment } from "@/lib/transitions";
import { Status, EVENT } from "@/lib/domain";
import { LIMITS, bad, reqId, text, readJson } from "@/lib/validate";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser(req);
  const { id } = await ctx.params;
  const rid = reqId(id);
  if (!rid) return bad("요청을 찾을 수 없습니다", 404);
  const r = await prisma.request.findUnique({ where: { id: rid } });
  if (!user || !r) return bad("요청을 찾을 수 없습니다", 404);
  if (!canComment(r.status as Status)) return bad("종료된 요청입니다");

  const json = await readJson(req);
  if (!json) return bad("요청 본문이 올바른 JSON이 아닙니다");
  const body = text(json.body, LIMITS.comment);
  if (!body) return bad(`내용을 입력하세요 (1~${LIMITS.comment}자)`);

  await logEvent(rid, user.id, EVENT.COMMENTED, { body });
  await prisma.request.update({ where: { id: rid }, data: { updatedAt: new Date() } });
  return NextResponse.json(await detailDTO(rid, user.id));
}
