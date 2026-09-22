import { NextRequest, NextResponse } from "next/server";
import { currentUser, detailDTO } from "@/lib/serve";
import { bad, reqId } from "@/lib/validate";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return bad("로그인이 필요합니다", 401);
  const { id } = await ctx.params;
  const rid = reqId(id);
  if (!rid) return bad("요청을 찾을 수 없습니다", 404);
  const dto = await detailDTO(rid, user?.id ?? "");
  if (!dto) return bad("요청을 찾을 수 없습니다", 404);
  return NextResponse.json(dto);
}
