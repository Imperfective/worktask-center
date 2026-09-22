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
          {/* AURORA 마크 */}
          <svg className="brand-mark" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M12 2c1.6 4.2 4.4 6.2 7 8.2-1.3 6-5.2 9.4-7 11.8-1.8-2.4-5.7-5.8-7-11.8C7.6 8.2 10.4 6.2 12 2Z"
              fill="#d92b1f" />
            <path d="M12 7c.9 2.2 2.4 3.3 3.8 4.4-.7 3.2-2.8 5-3.8 6.3-1-1.3-3.1-3.1-3.8-6.3C9.6 10.3 11.1 9.2 12 7Z"
              fill="#fff" fillOpacity=".55" />
          </svg>
          <span className="brand-word">AURORA</span>
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
