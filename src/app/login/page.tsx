"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DEPARTMENTS, HANDLER_DEPTS } from "@/lib/domain";

type Tab = "login" | "signup";

function LoginInner() {
  const router = useRouter();
  const next = useSearchParams().get("next") || "/";
  const [tab, setTab] = useState<Tab>("login");
  const [f, setF] = useState({ email: "", password: "", name: "", department: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k: string, v: string) => setF({ ...f, [k]: v });
  const willHandle = (HANDLER_DEPTS as readonly string[]).includes(f.department);

  async function go(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const body = tab === "login"
        ? { email: f.email, password: f.password }
        : { email: f.email, password: f.password, name: f.name, department: f.department };
      const res = await fetch(`/api/auth/${tab}`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "처리하지 못했습니다");
      router.replace(next);
      router.refresh();
    } catch (e: any) { setErr(e.message); setBusy(false); }
  }

  function swap(t: Tab) { setTab(t); setErr(""); }

  return (
    <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: "24px 16px", background: "var(--bg-2)" }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, justifyContent: "center" }}>
          <svg viewBox="0 0 177.13 38.11" width="84" height="18" fill="var(--red)" role="img" aria-label="Aurora World">
            <path d="M67.12,26.17v-9.5a7.84,7.84,0,0,1,15.68,0v9.5a2.4,2.4,0,0,1-4.8,0V22.35H71.92v3.82a2.4,2.4,0,0,1-4.8,0Zm4.8-10.07v2.2H78V16.1a3,3,0,0,0-6.08,0Z" />
            <path d="M161.45,26.17v-9.5a7.84,7.84,0,0,1,15.68,0v9.5a2.41,2.41,0,0,1-4.82,0V22.35h-6.09v3.82a2.34,2.34,0,0,1-2.38,2.38A2.38,2.38,0,0,1,161.45,26.17Zm4.77-10.07v2.2h6.09V16.1a3,3,0,0,0-3-3A3.05,3.05,0,0,0,166.22,16.1Z" />
            <path d="M96.73,21.51V11.45a2.41,2.41,0,0,1,4.81,0v9.48a7.83,7.83,0,0,1-15.66,0V11.45a2.38,2.38,0,0,1,4.76,0V21.51a3,3,0,0,0,6.09,0Z" />
            <path d="M118.73,24.87l-2.5-4.13.25-.26a6.7,6.7,0,0,0,2.37-5.27,5.94,5.94,0,0,0-5.95-5.94h-5.56a2.37,2.37,0,0,0-2.38,2.4V26.12a2.41,2.41,0,0,0,4.81,0V19.64l4.92,7.83a2.36,2.36,0,0,0,3.3.69,2.31,2.31,0,0,0,1.07-1.51A2.37,2.37,0,0,0,118.73,24.87ZM112.05,18h-2.28V12.91h2.28a2.54,2.54,0,0,1,0,5.07Z" />
            <path d="M144,26.12V11.67a2.34,2.34,0,0,1,2.35-2.4H152a5.94,5.94,0,0,1,6,5.94,6.79,6.79,0,0,1-2.37,5.27l-.27.26,2.53,4.13a2.23,2.23,0,0,1,.3,1.78A2.18,2.18,0,0,1,157,28.16a2.3,2.3,0,0,1-1.78.35,2.21,2.21,0,0,1-1.49-1l-4.95-7.83v6.48a2.39,2.39,0,1,1-4.78,0Zm4.78-13.21V18h2.29a2.54,2.54,0,1,0,0-5.07Z" />
            <path d="M121,18.75a10,10,0,1,1,10,9.91A10,10,0,0,1,121,18.75Zm4.71,0a5.25,5.25,0,1,0,5.25-5.25A5.26,5.26,0,0,0,125.66,18.75Z" />
            <path d="M19.57,3.27c0-.06-4.52,10.08-4.52,10.08a2.83,2.83,0,0,0,5.16,2.31l3.63-8.1,3.63,8.1a2.83,2.83,0,0,0,5.16-2.31S28.09,3.21,28.11,3.27A4.76,4.76,0,0,0,23.84,0,4.82,4.82,0,0,0,19.57,3.27Z" />
            <path d="M47.64,23.83a2.88,2.88,0,0,0-1.19-1.94,3,3,0,0,0-4.14.65h0a22.51,22.51,0,0,1-36.94,0,3,3,0,0,0-4.15-.65A2.91,2.91,0,0,0,0,23.83,2.89,2.89,0,0,0,.57,26a28.45,28.45,0,0,0,46.54,0A2.93,2.93,0,0,0,47.64,23.83Z" />
          </svg>
          <span style={{ width: 1, height: 16, background: "var(--line)" }} />
          <span style={{ fontSize: 14.5, fontWeight: 700 }}>업무요청 센터</span>
        </div>

        <div className="card" style={{ overflow: "hidden" }}>
          <div className="tabs" style={{ padding: "0 18px" }}>
            <button className={`tab ${tab === "login" ? "on" : ""}`} onClick={() => swap("login")}>로그인</button>
            <button className={`tab ${tab === "signup" ? "on" : ""}`} onClick={() => swap("signup")}>회원가입</button>
          </div>

          <form onSubmit={go} style={{ padding: 18, display: "grid", gap: 14 }}>
            {tab === "signup" && (
              <>
                <div>
                  <div className="flabel">이름</div>
                  <input className="input" value={f.name} onChange={(e) => set("name", e.target.value)}
                    placeholder="홍길동" autoComplete="name" required maxLength={30} />
                </div>
                <div>
                  <div className="flabel">부서 <span className="fnote">담당 부서를 고르면 처리 담당자가 됩니다</span></div>
                  <select className="select" value={f.department} onChange={(e) => set("department", e.target.value)} required>
                    <option value="">선택하세요</option>
                    {DEPARTMENTS.map((dp) => (
                      <option key={dp} value={dp}>
                        {dp}{(HANDLER_DEPTS as readonly string[]).includes(dp) ? " — 처리 담당" : ""}
                      </option>
                    ))}
                  </select>
                  {f.department && (
                    <p className="sm2" style={{ margin: "7px 0 0", lineHeight: 1.6 }}>
                      {willHandle
                        ? `${f.department}으로 접수된 요청을 처리하는 담당자 계정이 됩니다.`
                        : `요청자 계정이 됩니다. 요청을 등록하고 진행 상황을 확인할 수 있습니다.`}
                    </p>
                  )}
                </div>
              </>
            )}
            <div>
              <div className="flabel">이메일</div>
              <input className="input" type="email" value={f.email} onChange={(e) => set("email", e.target.value)}
                placeholder="name@example.com" autoComplete="email" required />
            </div>
            <div>
              <div className="flabel">비밀번호 {tab === "signup" && <span className="fnote">8자 이상</span>}</div>
              <input className="input" type="password" value={f.password} onChange={(e) => set("password", e.target.value)}
                autoComplete={tab === "login" ? "current-password" : "new-password"} required minLength={tab === "signup" ? 8 : 1} />
            </div>

            {err && (
              <div style={{ padding: "9px 13px", borderRadius: 8, fontSize: 12.5,
                background: "var(--red-soft)", border: "1px solid var(--red-line)", color: "var(--red-dark)" }}>{err}</div>
            )}
            <button className="btn prim" type="submit" disabled={busy} style={{ padding: "10px 14px" }}>
              {busy ? "처리 중…" : tab === "login" ? "로그인" : "가입하고 시작하기"}
            </button>
          </form>
        </div>

        <div className="card" style={{ marginTop: 12, padding: "12px 16px" }}>
          <div style={{ fontSize: 12.5, fontWeight: 700 }}>둘러보기용 데모 계정</div>
          <div className="sm2" style={{ marginTop: 3, lineHeight: 1.6 }}>
            가상 인물입니다. 비밀번호는 모두 <b>worktask1234</b>
          </div>
          <div style={{ marginTop: 9, display: "grid", gap: 4, fontSize: 12 }}>
            {[
              ["fac@example.com", "박시설 · 시설팀 · 처리 담당"],
              ["it@example.com", "최아이티 · IT팀 · 처리 담당"],
              ["ga@example.com", "정총무 · 총무팀 · 처리 담당"],
              ["sales@example.com", "김영업 · 영업팀 · 요청자"],
              ["design@example.com", "이하나 · 디자인팀 · 요청자"],
            ].map(([em, who]) => (
              <button key={em} type="button" onClick={() => { setTab("login"); setF({ ...f, email: em, password: "worktask1234" }); }}
                style={{ display: "flex", gap: 8, alignItems: "baseline", textAlign: "left", cursor: "pointer",
                  border: "1px solid var(--line-2)", background: "#fff", borderRadius: 6, padding: "5px 9px", fontFamily: "inherit" }}>
                <b style={{ fontSize: 12 }}>{em}</b>
                <span className="sm2">{who}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense><LoginInner /></Suspense>;
}
