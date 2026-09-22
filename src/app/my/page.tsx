"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, categoryLabel, getUserId } from "@/lib/ui";
import { StatusBadge, PriorityBadge } from "@/components/Badges";

const TABS = [
  { key: "progress", label: "진행 중" },
  { key: "resolved", label: "완료" },
  { key: "closed", label: "종료·반려" },
];

export default function MyPage() {
  const [tab, setTab] = useState("progress");
  const [items, setItems] = useState<any[]>([]);
  const [uid, setUid] = useState("");
  const router = useRouter();

  async function load() {
    setUid(getUserId());
    try { const d = await api(`/api/requests?view=mine&tab=${tab}`); setItems(d.items); } catch {}
  }
  useEffect(() => { load(); }, [tab]);
  useEffect(() => {
    const h = () => load();
    window.addEventListener("user-changed", h);
    return () => window.removeEventListener("user-changed", h);
  }, [tab]);

  const fmt = (d: string) => new Date(d).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <div>
      <h1 style={{ fontSize: 20, margin: "4px 0 14px" }}>내 요청</h1>
      <div className="card">
        <div className="tabs" style={{ padding: "0 8px" }}>
          {TABS.map((t) => <button key={t.key} className={`tab ${tab === t.key ? "on" : ""}`} onClick={() => setTab(t.key)}>{t.label}</button>)}
        </div>
        {items.length === 0
          ? <p className="muted" style={{ padding: 34, textAlign: "center", fontSize: 13.5 }}>해당하는 요청이 없습니다.</p>
          : <div style={{ overflowX: "auto" }}>
            <table>
              <thead><tr>
                <th style={{ width: 54 }}>ID</th><th>제목</th><th style={{ width: 90 }}>상태</th>
                <th style={{ width: 96 }}>담당자</th><th style={{ width: 80 }}>긴급도</th><th style={{ width: 110 }}>마지막 업데이트</th>
              </tr></thead>
              <tbody>
                {items.map((r) => (
                  <>
                    <tr key={r.id} className="clickable" onClick={() => router.push(`/r/${r.id}`)}>
                      <td className="muted">#{r.id}</td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{r.title}</div>
                        <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>
                          {categoryLabel(r.category)} · {r.department}
                          {r.requesterId !== uid && <span className="badge" style={{ marginLeft: 6, background: "var(--accent-soft)", color: "var(--accent)" }}>참여</span>}
                          {r.followerCount > 1 && <span className="muted" style={{ marginLeft: 6 }}>참여 {r.followerCount}명</span>}
                        </div>
                      </td>
                      <td><StatusBadge s={r.status} /></td>
                      <td style={{ fontSize: 13 }}>{r.assigneeName ?? <span className="muted">미배정</span>}</td>
                      <td><PriorityBadge p={r.priority} /></td>
                      <td className="muted" style={{ fontSize: 12 }}>{fmt(r.updatedAt)}</td>
                    </tr>
                    {r.status === "ON_HOLD" && r.holdReason && (
                      <tr key={`h${r.id}`}><td></td><td colSpan={5} style={{ paddingTop: 0 }}>
                        <div style={{ fontSize: 12.5, color: "var(--hold)", background: "color-mix(in srgb,var(--hold) 9%,transparent)", padding: "7px 11px", borderRadius: 6 }}>
                          ⏸ 보류 사유: {r.holdReason}{r.holdResumeDate && ` · 예상 재개 ${r.holdResumeDate}`}
                        </div></td></tr>
                    )}
                    {r.status === "RESOLVED" && (
                      <tr key={`d${r.id}`}><td></td><td colSpan={5} style={{ paddingTop: 0 }}>
                        <button className="btn sm prim" onClick={() => router.push(`/r/${r.id}`)}>확인하기 →</button>
                      </td></tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>}
      </div>
    </div>
  );
}
