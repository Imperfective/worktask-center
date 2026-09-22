import { NextRequest, NextResponse } from "next/server";
import { currentUser, detailDTO } from "@/lib/serve";
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser(req);
  const { id } = await ctx.params;
  const dto = await detailDTO(Number(id), user?.id ?? "");
  if (!dto) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(dto);
}
