"use client";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { api, categoryLabel, statusLabel, priorityLabel } from "@/lib/ui";
import { StatusBadge, PriorityBadge } from "@/components/Badges";
import Modal, { Field } from "@/components/Modal";
import { SEED_USERS, deptToHandlers } from "@/lib/domain";

const FLOW = ["SUBMITTED", "IN_PROGRESS", "RESOLVED", "CLOSED"];

export default function DetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [d, setD] = useState<any>(null);
  const [modal, setModal] = useState<any>(null);
  const [comment, setComment] = useState("");
  const router = useRouter();

  async function load() { try { setD(await api(`/api/requests/${id}`)); } catch (e: any) { alert(e.message); } }
  useEffect(() => { load(); }, [id]);
  useEffect(() => {
    const h = () => load();
    window.addEventListener("user-changed", h);
    return () => window.removeEventListener("user-changed", h);
  }, [id]);

  if (!d) return <p className="muted" style={{ padding: 40 }}>불러오는 중…</p>;

  const members = (deptToHandlers[d.department] ?? []).map((uid: string) => {
    const u = SEED_USERS.find((s) => s.id === uid)!;
    return { value: u.id, label: `${u.name} (${u.department})` };
  });

  // 액션 → 모달 필드 정의 (설계서 §7 모달 표)
  function openAction(a: any) {
    const need = a.needs ?? [];
    if (a.action === "assign_self") return run("assign", {});
    if (need.length === 0) return run("transition", { action: a.action });
    const fields: Field[] = [];
    if (need.includes("reason")) fields.push({ key: "reason", label: a.reasonLabel ?? "사유", type: "textarea", required: true });
    if (need.includes("result")) fields.push({ key: "result", label: "처리 내역", type: "textarea", required: true, placeholder: "어떻게 처리했는지 요청자가 알 수 있게 적어주세요" });
    if (need.includes("resumeDate")) fields.push({ key: "resumeDate", label: "예상 재개일", type: "date" });
    if (need.includes("member")) fields.push({ key: "toUserId", label: "새 담당자", type: "select", required: true, options: members });
    if (a.action === "reject") fields.push({ key: "duplicateOfId", label: "원본 요청 ID (중복인 경우)", type: "text", placeholder: "예: 7" });
    setModal({ title: a.label, fields, submitLabel: a.label, action: a.action });
  }

  async function run(kind: "assign" | "transition", body: any) {
    try {
      const path = kind === "assign" ? `/api/requests/${id}/assign` : `/api/requests/${id}/transition`;
      setD(await api(path, { method: "POST", body: JSON.stringify(body) }));
      setModal(null);
    } catch (e: any) { throw e; }
  }

  async function submitModal(v: Record<string, string>) {
    if (modal.action === "assign_member" || modal.action === "reassign") return run("assign", { toUserId: v.toUserId });
    return run("transition", { action: modal.action, ...v });
  }

  async function sendComment() {
    if (!comment.trim()) return;
    try { setD(await api(`/api/requests/${id}/comments`, { method: "POST", body: JSON.stringify({ body: comment }) })); setComment(""); }
    catch (e: any) { alert(e.message); }
  }
  async function follow() {
    try { setD(await api(`/api/requests/${id}/follow`, { method: "POST", body: JSON.stringify({ via: "detail" }) })); }
    catch (e: any) { alert(e.message); }
  }

  const fmt = (x: string) => new Date(x).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  const tlText = (e: any) => {
    const p = e.payload;
    switch (e.type) {
      case "CREATED": return `요청을 등록했습니다`;
      case "ASSIGNED": return p.by === "self" ? `담당을 맡았습니다` : `담당자를 변경했습니다`;
      case "STATUS_CHANGED": {
        const base = `${statusLabel(p.from)} → ${statusLabel(p.to)}`;
        if (p.result) return `${base} · 처리 내역: ${p.result}`;
        if (p.reason) return `${base} · 사유: ${p.reason}${p.resume_date ? ` (예상 재개 ${p.resume_date})` : ""}`;
        return base;
      }
      case "COMMENTED": return p.body;
      case "FOLLOWED": return `요청에 참여했습니다${p.via === "duplicate" ? " (중복 반려로 자동 참여)" : ""}`;
      case "AI_SUGGESTED": return `AI가 제목·카테고리·긴급도를 제안했습니다`;
      case "PRIORITY_CHANGED": return `긴급도 ${priorityLabel(p.from)} → ${priorityLabel(p.to)}`;
      default: return e.type;
    }
  };

  return (
    <div>
      <button className="btn sm" onClick={() => router.back()} style={{ marginBottom: 12 }}>← 뒤로</button>

      {/* 헤더 */}
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <span className="muted" style={{ fontFamily: "monospace" }}>#{d.id}</span>
          <StatusBadge s={d.status} /><PriorityBadge p={d.priority} />
          <span className="muted" style={{ fontSize: 12.5 }}>{categoryLabel(d.category)} · {d.department}</span>
          <span className="muted" style={{ fontSize: 12.5 }}>· 등록 {fmt(d.createdAt)}</span>
        </div>
        <h1 style={{ fontSize: 20, margin: "0 0 10px" }}>{d.title}</h1>
        <div className="muted" style={{ fontSize: 13 }}>
          요청자 {d.requester.name} · 담당 {d.assignee?.name ?? "미배정"} · 참여 {d.followers.length + 1}명
        </div>

        {/* 상태 흐름 */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "14px 0 0", flexWrap: "wrap" }}>
          {FLOW.map((s, i) => {
            const active = FLOW.indexOf(d.status) >= i && !["REJECTED"].includes(d.status);
            return <span key={s} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: active ? 600 : 400, color: active ? "var(--accent)" : "var(--muted)" }}>{statusLabel(s)}</span>
              {i < FLOW.length - 1 && <span className="muted">→</span>}
            </span>;
          })}
          {d.status === "ON_HOLD" && <span className="badge" style={{ marginLeft: 8, color: "var(--hold)", background: "color-mix(in srgb,var(--hold) 12%,transparent)" }}>보류 중</span>}
          {d.status === "REJECTED" && <span className="badge" style={{ marginLeft: 8, color: "var(--reject)", background: "color-mix(in srgb,var(--reject) 12%,transparent)" }}>반려됨</span>}
        </div>

        {/* 액션 */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
          {d.allowedActions.map((a: any) => (
            <button key={a.action + a.label} className={`btn ${a.action === "resolve" || a.action === "close" || a.action === "assign_self" ? "prim" : ""} ${a.action === "reject" ? "danger" : ""}`}
              onClick={() => openAction(a)}>{a.label}</button>
          ))}
          {d.canFollow && <button className="btn" onClick={follow}>나도 참여</button>}
          {d.status === "CLOSED" && <span className="muted" style={{ fontSize: 13 }}>종료된 요청입니다.</span>}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 300px", gap: 16, alignItems: "start" }}>
        <div style={{ display: "grid", gap: 16 }}>
          {/* 처리 내역 / 반려 사유 / 보류 강조 */}
          {d.result && <div className="card" style={{ padding: 16, borderLeft: "3px solid var(--done)" }}>
            <strong style={{ fontSize: 13.5, color: "var(--done)" }}>✅ 처리 내역</strong>
            <p style={{ margin: "7px 0 0", fontSize: 13.5, lineHeight: 1.7 }}>{d.result}</p></div>}
          {d.rejectReason && <div className="card" style={{ padding: 16, borderLeft: "3px solid var(--reject)" }}>
            <strong style={{ fontSize: 13.5, color: "var(--reject)" }}>⛔ 반려 사유</strong>
            <p style={{ margin: "7px 0 0", fontSize: 13.5, lineHeight: 1.7 }}>{d.rejectReason}</p>
            {d.duplicateOfId && <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>원본 요청 #{d.duplicateOfId}</p>}</div>}
          {d.holdReason && <div className="card" style={{ padding: 16, borderLeft: "3px solid var(--hold)" }}>
            <strong style={{ fontSize: 13.5, color: "var(--hold)" }}>⏸ 보류 사유</strong>
            <p style={{ margin: "7px 0 0", fontSize: 13.5, lineHeight: 1.7 }}>{d.holdReason}
              {d.holdResumeDate && <span className="muted"> · 예상 재개 {d.holdResumeDate}</span>}</p></div>}

          {/* 요청 원문 */}
          <div className="card" style={{ padding: 18 }}>
            <strong style={{ fontSize: 13.5 }}>요청 내용</strong>
            <p style={{ margin: "8px 0 0", fontSize: 13.5, lineHeight: 1.75, whiteSpace: "pre-wrap" }}>{d.description}</p>
            {d.summary && <p className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>한 줄 요약: {d.summary}</p>}
          </div>

          {/* AI 제안 vs 최종 값 */}
          {d.aiSuggestion && <div className="card" style={{ padding: 18 }}>
            <strong style={{ fontSize: 13.5 }}>AI 제안 vs 최종 값</strong>
            <div style={{ overflowX: "auto", marginTop: 8 }}>
              <table><thead><tr><th>항목</th><th>AI 제안</th><th>최종</th></tr></thead><tbody>
                <tr><td>제목</td><td className="muted">{d.aiSuggestion.title || "—"}</td><td>{d.title}</td></tr>
                <tr><td>카테고리</td><td className="muted">{categoryLabel(d.aiSuggestion.category) || "—"}</td><td>{categoryLabel(d.category)}</td></tr>
                <tr><td>긴급도</td><td className="muted">{priorityLabel(d.aiSuggestion.urgency) || "—"}</td><td>{priorityLabel(d.priority)}</td></tr>
              </tbody></table>
            </div>
          </div>}

          {/* 타임라인 */}
          <div className="card" style={{ padding: 18 }}>
            <strong style={{ fontSize: 13.5 }}>처리 기록</strong>
            <div className="timeline" style={{ marginTop: 14 }}>
              {d.timeline.map((e: any) => (
                <div className="tl-item" key={e.id}>
                  <div style={{ fontSize: 13.5, lineHeight: 1.6 }}>
                    <strong>{e.actor}</strong> <span className="dim">{tlText(e)}</span>
                  </div>
                  <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{fmt(e.at)}</div>
                </div>
              ))}
            </div>
            {d.canComment && <div style={{ marginTop: 12 }}>
              <textarea className="textarea" value={comment} onChange={(e) => setComment(e.target.value)}
                placeholder="코멘트를 남기면 요청자·담당자·참여자가 내 요청 화면에서 확인할 수 있습니다" style={{ minHeight: 64 }} />
              <button className="btn sm prim" style={{ marginTop: 8 }} onClick={sendComment}>코멘트 남기기</button>
            </div>}
          </div>
        </div>

        <aside style={{ display: "grid", gap: 14, position: "sticky", top: 72 }}>
          <div className="card" style={{ padding: 16 }}>
            <strong style={{ fontSize: 13 }}>처리 정보</strong>
            <dl style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "6px 10px", margin: "10px 0 0", fontSize: 12.5 }}>
              <dt className="muted">접수</dt><dd style={{ margin: 0 }}>{fmt(d.createdAt)}</dd>
              <dt className="muted">마지막 업데이트</dt><dd style={{ margin: 0 }}>{fmt(d.updatedAt)}</dd>
              <dt className="muted">기록 수</dt><dd style={{ margin: 0 }}>{d.timeline.length}건</dd>
              <dt className="muted">현재 상태</dt><dd style={{ margin: 0 }}>{statusLabel(d.status)}</dd>
            </dl>
          </div>
          <div className="card" style={{ padding: 16 }}>
            <strong style={{ fontSize: 13 }}>요청자 · 참여자</strong>
            <div style={{ display: "grid", gap: 6, marginTop: 10, fontSize: 13 }}>
              <div>{d.requester.name} <span className="muted" style={{ fontSize: 11.5 }}>요청자</span></div>
              {d.followers.map((f: any) => <div key={f.id}>{f.name} <span className="muted" style={{ fontSize: 11.5 }}>참여</span></div>)}
            </div>
          </div>
        </aside>
      </div>

      {modal && <Modal title={modal.title} fields={modal.fields} submitLabel={modal.submitLabel}
        onSubmit={submitModal} onClose={() => setModal(null)} />}
    </div>
  );
}
