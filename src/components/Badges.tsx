"use client";
import { statusLabel, priorityLabel, statusColor, priorityColor } from "@/lib/ui";

export function StatusBadge({ s }: { s: string }) {
  const c = `var(${statusColor[s] ?? "--muted"})`;
  return <span className="badge" style={{ color: c, background: `color-mix(in srgb, ${c} 12%, transparent)` }}>{statusLabel(s)}</span>;
}
export function PriorityBadge({ p }: { p: string }) {
  const c = `var(${priorityColor[p] ?? "--muted"})`;
  const urgent = p === "urgent";
  return <span className="badge" style={{ color: urgent ? "#fff" : c, background: urgent ? c : `color-mix(in srgb, ${c} 13%, transparent)` }}>
    {p === "urgent" && "🔥 "}{priorityLabel(p)}</span>;
}
