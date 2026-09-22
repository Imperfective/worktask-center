import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/serve";
export async function GET(req: NextRequest) {
  const user = await currentUser(req);
  if (!user) return NextResponse.json({ error: "no user" }, { status: 400 });
  const dept = user.department;
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const todayCount = await prisma.request.count({ where: { department: dept, createdAt: { gte: dayStart } } });
  const unassignedUrgent = await prisma.request.count({ where: { department: dept, status: "SUBMITTED", priority: "urgent" } });
  const resolved = await prisma.request.findMany({ where: { department: dept, resolvedAt: { not: null } }, select: { createdAt: true, resolvedAt: true } });
  let avgH = 0;
  if (resolved.length) {
    const sum = resolved.reduce((a, r) => a + ((r.resolvedAt!.getTime() - r.createdAt.getTime()) / 3600000), 0);
    avgH = Math.round(sum / resolved.length);
  }
  return NextResponse.json({ todayCount, avgResolveHours: avgH, unassignedUrgent });
}
