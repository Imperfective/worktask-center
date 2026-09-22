"use client";
import { STATUS, PRIORITY, catByKey } from "./domain";

const KEY = "worktask-user";
export function getUserId(): string {
  if (typeof window === "undefined") return "u_sales";
  return localStorage.getItem(KEY) || "u_sales";
}
export function setUserId(id: string) {
  localStorage.setItem(KEY, id);
  window.dispatchEvent(new Event("user-changed"));
}
export async function api(path: string, opts: RequestInit = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { "content-type": "application/json", "x-user-id": getUserId(), ...(opts.headers || {}) },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "요청 실패");
  return data;
}
export const statusLabel = (s: string) => (STATUS as any)[s] ?? s;
export const priorityLabel = (p: string) => (PRIORITY as any)[p] ?? p;
export const categoryLabel = (c: string) => catByKey(c)?.label ?? c;
export const code = (id: number) => "#" + String(id).padStart(4, "0");   // 시안의 #0021 표기
export const initial = (name: string) => name.slice(0, 1);

// 상태별 색 (시안 팔레트)
export const ST_COLOR: Record<string, { fg: string; bg: string }> = {
  SUBMITTED:   { fg: "var(--muted)",     bg: "var(--line-3)" },
  IN_PROGRESS: { fg: "var(--blue)",      bg: "#eaf1fe" },
  ON_HOLD:     { fg: "var(--amber-dark)",bg: "var(--amber-soft)" },
  RESOLVED:    { fg: "var(--green)",     bg: "#eafaf1" },
  CLOSED:      { fg: "var(--muted)",     bg: "var(--line-3)" },
  REJECTED:    { fg: "var(--red)",       bg: "var(--red-soft)" },
};
// 긴급도: 긴급만 강조, 나머지는 텍스트
export const PR_COLOR: Record<string, string> = {
  urgent: "var(--red)", high: "var(--ink)", normal: "var(--ink-3)", low: "var(--muted-2)",
};
export function fmtDate(x: string | Date, withYear = false) {
  const d = new Date(x);
  const mm = String(d.getMonth() + 1).padStart(2, "0"), dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0"), mi = String(d.getMinutes()).padStart(2, "0");
  return withYear ? `${d.getFullYear()}-${mm}-${dd} ${hh}:${mi}` : `${mm}-${dd} ${hh}:${mi}`;
}
export const fmtTime = (x: string | Date) => {
  const d = new Date(x);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
