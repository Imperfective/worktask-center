"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, categoryLabel } from "@/lib/ui";
import { StatusBadge, PriorityBadge } from "@/components/Badges";

const TABS = [
  { key: "unassigned", label: "미배정" },
  { key: "mine", label: "내게 할당된 요청" },
  { key: "hold", label: "보류 중" },
  { key: "resolved", label: "완료된 요청" },
];

export default function QueuePage() {
  const [tab, setTab] = useState("unassigned");
  const [items, setItems] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const router = useRouter();

  async function load() {
    try {
      const [d, s] = await Promise.all([api(`/api/requests?view=queue&tab=${tab}`), api("/api/stats")]);
      setItems(d.items); setStats(s);
    } catch {}
  }
  useEffect(() => { load(); }, [tab]);
  useEffect(() => {
    const h = () => load();
    window.addEventListener("user-changed", h);
    return () => window.removeEventListener("user-changed", h);
  }, [tab]);

  async function take(id: number) {
    try { await api(`/api/requests/${id}/assign`, { method: "POST", body: JSON.stringify({}) }); load(); }
    catch (e: any) { alert(e.message); }
  }

  const Stat = ({ n, l, warn }: { n: any; l: string; warn?: boolean }) => (
    <div className="card" style={{ padding: "14px 18px", flex: 1, minWidth: 130 }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: warn && n > 0 ? "var(--urgent)" : "var(--ink)" }}>{n}</div>
      <div className="muted" style={{ fontSize: 12 }}>{l}</div>
    </div>
  );

  return (
    <div>
      <h1 style={{ fontSize: 20, margin: "4px 0 14px" }}>처리할 요청</h1>
      {stats && <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <Stat n={stats.todayCount} l="오늘 접수" />
        <Stat n={`${stats.avgResolveHours}시간`} l="평균 처리 시간" />
        <Stat n={stats.unassignedUrgent} l="미배정 긴급" warn />
      </div>}
      <div className="card">
        <div className="tabs" style={{ padding: "0 8px" }}>
          {TABS.map((t) => <button key={t.key} className={`tab ${tab === t.key ? "on" : ""}`} onClick={() => setTab(t.key)}>{t.label}</button>)}
        </div>
        {items.length === 0
          ? <p className="muted" style={{ padding: 34, textAlign: "center", fontSize: 13.5 }}>해당하는 요청이 없습니다.</p>
          : <div style={{ overflowX: "auto" }}>
            <table>
              <thead><tr>
                <th style={{ width: 54 }}>ID</th><th>제목</th><th style={{ width: 80 }}>긴급도</th>
                <th style={{ width: 88 }}>상태</th><th style={{ width: 90 }}>요청자</th><th style={{ width: 120 }}>액션</th>
              </tr></thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id} className="clickable" onClick={() => router.push(`/r/${r.id}`)}
                      style={r.priority === "urgent" && r.status === "SUBMITTED" ? { background: "color-mix(in srgb,var(--urgent) 5%,transparent)" } : {}}>
                    <td className="muted">#{r.id}</td>
                    <td><div style={{ fontWeight: 500 }}>{r.title}</div>
                      <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>
                        {categoryLabel(r.category)}{r.followerCount > 1 && ` · 참여 ${r.followerCount}명`}
                        {r.assigneeName && ` · 담당 ${r.assigneeName}`}
                      </div></td>
                    <td><PriorityBadge p={r.priority} /></td>
                    <td><StatusBadge s={r.status} /></td>
                    <td style={{ fontSize: 13 }}>{r.requesterName}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {r.status === "SUBMITTED"
                        ? <button className="btn sm prim" onClick={() => take(r.id)}>내가 맡기</button>
                        : <button className="btn sm" onClick={() => router.push(`/r/${r.id}`)}>상세</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>}
      </div>
    </div>
  );
}
