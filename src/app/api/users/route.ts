import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
export async function GET() {
  const users = await prisma.user.findMany({ orderBy: [{ isHandler: "asc" }, { id: "asc" }] });
  return NextResponse.json({ users });
}
