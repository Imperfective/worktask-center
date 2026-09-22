"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, code } from "@/lib/ui";
import { CATEGORIES, deptOfCategory } from "@/lib/domain";
import { StatusBadge } from "@/components/Badges";

type Mode = "ai" | "manual";
const EXAMPLES = [
  { label: "프로젝터 고장", text: "3층 회의실 프로젝터가 안 켜져요. 오후 3시 발표 전에 봐주세요" },
  { label: "VPN 계정", text: "VPN 계정이 잠겨서 로그인이 안 됩니다" },
  { label: "에어컨", text: "4층 사무실 에어컨 냉방이 거의 안 됩니다" },
];
const URGENCIES = [
  { v: "low", label: "낮음" }, { v: "normal", label: "보통" },
  { v: "high", label: "높음" }, { v: "urgent", label: "긴급" },
];

/* 카드 아이콘 — 모드마다 고정. 선택 여부는 색만 바꾼다. */
function ModeIcon({ mode, on }: { mode: Mode; on: boolean }) {
  return (
    <span style={{ width: 26, height: 26, borderRadius: 7, flex: "none", display: "grid", placeItems: "center",
      background: on ? "#fff" : "var(--line-3)" }}>
      {mode === "ai" ? (
        <span style={{ width: 11, height: 11, background: on ? "var(--red)" : "var(--muted-2)",
          transform: "rotate(45deg)", borderRadius: 2, display: "block" }} />
      ) : (
        <span style={{ display: "grid", gap: 2.5 }}>
          {[11, 8, 6].map((w, i) => (
            <i key={i} style={{ width: w, height: 1.8, borderRadius: 1, display: "block",
              background: on ? "var(--red)" : "var(--muted-2)" }} />
          ))}
        </span>
      )}
    </span>
  );
}

