// 설계서 §4.2 — 상태 전이 규칙을 담은 단 하나의 맵.
// transition API와 상세 API의 '허용 액션'이 모두 이 맵을 참조한다.
// 규칙이 두 곳에 흩어지면 화면과 서버가 어긋나는 것이 이런 시스템의 흔한 결함.
import { Status } from "./domain";

export type Role = "requester" | "handler";
export type ActionKey =
  | "assign_self" | "assign_member" | "hold" | "resume" | "resolve"
  | "close" | "reopen" | "reject" | "reassign" | "comment" | "follow";

export interface TransitionRule {
  action: ActionKey;
  label: string;
  role: Role;              // 누가
  from: Status;            // 어느 상태에서
  to?: Status;             // 어느 상태로 (담당변경·코멘트·참여는 상태 유지 → undefined)
  needs?: ("reason" | "result" | "resumeDate" | "member" | "duplicateId")[];
  reasonLabel?: string;    // 모달 입력 라벨
}

// 설계서 §4.2 전이 규칙 표를 그대로 코드화
export const RULES: TransitionRule[] = [
  { action: "assign_self",   label: "내가 맡기",     role: "handler",   from: "SUBMITTED",   to: "IN_PROGRESS" },
  { action: "assign_member", label: "부서원 배정",   role: "handler",   from: "SUBMITTED",   to: "IN_PROGRESS", needs: ["member"] },
  { action: "reject",        label: "반려",          role: "handler",   from: "SUBMITTED",   to: "REJECTED",   needs: ["reason"], reasonLabel: "반려 사유" },
  { action: "hold",          label: "보류",          role: "handler",   from: "IN_PROGRESS", to: "ON_HOLD",    needs: ["reason", "resumeDate"], reasonLabel: "보류 사유" },
  { action: "reject",        label: "반려",          role: "handler",   from: "IN_PROGRESS", to: "REJECTED",   needs: ["reason"], reasonLabel: "반려 사유" },
  { action: "reassign",      label: "담당 변경",     role: "handler",   from: "IN_PROGRESS", to: "IN_PROGRESS", needs: ["member"] },
  { action: "resolve",       label: "완료",          role: "handler",   from: "IN_PROGRESS", to: "RESOLVED",   needs: ["result"], reasonLabel: "처리 내역" },
  { action: "resume",        label: "처리 재개",     role: "handler",   from: "ON_HOLD",     to: "IN_PROGRESS" },
  { action: "reassign",      label: "담당 변경",     role: "handler",   from: "ON_HOLD",     to: "ON_HOLD",    needs: ["member"] },
  { action: "close",         label: "확인하고 종료", role: "requester", from: "RESOLVED",    to: "CLOSED" },
  { action: "reopen",        label: "다시 요청",     role: "requester", from: "RESOLVED",    to: "IN_PROGRESS", needs: ["reason"], reasonLabel: "다시 요청 사유" },
  { action: "reopen",        label: "다시 요청",     role: "requester", from: "REJECTED",    to: "IN_PROGRESS", needs: ["reason"], reasonLabel: "다시 요청 사유" },
];

export function allowedActions(status: Status, role: Role): TransitionRule[] {
  return RULES.filter((r) => r.from === status && r.role === role);
}

export function findRule(action: ActionKey, status: Status, role: Role) {
  return RULES.find((r) => r.action === action && r.from === status && r.role === role);
}

// 코멘트·참여는 상태 전이가 아니라 별도 규칙(설계서 §7 액션 표)
export function canComment(status: Status) { return status !== "CLOSED"; }
export function canFollow(status: Status) { return status !== "CLOSED" && status !== "REJECTED"; }
