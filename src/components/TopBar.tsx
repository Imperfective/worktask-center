"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api, getUserId, setUserId } from "@/lib/ui";

interface U { id: string; name: string; department: string; isHandler: boolean }

export default function TopBar() {
  const [users, setUsers] = useState<U[]>([]);
  const [uid, setUid] = useState("u_sales");
  const [qCount, setQCount] = useState(0);
  const path = usePathname();

  const me = users.find((u) => u.id === uid);
  const isHandler = !!me?.isHandler;

  async function refresh() {
    setUid(getUserId());
    try { const d = await api("/api/users"); setUsers(d.users); } catch {}
  }
  async function refreshQueue() {
    try {
      const d = await api("/api/requests?view=queue&tab=unassigned");
      setQCount(d.items?.length ?? 0);
    } catch { setQCount(0); }
  }
  useEffect(() => {
    refresh();
    const h = () => { refresh(); };
    window.addEventListener("user-changed", h);
    return () => window.removeEventListener("user-changed", h);
  }, []);
  useEffect(() => { if (isHandler) refreshQueue(); else setQCount(0); }, [uid, isHandler, path]);

  const today = new Date().toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });
  const link = (href: string, label: string, badge?: number) => (
    <Link href={href} style={{
      textDecoration: "none", color: path === href ? "var(--ink)" : "var(--muted)",
      fontWeight: path === href ? 600 : 400, fontSize: 14, padding: "6px 2px",
      borderBottom: path === href ? "2px solid var(--accent)" : "2px solid transparent", position: "relative",
    }}>
      {label}
      {badge ? <span style={{ marginLeft: 5, background: "var(--reject)", color: "#fff", fontSize: 10.5, fontWeight: 700, borderRadius: 10, padding: "1px 6px" }}>{badge}</span> : null}
    </Link>
  );

  return (
    <header style={{ background: "#fff", borderBottom: "1px solid var(--line)", position: "sticky", top: 0, zIndex: 20 }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 22px", display: "flex", alignItems: "center", gap: 22, height: 56 }}>
        <Link href="/" style={{ textDecoration: "none", color: "var(--ink)", fontWeight: 700, fontSize: 16, whiteSpace: "nowrap" }}>
          <span style={{ color: "var(--accent)" }}>●</span> 업무요청 센터
        </Link>
        <nav style={{ display: "flex", gap: 18, flex: 1 }} className="hide-sm">
          {link("/", "요청하기")}
          {link("/my", "내 요청")}
          {isHandler && link("/queue", "처리할 요청", qCount)}
        </nav>
        <span className="muted hide-sm" style={{ fontSize: 12.5 }}>{today}</span>
        <select className="select" style={{ width: "auto", padding: "5px 8px", fontSize: 13 }}
          value={uid} onChange={(e) => setUserId(e.target.value)}>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name} · {u.department}{u.isHandler ? " (담당자)" : ""}</option>
          ))}
        </select>
      </div>
      <nav style={{ display: "none" }} />
    </header>
  );
}