export default function Page() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("ai");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [sug, setSug] = useState<any>(null);          // AI 모드의 제안 카드 노출 여부
  const [similar, setSimilar] = useState<any[]>([]);
  const [joined, setJoined] = useState<number[]>([]);
  const [form, setForm] = useState<{ title: string; category: string; priority: string; summary: string }>(
    { title: "", category: CATEGORIES[0].key, priority: "normal", summary: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const timer = useRef<any>(null);
  const seq = useRef(0);                       // 늦게 도착한 이전 응답이 최신 결과를 덮지 않게
  const lastText = useRef("");                 // 같은 문장을 다시 분석하지 않게
  const touched = useRef<Set<string>>(new Set());  // 사용자가 직접 고친 항목

  const DEBOUNCE_MS = 700;
  const MIN_CHARS = 4;                         // 한두 글자에 매번 모델을 부르지 않는다

  // 사용자가 직접 바꾼 항목은 이후 자동 분석이 덮어쓰지 않는다
  function setField(k: "title" | "category" | "priority", v: string) {
    touched.current.add(k);
    setForm((f) => ({ ...f, [k]: v }));
  }

  function reset() {
    seq.current++;                             // 진행 중인 응답을 폐기한다
    lastText.current = ""; touched.current.clear();
    setSug(null); setSimilar([]); setLoading(false); setErr("");
    setForm({ title: "", category: CATEGORIES[0].key, priority: "normal", summary: "" });
  }

  function switchMode(m: Mode) {
    setMode(m); setText(""); reset();
  }

  async function analyze(t?: string) {
    const body = (t ?? text).trim();
    if (!body) return;
    const my = ++seq.current;
    lastText.current = body;
    setLoading(true);
    try {
      const d = await api("/api/ai/analyze", { method: "POST", body: JSON.stringify({ text: body, mode }) });
      if (my !== seq.current) return;          // 그사이 더 최신 요청이 떠났으면 이 결과는 버린다
      setSimilar(d.similar);
      if (mode === "ai") {
        setSug(d.suggestion);
        // 사용자가 손댄 항목은 그대로 두고 나머지만 갱신한다.
        // 한 줄 요약은 AI 소유(읽기 전용)라 항상 새로 쓴다.
        setForm((f) => ({
          title: touched.current.has("title") ? f.title : d.suggestion.title || "",
          category: touched.current.has("category") ? f.category : d.suggestion.category || CATEGORIES[0].key,
          priority: touched.current.has("priority") ? f.priority : d.suggestion.urgency || "normal",
          summary: d.suggestion.summary || "",
        }));
      } else {
        // 직접 입력: 한 줄 요약만 채운다 (설계서 §6)
        setForm((f) => ({ ...f, summary: d.suggestion.summary || "" }));
      }
    } catch (e: any) {
      if (my === seq.current) setErr(e.message);
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }

  // 두 모드 모두 입력이 멎으면 스스로 분석한다. 버튼을 누를 필요가 없다.
  // AI 모드는 제목·카테고리·긴급도까지, 직접 입력은 요약과 유사 요청만 갱신한다.
  useEffect(() => {
    clearTimeout(timer.current);
    const body = text.trim();
    if (!body) { reset(); return; }
    if (body.length < MIN_CHARS || body === lastText.current) return;
    timer.current = setTimeout(() => analyze(body), DEBOUNCE_MS);
    return () => clearTimeout(timer.current);
  }, [text, mode]);

  function clearAll() { setText(""); reset(); }
  async function submit() {
    if (!form.title.trim()) { setErr("제목을 입력하세요"); return; }
    if (!text.trim()) { setErr("요청 내용을 입력하세요"); return; }
    setErr("");
    setBusy(true);
    try {
      const accepted = sug ? { title: form.title === sug.title, category: form.category === sug.category, urgency: form.priority === sug.urgency } : {};
      const d = await api("/api/requests", { method: "POST", body: JSON.stringify({
        title: form.title, description: text, category: form.category, priority: form.priority,
        summary: form.summary, mode, aiSuggestion: mode === "ai" ? sug : null, acceptedFields: accepted }) });
      router.push(`/r/${d.id}`);
    } catch (e: any) { setErr(e.message); setBusy(false); }
  }
  async function join(id: number) {
    try { await api(`/api/requests/${id}/follow`, { method: "POST", body: JSON.stringify({ via: "register" }) });
      setJoined([...joined, id]);
    } catch (e: any) { setErr(e.message); }
  }

  const fDept = deptOfCategory(form.category);
  const MODES: { v: Mode; label: string; desc: string }[] = [
    { v: "ai", label: "AI 자동 작성", desc: "적는 동안 제목·카테고리·긴급도가 자동으로 채워집니다" },
    { v: "manual", label: "직접 입력", desc: "항목을 직접 고르고, 한 줄 요약만 AI가 만듭니다" },
  ];

  /* 폼 본문 — 두 모드가 공유하되, 직접 입력에는 '요청 내용'이 안에 들어간다 */
  const FormBody = (
    <div style={{ padding: 18, display: "grid", gap: 15 }}>
      <div>
        <div className="flabel">제목 {mode === "ai" && <span className="fnote">AI 작성 · 수정 가능</span>}</div>
        <input className="input" value={form.title} placeholder={mode === "manual" ? "무엇이 필요한지 한 줄로 적어주세요" : ""}
          onChange={(e) => setField("title", e.target.value)} />
      </div>
      <div className="pair">
        <div>
          <div className="flabel">카테고리 {mode === "ai" && <span className="fnote">AI 분류</span>}</div>
          <select className="select" value={form.category} onChange={(e) => setField("category", e.target.value)}>
            {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <div className="flabel">담당 부서</div>
          <div className="input" style={{ background: "var(--bg-2)", display: "flex", alignItems: "center", gap: 8 }}>
            <b style={{ fontSize: 13 }}>{fDept}</b><span className="fnote">카테고리에 따라 자동 배정</span>
          </div>
        </div>
      </div>
      <div>
        <div className="flabel">긴급도{" "}
          <span className="fnote">{mode === "ai" ? "AI 판단 · 수정 가능" : "업무 영향에 맞게 골라주세요"}</span>
          {mode === "ai" && sug?.urgency_reason && <span className="fnote">{sug.urgency_reason}</span>}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {URGENCIES.map((u) => {
            const on = form.priority === u.v;
            return <button key={u.v} onClick={() => setField("priority", u.v)}
              style={{ padding: "7px 18px", borderRadius: 7, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
                fontWeight: on ? 700 : 500, border: `1px solid ${on ? "var(--red)" : "var(--line)"}`,
                background: on ? "var(--red)" : "#fff",
                color: on ? "#fff" : u.v === "urgent" ? "var(--red)" : "var(--ink-3)" }}>{u.label}</button>;
          })}
        </div>
      </div>

      {/* 직접 입력: 요청 내용이 폼 안에 들어간다 */}
      {mode === "manual" && (
        <div>
          <div className="flabel">요청 내용 <span className="fnote">담당자가 이 내용을 그대로 봅니다</span>
            <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted-2)", fontVariantNumeric: "tabular-nums" }}>{text.length} / 500</span>
          </div>
          <textarea className="textarea" value={text} onChange={(e) => setText(e.target.value.slice(0, 500))}
            placeholder="언제부터, 어디서, 어떤 증상인지 적어주세요." style={{ minHeight: 96 }} />
        </div>
      )}

      <div>
        <div className="flabel">한 줄 요약{" "}
          <span className="pillbadge" style={{ background: "var(--red-soft)", color: "var(--red)" }}>AI 자동 생성</span>
          <span className="fnote">요청 내용을 분석해 목록에 쓰입니다</span></div>
        <div className="input" style={{
          background: form.summary ? "var(--red-soft)" : "var(--bg-2)",
          borderColor: form.summary ? "var(--red-line)" : "var(--line)",
          color: form.summary ? "var(--ink-2)" : "var(--muted-2)" }}>
          {form.summary || (loading ? "요약을 만드는 중…" : "요청 내용을 입력하면 자동으로 생성됩니다")}
        </div>
      </div>

      {err && (
        <div style={{ padding: "9px 13px", borderRadius: 8, fontSize: 12.5,
          background: "var(--red-soft)", border: "1px solid var(--red-line)", color: "var(--red-dark)" }}>{err}</div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 10, borderTop: "1px solid var(--line-2)", paddingTop: 14 }}>
        <span className="sm2">등록하면 {fDept}의 처리할 요청 목록에 접수되고, 진행 상황은 내 요청에서 확인할 수 있습니다</span>
        <button className="btn sm" style={{ marginLeft: "auto" }} onClick={clearAll}>지우기</button>
        <button className="btn prim sm" onClick={submit} disabled={busy}>{busy ? "등록 중…" : "요청 등록"}</button>
      </div>
    </div>
  );

  return (
    <div>
      <h1 className="h1">무엇을 도와드릴까요?</h1>
      <p className="sub">{mode === "ai"
        ? "한 줄만 적으면 AI가 제목·카테고리·긴급도를 자동으로 채웁니다. 버튼을 누를 필요가 없습니다."
        : "제목·카테고리·긴급도를 직접 고르고 내용을 적으면, 한 줄 요약만 AI가 만듭니다."}</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,280px),1fr))", gap: 14, margin: "16px 0 18px", maxWidth: 780 }}>
        {MODES.map((m) => {
          const on = mode === m.v;
          return (
            <button key={m.v} onClick={() => switchMode(m.v)}
              style={{ display: "flex", gap: 12, alignItems: "flex-start", textAlign: "left", cursor: "pointer",
                border: `1px solid ${on ? "var(--red)" : "var(--line)"}`, background: on ? "var(--red-soft)" : "#fff",
                borderRadius: 10, padding: "14px 16px", fontFamily: "inherit" }}>
              <ModeIcon mode={m.v} on={on} />
              <span>
                <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: on ? "var(--red)" : "var(--ink)" }}>{m.label}</span>
                <span style={{ display: "block", fontSize: 12, color: "var(--muted)", marginTop: 3 }}>{m.desc}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="cols">
        <div style={{ display: "grid", gap: 14 }}>
          {/* AI 모드에서만 상단 한 줄 입력 카드 */}
          {mode === "ai" && (
            <div className="card">
              <div style={{ padding: "14px 18px 0", fontSize: 12.5, fontWeight: 700 }}>요청 내용 한 줄</div>
              <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 500))}
                placeholder="예) 3층 회의실 프로젝터가 안 켜져요. 오후 3시 발표 전에 봐주세요."
                style={{ width: "100%", border: "none", outline: "none", resize: "none", minHeight: 78,
                  padding: "10px 18px 6px", fontSize: 13.5, fontFamily: "inherit", lineHeight: 1.6, color: "var(--ink)" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 18px 13px", borderTop: "1px solid var(--line-2)", flexWrap: "wrap" }}>
                <span className="sm2">예시</span>
                {EXAMPLES.map((ex) => <button key={ex.label} className="chip" onClick={() => { setText(ex.text); analyze(ex.text); }}>{ex.label}</button>)}
                <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                  {loading && <span className="aistat"><i />AI가 읽는 중</span>}
                  <span style={{ fontSize: 12, color: "var(--muted-2)", fontVariantNumeric: "tabular-nums" }}>{text.length} / 500</span>
                </span>
              </div>
            </div>
          )}

          {mode === "ai" && !sug && text.trim().length > 0 && text.trim().length < MIN_CHARS && (
            <p className="sm2" style={{ margin: 0 }}>조금 더 적어주시면 AI가 항목을 채웁니다</p>
          )}

          {/* 폼 카드 — AI는 제안 후, 직접 입력은 즉시 */}
          {(mode === "manual" || sug) && (
            <div className="card" style={{ overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 18px",
                background: mode === "ai" ? "var(--red-soft)" : "var(--bg-2)",
                borderBottom: `1px solid ${mode === "ai" ? "var(--red-line)" : "var(--line-2)"}` }}>
                <span className="pillbadge" style={{
                  background: mode === "ai" ? "var(--red)" : "var(--ink-2)", color: "#fff" }}>
                  {mode === "ai" ? "AI 제안" : "직접 입력"}</span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)" }}>
                  {mode === "ai"
                    ? loading ? "내용이 바뀌어 다시 분석하는 중입니다" : "AI가 제안했습니다. 확인 후 수정하세요"
                    : "필요한 항목을 직접 채워주세요"}</span>
                {mode === "ai" && <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--muted)" }}>
                  {loading ? "" : sug?.source === "ollama" ? "로컬 AI 분석" : "입력 내용에서 추출"}</span>}
              </div>
              {FormBody}
            </div>
          )}
        </div>

        <aside className="card side">
          <div style={{ padding: "14px 16px 11px", borderBottom: "1px solid var(--line-2)" }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>비슷한 요청이 있어요</div>
            <div className="sm2" style={{ marginTop: 3, lineHeight: 1.5 }}>참여하면 중복 접수 대신 같은 요청의 참여자로 기록됩니다</div>
            {loading && <span className="aistat" style={{ marginTop: 7 }}><i />비슷한 요청을 찾는 중</span>}
          </div>
          <div style={{ padding: 14 }}>
            {similar.length === 0 ? (
              <p className="sm2" style={{ textAlign: "center", padding: "26px 0", lineHeight: 1.7, margin: 0 }}>
                {text.trim() ? <>입력한 내용과 비슷한<br />기존 요청이 없습니다</>
                             : <>요청 내용을 적으면<br />비슷한 요청을 자동으로 찾습니다</>}</p>
            ) : similar.map((s) => (
              <div key={s.id} style={{ borderBottom: "1px solid var(--line-2)", paddingBottom: 12, marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span className="code">{code(s.id)}</span><StatusBadge s={s.status} />
                  <span className="sm2" style={{ marginLeft: "auto" }}>유사도 {s.score}%</span>
                </div>
                <div className="tt" style={{ margin: "7px 0 4px" }}>{s.title}</div>
                <div className="sm2">담당 {s.assigneeName ?? "미배정"} · 참여자 {s.followerCount}명</div>
                <button className="btn sm" style={{ width: "100%", marginTop: 9 }}
                  disabled={joined.includes(s.id)} onClick={() => join(s.id)}>
                  {joined.includes(s.id) ? "참여 중" : "같은 문제예요, 참여하기"}</button>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
