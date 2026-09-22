"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, categoryLabel, code, statusLabel } from "@/lib/ui";
import { CATEGORIES, PRIORITY, deptOfCategory } from "@/lib/domain";
import { StatusBadge } from "@/components/Badges";

type Mode = "ai" | "manual";
const EXAMPLES = [
  { label: "프로젝터 고장", text: "3층 회의실 프로젝터가 안 켜져요. 오후 3시 발표 전에 봐주세요" },
  { label: "VPN 계정", text: "VPN 계정이 잠겨서 로그인이 안 됩니다" },
  { label: "에어컨", text: "4층 사무실 에어컨 냉방이 거의 안 됩니다" },
];
const URGENCIES: { v: string; label: string }[] = [
  { v: "low", label: "낮음" }, { v: "normal", label: "보통" },
  { v: "high", label: "높음" }, { v: "urgent", label: "긴급" },
];

export default function Page() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("ai");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [sug, setSug] = useState<any>(null);
  const [similar, setSimilar] = useState<any[]>([]);
  const [joined, setJoined] = useState<number[]>([]);
  const [form, setForm] = useState({ title: "", category: "", priority: "normal", summary: "" });
  const [busy, setBusy] = useState(false);

  async function analyze(t?: string) {
    const body = (t ?? text).trim();
    if (!body) return;
    setLoading(true);
    try {
      const d = await api("/api/ai/analyze", { method: "POST", body: JSON.stringify({ text: body, mode }) });
      setSug(d.suggestion); setSimilar(d.similar);
      setForm({
        title: d.suggestion.title || "", category: d.suggestion.category || CATEGORIES[0].key,
        priority: d.suggestion.urgency || "normal", summary: d.suggestion.summary || "",
      });
    } catch (e: any) { alert(e.message); } finally { setLoading(false); }
  }
  function pickExample(ex: typeof EXAMPLES[number]) { setText(ex.text); analyze(ex.text); }
  function clearAll() { setText(""); setSug(null); setSimilar([]); }

  async function submit() {
    if (!form.title.trim() || !form.category) { alert("제목과 카테고리를 확인하세요"); return; }
    setBusy(true);
    try {
      const accepted = sug ? { title: form.title === sug.title, category: form.category === sug.category, urgency: form.priority === sug.urgency } : {};
      const d = await api("/api/requests", { method: "POST", body: JSON.stringify({
        title: form.title, description: text, category: form.category, priority: form.priority,
        summary: form.summary, mode, aiSuggestion: sug, acceptedFields: accepted }) });
      router.push(`/r/${d.id}`);
    } catch (e: any) { alert(e.message); setBusy(false); }
  }
  async function join(id: number) {
    try { await api(`/api/requests/${id}/follow`, { method: "POST", body: JSON.stringify({ via: "register" }) });
      setJoined([...joined, id]);
    } catch (e: any) { alert(e.message); }
  }

  const fDept = form.category ? deptOfCategory(form.category) : "—";
  const MODES = [
    { v: "ai" as Mode, label: "AI 자동 작성", desc: "한 줄만 적으면 제목·카테고리·긴급도까지 채워집니다" },
    { v: "manual" as Mode, label: "직접 입력", desc: "항목을 직접 고르고, 한 줄 요약만 AI가 만듭니다" },
  ];

  return (
    <div>
      <h1 className="h1">무엇을 도와드릴까요?</h1>
      <p className="sub">{mode === "ai"
        ? "한 줄로 적어주시면 AI가 제목·카테고리·긴급도를 채워 담당 부서로 보냅니다."
        : "항목을 직접 고르고 내용을 적어주세요. 한 줄 요약만 AI가 만듭니다."}</p>

      {/* 입구 카드 2개 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 14, margin: "16px 0 18px", maxWidth: 780 }}>
        {MODES.map((m) => {
          const on = mode === m.v;
          return (
            <button key={m.v} onClick={() => { setMode(m.v); setSug(null); }}
              style={{ display: "flex", gap: 12, alignItems: "flex-start", textAlign: "left", cursor: "pointer",
                border: `1px solid ${on ? "var(--red)" : "var(--line)"}`, background: on ? "var(--red-soft)" : "#fff",
                borderRadius: 10, padding: "14px 16px", fontFamily: "inherit" }}>
              <span style={{ width: 26, height: 26, borderRadius: 7, flex: "none", display: "grid", placeItems: "center",
                background: on ? "#fff" : "var(--line-3)" }}>
                {on ? <span style={{ width: 11, height: 11, background: "var(--red)", transform: "rotate(45deg)", borderRadius: 2, display: "block" }} />
                    : <span style={{ display: "grid", gap: 2 }}>
                        {[10, 8, 6].map((w, i) => <i key={i} style={{ width: w, height: 1.6, background: "var(--muted-2)", display: "block", borderRadius: 1 }} />)}
                      </span>}
              </span>
              <span>
                <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: on ? "var(--red)" : "var(--ink)" }}>{m.label}</span>
                <span style={{ display: "block", fontSize: 12, color: "var(--muted)", marginTop: 3 }}>{m.desc}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 300px", gap: 16, alignItems: "start" }}>
        <div style={{ display: "grid", gap: 14 }}>
          {/* 입력 카드 */}
          <div className="card">
            <div style={{ padding: "14px 18px 0", fontSize: 12.5, fontWeight: 700 }}>
              {mode === "ai" ? "요청 내용 한 줄" : "요청 내용"}
            </div>
            <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 500))}
              onBlur={() => text.trim() && !sug && analyze()}
              placeholder="예) 3층 회의실 프로젝터가 안 켜져요. 오후 3시 발표 전에 봐주세요."
              style={{ width: "100%", border: "none", outline: "none", resize: "none", minHeight: 78,
                padding: "10px 18px 6px", fontSize: 13.5, fontFamily: "inherit", lineHeight: 1.6, color: "var(--ink)" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 18px 13px", borderTop: "1px solid var(--line-2)", flexWrap: "wrap" }}>
              <span className="sm2">예시</span>
              {EXAMPLES.map((ex) => <button key={ex.label} className="chip" onClick={() => pickExample(ex)}>{ex.label}</button>)}
              <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted-2)", fontVariantNumeric: "tabular-nums" }}>{text.length} / 500</span>
            </div>
          </div>

          {!sug && text.trim() && (
            <button className="btn prim" style={{ justifySelf: "start" }} onClick={() => analyze()} disabled={loading}>
              {loading ? "분석 중…" : mode === "ai" ? "AI 제안 받기" : "요약 만들기"}</button>
          )}

          {/* AI 제안 카드 */}
          {sug && (
            <div className="card" style={{ overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 18px",
                background: "var(--red-soft)", borderBottom: "1px solid var(--red-line)" }}>
                <span className="pillbadge" style={{ background: "var(--red)", color: "#fff" }}>
                  {mode === "ai" ? "AI 제안" : "입력 확인"}</span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)" }}>
                  {mode === "ai" ? "AI가 제안했습니다. 확인 후 수정하세요" : "항목을 직접 채워주세요"}</span>
                <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--muted)" }}>
                  {sug.source === "ollama" ? "로컬 AI 분석" : "입력 내용에서 추출"}</span>
              </div>
              <div style={{ padding: 18, display: "grid", gap: 15 }}>
                <div>
                  <div className="flabel">제목 <span className="fnote">AI 작성 · 수정 가능</span></div>
                  <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div>
                    <div className="flabel">카테고리 <span className="fnote">{mode === "ai" ? "AI 분류" : ""}</span></div>
                    <select className="select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                      {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <div className="flabel">담당 부서</div>
                    <div className="input" style={{ background: "var(--bg-2)", display: "flex", alignItems: "center", gap: 8 }}>
                      <b style={{ fontSize: 13 }}>{fDept}</b>
                      <span className="fnote">카테고리에 따라 자동 배정</span>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="flabel">긴급도 <span className="fnote">{mode === "ai" ? "AI 판단 · 수정 가능" : ""}</span>
                    {sug.urgency_reason && <span className="fnote" style={{ marginLeft: 2 }}>{sug.urgency_reason}</span>}</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {URGENCIES.map((u) => {
                      const on = form.priority === u.v;
                      const isU = u.v === "urgent";
                      return <button key={u.v} onClick={() => setForm({ ...form, priority: u.v })}
                        style={{ padding: "7px 18px", borderRadius: 7, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
                          fontWeight: on ? 700 : 500,
                          border: `1px solid ${on ? "var(--red)" : "var(--line)"}`,
                          background: on ? "var(--red)" : "#fff",
                          color: on ? "#fff" : isU ? "var(--red)" : "var(--ink-3)" }}>{u.label}</button>;
                    })}
                  </div>
                </div>
                <div>
                  <div className="flabel">한 줄 요약 <span className="pillbadge" style={{ background: "var(--red-soft)", color: "var(--red)" }}>AI 자동 생성</span>
                    <span className="fnote">요청 내용을 분석해 목록에 쓰입니다</span></div>
                  <div className="input" style={{ background: "var(--red-soft)", borderColor: "var(--red-line)", color: "var(--ink-2)" }}>
                    {form.summary || "—"}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, borderTop: "1px solid var(--line-2)", paddingTop: 14 }}>
                  <span className="sm2">등록하면 {fDept}의 처리할 요청 목록에 접수되고, 진행 상황은 내 요청에서 확인할 수 있습니다</span>
                  <button className="btn sm" style={{ marginLeft: "auto" }} onClick={clearAll}>지우기</button>
                  <button className="btn prim sm" onClick={submit} disabled={busy}>{busy ? "등록 중…" : "요청 등록"}</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 유사 요청 패널 */}
        <aside className="card" style={{ position: "sticky", top: 64 }}>
          <div style={{ padding: "14px 16px 11px", borderBottom: "1px solid var(--line-2)" }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>비슷한 요청이 있어요</div>
            <div className="sm2" style={{ marginTop: 3, lineHeight: 1.5 }}>참여하면 중복 접수 대신 같은 요청의 참여자로 기록됩니다</div>
          </div>
          <div style={{ padding: 14 }}>
            {similar.length === 0 ? (
              <p className="sm2" style={{ textAlign: "center", padding: "26px 0", lineHeight: 1.7, margin: 0 }}>
                입력한 내용과 비슷한<br />기존 요청이 없습니다</p>
            ) : similar.map((s) => (
              <div key={s.id} style={{ borderBottom: "1px solid var(--line-2)", paddingBottom: 12, marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span className="code">{code(s.id)}</span>
                  <StatusBadge s={s.status} />
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
