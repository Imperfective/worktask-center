"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, categoryLabel } from "@/lib/ui";
import { CATEGORIES, PRIORITY, deptOfCategory } from "@/lib/domain";
import { StatusBadge, PriorityBadge } from "@/components/Badges";

type Mode = null | "ai" | "manual";
const EXAMPLES = ["3층 회의실 프로젝터가 안 켜져요. 오후 3시 발표 전에 봐주세요",
  "그룹웨어 접속이 안 됩니다", "노트북 배터리가 너무 빨리 닳아요", "복합기 토너 교체 부탁드려요"];

export default function RequestPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [sug, setSug] = useState<any>(null);
  const [similar, setSimilar] = useState<any[]>([]);
  // 확정 폼 값
  const [form, setForm] = useState({ title: "", category: "", priority: "normal", summary: "" });
  const [busy, setBusy] = useState(false);

  async function analyze() {
    if (!text.trim()) return;
    setLoading(true); setSug(null);
    try {
      const d = await api("/api/ai/analyze", { method: "POST", body: JSON.stringify({ text, mode }) });
      setSug(d.suggestion); setSimilar(d.similar);
      setForm({
        title: d.suggestion.title || "", category: d.suggestion.category || "",
        priority: d.suggestion.urgency || "normal", summary: d.suggestion.summary || "",
      });
    } catch (e: any) { alert(e.message); } finally { setLoading(false); }
  }

  async function submit() {
    if (!form.title.trim() || !form.category) { alert("제목과 카테고리를 확인하세요"); return; }
    setBusy(true);
    try {
      const accepted = sug ? {
        title: form.title === sug.title, category: form.category === sug.category, urgency: form.priority === sug.urgency,
      } : {};
      const d = await api("/api/requests", { method: "POST", body: JSON.stringify({
        title: form.title, description: text, category: form.category, priority: form.priority,
        summary: form.summary, mode, aiSuggestion: sug, acceptedFields: accepted,
      })});
      router.push(`/r/${d.id}`);
    } catch (e: any) { alert(e.message); setBusy(false); }
  }

  async function joinSimilar(id: number) {
    try { await api(`/api/requests/${id}/follow`, { method: "POST", body: JSON.stringify({ via: "register" }) });
      router.push(`/r/${id}`);
    } catch (e: any) { alert(e.message); }
  }

  // 입구 선택 화면
  if (!mode) return (
    <div>
      <h1 style={{ fontSize: 22, margin: "6px 0 4px" }}>무엇을 도와드릴까요?</h1>
      <p className="muted" style={{ margin: "0 0 22px" }}>요청을 등록하면 접수 번호가 부여되고, 담당 부서 큐에 바로 올라갑니다.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16 }}>
        <button className="card" onClick={() => setMode("ai")} style={{ textAlign: "left", padding: 22, cursor: "pointer" }}>
          <div style={{ fontSize: 22, marginBottom: 8 }}>✨</div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>AI 자동 작성</div>
          <div className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>겪고 있는 상황을 한 줄로 적으면 제목·카테고리·긴급도를 자동으로 제안합니다. 확인·수정 후 등록하세요.</div>
        </button>
        <button className="card" onClick={() => setMode("manual")} style={{ textAlign: "left", padding: 22, cursor: "pointer" }}>
          <div style={{ fontSize: 22, marginBottom: 8 }}>✍️</div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>직접 입력</div>
          <div className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>항목을 직접 고르고 싶다면 이쪽. 제목·카테고리·긴급도를 스스로 정하고, 한 줄 요약만 자동으로 만듭니다.</div>
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 320px", gap: 18, alignItems: "start" }}>
      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button className="btn sm" onClick={() => { setMode(null); setSug(null); setText(""); }}>← 뒤로</button>
          <h1 style={{ fontSize: 19, margin: 0 }}>{mode === "ai" ? "AI 자동 작성" : "직접 입력"}</h1>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <label className="label">{mode === "ai" ? "겪고 있는 상황을 한 줄로 적어주세요" : "요청 내용"}</label>
          <textarea className="textarea" value={text} onChange={(e) => setText(e.target.value)}
            placeholder="예: 3층 회의실 프로젝터가 안 켜져요. 오후 3시 발표 전에 봐주세요" style={{ minHeight: 90 }} />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "10px 0 0" }}>
            {EXAMPLES.map((ex) => <button key={ex} className="chip" onClick={() => setText(ex)}>{ex.slice(0, 22)}…</button>)}
          </div>
          <div style={{ marginTop: 12 }}>
            <button className="btn prim" onClick={analyze} disabled={loading || !text.trim()}>
              {loading ? "분석 중…" : mode === "ai" ? "✨ AI 제안 받기" : "요약 만들기"}
            </button>
          </div>
        </div>

        {sug && (
          <div className="card" style={{ padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <strong style={{ fontSize: 14.5 }}>{mode === "ai" ? "AI 제안" : "입력 확인"}</strong>
              <span className="badge" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                {sug.source === "ollama" ? "AI 분류" : "규칙 기반"}
              </span>
              <span className="muted" style={{ fontSize: 12 }}>수정할 수 있습니다</span>
            </div>
            <div style={{ display: "grid", gap: 12, marginTop: 10 }}>
              <div><label className="label">제목</label>
                <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label className="label">카테고리 → 담당 부서</label>
                  <select className="select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    <option value="">선택</option>
                    {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label} ({c.dept})</option>)}
                  </select></div>
                <div><label className="label">긴급도</label>
                  <select className="select" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                    {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select></div>
              </div>
              {sug.urgency_reason && <div className="muted" style={{ fontSize: 12.5, background: "var(--line-2)", padding: "8px 11px", borderRadius: 7 }}>
                💡 {sug.urgency_reason}</div>}
              <div><label className="label">한 줄 요약 <span className="muted">(읽기 전용)</span></label>
                <input className="input" value={form.summary} readOnly style={{ background: "var(--line-2)", color: "var(--ink-2)" }} /></div>
              <div><button className="btn prim" onClick={submit} disabled={busy} style={{ justifySelf: "start" }}>{busy ? "등록 중…" : "요청 등록"}</button></div>
            </div>
          </div>
        )}
      </div>

      <aside className="card" style={{ padding: 16, position: "sticky", top: 72 }}>
        <strong style={{ fontSize: 14 }}>비슷한 요청이 있어요</strong>
        <p className="muted" style={{ fontSize: 12, margin: "4px 0 12px", lineHeight: 1.55 }}>
          같은 문제라면 새로 만들지 말고 기존 요청에 참여하세요.</p>
        {!sug ? <p className="muted" style={{ fontSize: 12.5 }}>내용을 입력하면 유사한 열린 요청을 보여드립니다.</p>
          : similar.length === 0 ? <p className="muted" style={{ fontSize: 12.5 }}>비슷한 요청이 없습니다. 새로 등록하세요.</p>
          : <div style={{ display: "grid", gap: 10 }}>
            {similar.map((s) => (
              <div key={s.id} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 11 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>#{s.id} {s.title}</span>
                  <span className="badge" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>{s.score}%</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "7px 0 9px", flexWrap: "wrap" }}>
                  <StatusBadge s={s.status} /><PriorityBadge p={s.priority} />
                  <span className="muted" style={{ fontSize: 11.5 }}>담당 {s.assigneeName ?? "미배정"} · 참여 {s.followerCount}</span>
                </div>
                <button className="btn sm prim" style={{ width: "100%", justifyContent: "center" }} onClick={() => joinSimilar(s.id)}>같은 문제예요, 참여하기</button>
              </div>
            ))}
          </div>}
      </aside>
    </div>
  );
}
