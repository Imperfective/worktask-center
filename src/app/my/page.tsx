"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, code, fmtDate, getUserId } from "@/lib/ui";
import { StatusBadge, PriorityText } from "@/components/Badges";

const TABS = [
  { key: "progress", label: "진행 중" },
  { key: "resolved", label: "완료" },
  { key: "closed", label: "종료" },
];

export default function MyPage() {
  const [tab, setTab] = useState("progress");
  const [items, setItems] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [me, setMe] = useState<any>(null);
  const [uid, setUid] = useState("");
  const router = useRouter();

  async function load() {
    setUid(getUserId());
    try {
      const [d, all] = await Promise.all([
        api(`/api/requests?view=mine&tab=${tab}`),
        Promise.all(TABS.map((t) => api(`/api/requests?view=mine&tab=${t.key}`))),
      ]);
      setItems(d.items);
      setCounts(Object.fromEntries(TABS.map((t, i) => [t.key, all[i].items.length])));
      const u = await api("/api/users");
      setMe(u.users.find((x: any) => x.id === getUserId()));
    } catch {}
  }
  useEffect(() => { load(); }, [tab]);
  useEffect(() => {
    const h = () => load();
    window.addEventListener("user-changed", h);
    return () => window.removeEventListener("user-changed", h);
  }, [tab]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
        <div>
          <h1 className="h1">내 요청</h1>
          <p className="sub">{me?.name} 님이 등록했거나 참여 중인 요청</p>
        </div>
        <Link href="/" className="btn prim" style={{ marginLeft: "auto", textDecoration: "none" }}>+ 요청하기</Link>
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
                <th style={{ width: 72 }}>ID</th><th>제목</th><th style={{ width: 92 }}>상태</th>
                <th style={{ width: 120 }}>담당자</th><th style={{ width: 70 }}>긴급도</th><th style={{ width: 110 }}>마지막 업데이트</th>
              </tr></thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id} className="row" onClick={() => router.push(`/r/${r.id}`)}>
                    <td className="code">{code(r.id)}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                        <span className="tt">{r.title}</span>
                        {r.requesterId !== uid && <span className="pillbadge" style={{ background: "#eafaf1", color: "var(--green)" }}>참여</span>}
                      </div>
                      {r.status === "ON_HOLD" && r.holdReason && (
                        <span className="pillbadge" style={{ background: "var(--amber-soft)", color: "var(--amber-dark)", marginTop: 6 }}>
                          보류 사유: {r.holdReason}{r.holdResumeDate && ` · 예상 재개 ${r.holdResumeDate.slice(5)}`}
                        </span>)}
                    </td>
                    <td><StatusBadge s={r.status} /></td>
                    <td>{r.assigneeName
                      ? <span style={{ fontSize: 13 }}>{r.assigneeName} <span className="sm2">{r.department}</span></span>
                      : <span className="sm2">미배정</span>}</td>
                    <td><PriorityText p={r.priority} /></td>
                    <td className="sm2" style={{ fontVariantNumeric: "tabular-nums" }}>{fmtDate(r.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
