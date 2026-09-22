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

export const statusColor: Record<string, string> = {
  SUBMITTED: "--sub", IN_PROGRESS: "--prog", ON_HOLD: "--hold",
  RESOLVED: "--done", CLOSED: "--closed", REJECTED: "--reject",
};
export const priorityColor: Record<string, string> = {
  urgent: "--urgent", high: "--high", normal: "--normal", low: "--low",
};
