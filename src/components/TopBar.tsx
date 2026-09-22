"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api, getUserId, setUserId, initial } from "@/lib/ui";

interface U { id: string; name: string; department: string; isHandler: boolean }

export default function TopBar() {
  const [users, setUsers] = useState<U[]>([]);
  const [uid, setUid] = useState("u_sales");
  const [qCount, setQCount] = useState(0);
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const box = useRef<HTMLDivElement>(null);

  const me = users.find((u) => u.id === uid);
  const isHandler = !!me?.isHandler;

  async function refresh() {
    setUid(getUserId());
    try { setUsers((await api("/api/users")).users); } catch {}
  }
  useEffect(() => {
    refresh();
    const h = () => refresh();
    window.addEventListener("user-changed", h);
    const c = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("click", c);
    return () => { window.removeEventListener("user-changed", h); document.removeEventListener("click", c); };
  }, []);
  useEffect(() => {
    if (!isHandler) { setQCount(0); return; }
    api("/api/requests?view=queue&tab=unassigned").then((d) => setQCount(d.items?.length ?? 0)).catch(() => setQCount(0));
  }, [uid, isHandler, path]);

  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} (${"일월화수목금토"[d.getDay()]})`;

  const Nav = ({ href, label, n }: { href: string; label: string; n?: number }) => (
    <Link href={href} className={path === href ? "on" : ""}>
      {label}{n ? <span className="cnt">{n}</span> : null}
    </Link>
  );

  return (
    <header className="topbar">
      <div className="topbar-in">
        <Link href="/" className="brand">
          {/* 시안의 Aurora World 워드마크 SVG 원본 */}
          <svg className="brand-mark" viewBox="0 0 177.13 38.11" width="84" height="18"
            fill="currentColor" role="img" aria-label="Aurora World">
            <path d="M67.12,26.17v-9.5a7.84,7.84,0,0,1,15.68,0v9.5a2.4,2.4,0,0,1-4.8,0V22.35H71.92v3.82a2.4,2.4,0,0,1-4.8,0Zm4.8-10.07v2.2H78V16.1a3,3,0,0,0-6.08,0Z" />
            <path d="M161.45,26.17v-9.5a7.84,7.84,0,0,1,15.68,0v9.5a2.41,2.41,0,0,1-4.82,0V22.35h-6.09v3.82a2.34,2.34,0,0,1-2.38,2.38A2.38,2.38,0,0,1,161.45,26.17Zm4.77-10.07v2.2h6.09V16.1a3,3,0,0,0-3-3A3.05,3.05,0,0,0,166.22,16.1Z" />
            <path d="M96.73,21.51V11.45a2.41,2.41,0,0,1,4.81,0v9.48a7.83,7.83,0,0,1-15.66,0V11.45a2.38,2.38,0,0,1,4.76,0V21.51a3,3,0,0,0,6.09,0Z" />
            <path d="M118.73,24.87l-2.5-4.13.25-.26a6.7,6.7,0,0,0,2.37-5.27,5.94,5.94,0,0,0-5.95-5.94h-5.56a2.37,2.37,0,0,0-2.38,2.4V26.12a2.41,2.41,0,0,0,4.81,0V19.64l4.92,7.83a2.36,2.36,0,0,0,3.3.69,2.31,2.31,0,0,0,1.07-1.51A2.37,2.37,0,0,0,118.73,24.87ZM112.05,18h-2.28V12.91h2.28a2.54,2.54,0,0,1,0,5.07Z" />
            <path d="M144,26.12V11.67a2.34,2.34,0,0,1,2.35-2.4H152a5.94,5.94,0,0,1,6,5.94,6.79,6.79,0,0,1-2.37,5.27l-.27.26,2.53,4.13a2.23,2.23,0,0,1,.3,1.78A2.18,2.18,0,0,1,157,28.16a2.3,2.3,0,0,1-1.78.35,2.21,2.21,0,0,1-1.49-1l-4.95-7.83v6.48a2.39,2.39,0,1,1-4.78,0Zm4.78-13.21V18h2.29a2.54,2.54,0,1,0,0-5.07Z" />
            <path d="M121,18.75a10,10,0,1,1,10,9.91A10,10,0,0,1,121,18.75Zm4.71,0a5.25,5.25,0,1,0,5.25-5.25A5.26,5.26,0,0,0,125.66,18.75Z" />
            <path d="M19.57,3.27c0-.06-4.52,10.08-4.52,10.08a2.83,2.83,0,0,0,5.16,2.31l3.63-8.1,3.63,8.1a2.83,2.83,0,0,0,5.16-2.31S28.09,3.21,28.11,3.27A4.76,4.76,0,0,0,23.84,0,4.82,4.82,0,0,0,19.57,3.27Z" />
            <path d="M47.64,23.83a2.88,2.88,0,0,0-1.19-1.94,3,3,0,0,0-4.14.65h0a22.51,22.51,0,0,1-36.94,0,3,3,0,0,0-4.15-.65A2.91,2.91,0,0,0,0,23.83,2.89,2.89,0,0,0,.57,26a28.45,28.45,0,0,0,46.54,0A2.93,2.93,0,0,0,47.64,23.83Z" />
          </svg>
        </Link>
        <span className="brand-div" />
        <Link href="/" className="brand-name">업무요청 센터</Link>

        <nav className="nav">
          <Nav href="/" label="요청하기" />
          <Nav href="/my" label="내 요청" />
          {isHandler && <Nav href="/queue" label="처리할 요청" n={qCount} />}
        </nav>

        <div className="top-right">
          <span className="today hide-sm">{today}</span>
          <span className="poc hide-sm">PoC</span>
          <div ref={box} style={{ position: "relative" }}>
            <button className="userchip" onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>
              <span className="avatar">{initial(me?.name ?? "")}</span>
              <span className="nm">{me?.name ?? "…"}</span>
              <span className="dp hide-sm">{me?.department}</span>
              <span className="car">▼</span>
            </button>
            {open && (
              <div className="userpop" onClick={(e) => e.stopPropagation()}>
                <div className="hd">PoC — 로그인 대신 역할을 바꿉니다</div>
                {users.map((u) => (
                  <button key={u.id} onClick={() => { setUserId(u.id); setOpen(false); }}>
                    <span className={`avatar${u.id === uid ? " red" : ""}`}>{initial(u.name)}</span>
                    <span>
                      <span className="nm" style={{ display: "block" }}>{u.name}</span>
                      <span className="sub">{u.department} · {u.isHandler ? "담당자" : "요청자"}</span>
                    </span>
                    {u.id === uid && <span className="ck">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
