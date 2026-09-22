"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, code, fmtDate, categoryLabel } from "@/lib/ui";
import { StatusBadge, PriorityText } from "@/components/Badges";
import { deptToHandlers, SEED_USERS } from "@/lib/domain";

const TABS = [
  { key: "unassigned", label: "미배정 요청" },
  { key: "mine", label: "내게 할당된 요청" },
  { key: "hold", label: "보류 중인 요청" },
  { key: "resolved", label: "완료된 요청" },
];

export default function QueuePage() {
  const [tab, setTab] = useState("unassigned");
  const [items, setItems] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [stats, setStats] = useState<any>(null);
  const [me, setMe] = useState<any>(null);
  const router = useRouter();

  async function load() {
    try {
      const [d, s, u, all] = await Promise.all([
        api(`/api/requests?view=queue&tab=${tab}`), api("/api/stats"), api("/api/users"),
        Promise.all(TABS.map((t) => api(`/api/requests?view=queue&tab=${t.key}`))),
      ]);
      setItems(d.items); setStats(s);
      setMe(u.users.find((x: any) => x.id === localStorage.getItem("worktask-user")));
      setCounts(Object.fromEntries(TABS.map((t, i) => [t.key, all[i].items.length])));
    } catch {}
  }
  useEffect(() => { load(); }, [tab]);
  useEffect(() => {
    const h = () => load();
    window.addEventListener("user-changed", h);
    return () => window.removeEventListener("user-changed", h);
  }, [tab]);

  async function assign(id: number, toUserId?: string) {
    try { await api(`/api/requests/${id}/assign`, { method: "POST", body: JSON.stringify({ toUserId }) }); load(); }
    catch (e: any) { alert(e.message); }
  }
  const members = (deptToHandlers[me?.department] ?? []).map((id: string) => SEED_USERS.find((s) => s.id === id)!);

  const Stat = ({ l, v, red }: { l: string; v: any; red?: boolean }) => (
    <div className="card" style={{ padding: "10px 16px", minWidth: 104 }}>
      <div className="sm2">{l}</div>
      <div style={{ fontSize: 17, fontWeight: 700, marginTop: 2, color: red && v !== "0건" ? "var(--red)" : "var(--ink)" }}>{v}</div>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <h1 className="h1">처리할 요청</h1>
            <span className="pillbadge" style={{ background: "var(--red-soft)", color: "var(--red)" }}>{me?.department}</span>
          </div>
          <p className="sub">{me?.department}으로 접수된 요청 · 정렬: 긴급도 → 접수순</p>
        </div>
        {stats && <div style={{ display: "flex", gap: 10, marginLeft: "auto" }}>
          <Stat l="오늘 접수" v={`${stats.todayCount}건`} />
          <Stat l="평균 처리 시간" v={`${stats.avgResolveHours}시간`} />
          <Stat l="미배정 긴급" v={`${stats.unassignedUrgent}건`} red />
        </div>}
      </div>

      <div className="card">
        <div className="tabs">
          {TABS.map((t) => (
            <button key={t.key} className={`tab ${tab === t.key ? "on" : ""}`} onClick={() => setTab(t.key)}>
              {t.label}<span className="n">{counts[t.key] ?? 0}</span>
            </button>
          ))}
        </div>
        {items.length === 0 ? (
          <p className="sm2" style={{ padding: "44px 0", textAlign: "center" }}>이 탭에 해당하는 요청이 없습니다</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead><tr>
                <th style={{ width: 72 }}>ID</th><th>제목</th><th style={{ width: 90 }}>카테고리</th>
                <th style={{ width: 62 }}>긴급도</th><th style={{ width: 110 }}>요청자</th>
                <th style={{ width: 58 }}>참여자</th><th style={{ width: 104 }}>접수 시각</th><th style={{ width: 190 }}>액션</th>
              </tr></thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id} className={`row ${r.priority === "urgent" && r.status === "SUBMITTED" ? "urgent" : ""}`}
                      onClick={() => router.push(`/r/${r.id}`)}>
                    <td className="code">{code(r.id)}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                        <span className="tt">{r.title}</span>
                        {tab !== "unassigned" && <StatusBadge s={r.status} />}
                      </div>
                      {r.status === "ON_HOLD" && r.holdReason && (
                        <span className="pillbadge" style={{ background: "var(--amber-soft)", color: "var(--amber-dark)", marginTop: 6 }}>
                          보류 사유: {r.holdReason}</span>)}
                    </td>
                    <td className="sm2">{categoryLabel(r.category)}</td>
                    <td><PriorityText p={r.priority} /></td>
                    <td style={{ fontSize: 13 }}>{r.requesterName}</td>
                    <td className="sm2">{r.followerCount}명</td>
                    <td className="sm2" style={{ fontVariantNumeric: "tabular-nums" }}>{fmtDate(r.createdAt)}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {r.status === "SUBMITTED" ? (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className={`btn sm ${r.priority === "urgent" ? "prim" : "ghost-red"}`} onClick={() => assign(r.id)}>내가 맡기</button>
                          <select className="select" style={{ width: "auto", padding: "5px 8px", fontSize: 12.5 }}
                            defaultValue="" onChange={(e) => e.target.value && assign(r.id, e.target.value)}>
                            <option value="">부서원 배정</option>
                            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                          </select>
                        </div>
                      ) : <button className="btn sm" onClick={() => router.push(`/r/${r.id}`)}>열기</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="sm2" style={{ padding: "11px 16px", borderTop: "1px solid var(--line-2)" }}>
          긴급 건은 배정 전까지 상단에 고정됩니다
        </div>
      </div>
    </div>
  );
}
