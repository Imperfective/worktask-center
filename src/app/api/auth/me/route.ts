import { NextResponse } from "next/server";
import { userFromSession } from "@/lib/auth";
export async function GET() {
  const u = await userFromSession();
  if (!u) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  return NextResponse.json({
    user: { id: u.id, name: u.name, email: u.email, department: u.department, isHandler: u.isHandler },
  });
}
