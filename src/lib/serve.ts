import { prisma } from "./db";
import { allowedActions, canComment, canFollow, Role } from "./transitions";
import { Status, deptToHandlers, EVENT } from "./domain";
import { NextRequest } from "next/server";

export async function currentUser(req: NextRequest) {
  const id = req.headers.get("x-user-id") || "u_sales";
  return prisma.user.findUnique({ where: { id } });
}

// 이 사용자가 이 요청에 대해 담당자 역할인가 (설계서 §3: 소속 부서 담당자)
export function roleFor(user: { department: string; isHandler: boolean }, reqDept: string): Role {
  return user.isHandler && user.department === reqDept ? "handler" : "requester";
}

export async function logEvent(requestId: number, actorId: string, type: string, payload: object) {
  return prisma.requestEvent.create({ data: { requestId, actorId, type, payload: JSON.stringify(payload) } });
}

export async function detailDTO(id: number, viewerId: string) {
  const r = await prisma.request.findUnique({
    where: { id },
    include: {
      requester: true, assignee: true,
      followers: { include: { user: true } },
      events: { include: { actor: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!r) return null;
  const viewer = await prisma.user.findUnique({ where: { id: viewerId } });
  const role = viewer ? roleFor(viewer, r.department) : "requester";
  // 요청자 본인인지, 담당자인지에 따라 액션 필터 (설계서 §7)
  const isRequester = viewer?.id === r.requesterId;
  const actions = allowedActions(r.status as Status, role).filter((a) => {
    if (role === "requester") return isRequester; // 완료/반려 액션은 요청 당사자만
    return true;
  });
  const isFollower = r.followers.some((f) => f.userId === viewerId);
  return {
    ...serializeReq(r),
    requester: { id: r.requester.id, name: r.requester.name, department: r.requester.department },
    assignee: r.assignee ? { id: r.assignee.id, name: r.assignee.name } : null,
    followers: r.followers.map((f) => ({ id: f.user.id, name: f.user.name, via: f.via })),
    timeline: r.events.map((e) => ({
      id: e.id, type: e.type, actor: e.actor.name, actorId: e.actorId,
      payload: JSON.parse(e.payload), at: e.createdAt,
    })),
    viewer: { id: viewer?.id, role, isRequester, isFollower },
    allowedActions: actions.map((a) => ({ action: a.action, label: a.label, needs: a.needs ?? [], reasonLabel: a.reasonLabel })),
    canComment: canComment(r.status as Status),
    canFollow: canFollow(r.status as Status) && !isRequester && !isFollower,
  };
}

export function serializeReq(r: any) {
  return {
    id: r.id, title: r.title, description: r.description, summary: r.summary,
    category: r.category, department: r.department, priority: r.priority, status: r.status,
    requesterId: r.requesterId, assigneeId: r.assigneeId, duplicateOfId: r.duplicateOfId,
    holdReason: r.holdReason, holdResumeDate: r.holdResumeDate, result: r.result, rejectReason: r.rejectReason,
    aiSuggestion: r.aiSuggestion ? JSON.parse(r.aiSuggestion) : null,
    followerCount: r._count?.followers ?? undefined,
    createdAt: r.createdAt, updatedAt: r.updatedAt, resolvedAt: r.resolvedAt,
  };
}

export function membersOf(dept: string) { return deptToHandlers[dept] ?? []; }
export { EVENT };
