"use client";
import { statusLabel, priorityLabel, ST_COLOR, PR_COLOR } from "@/lib/ui";

export function StatusBadge({ s }: { s: string }) {
  const c = ST_COLOR[s] ?? ST_COLOR.SUBMITTED;
  return <span className="st" style={{ color: c.fg, background: c.bg }}><i />{statusLabel(s)}</span>;
}
export function PriorityText({ p }: { p: string }) {
  if (p === "urgent")
    return <span className="pillbadge" style={{ color: "var(--red)", background: "var(--red-soft)" }}>긴급</span>;
  return <span style={{ color: PR_COLOR[p] ?? "var(--ink-3)", fontWeight: p === "high" ? 600 : 400, fontSize: 12.5 }}>
    {priorityLabel(p)}</span>;
}
export function Avatar({ name, red }: { name: string; red?: boolean }) {
  return <span className={`avatar${red ? " red" : ""}`}>{name.slice(0, 1)}</span>;
}
