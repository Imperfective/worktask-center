"use client";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, categoryLabel, statusLabel, priorityLabel, code, fmtDate, fmtTime, ST_COLOR } from "@/lib/ui";
import { StatusBadge, Avatar } from "@/components/Badges";
import Modal, { Field } from "@/components/Modal";
import { SEED_USERS, deptToHandlers } from "@/lib/domain";

const FLOW = ["SUBMITTED", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;

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
  if (!d) return <p className="sm2" style={{ padding: 40 }}>불러오는 중…</p>;

  const members = (deptToHandlers[d.department] ?? []).map((uid: string) => {
    const u = SEED_USERS.find((s) => s.id === uid)!;
    return { value: u.id, label: `${u.name} (${u.department})` };
  });

  function openAction(a: any) {
    const need = a.needs ?? [];
    if (a.action === "assign_self") return run("assign", {});
    if (need.length === 0) return run("transition", { action: a.action });
    const fields: Field[] = [];
    if (need.includes("reason")) fields.push({ key: "reason", label: a.reasonLabel ?? "사유", type: "textarea", required: true });
    if (need.includes("result")) fields.push({ key: "result", label: "처리 내역", type: "textarea", required: true, placeholder: "어떻게 처리했는지 요청자가 알 수 있게 적어주세요" });
    if (need.includes("resumeDate")) fields.push({ key: "resumeDate", label: "예상 재개일", type: "date" });
    if (need.includes("member")) fields.push({ key: "toUserId", label: "새 담당자", type: "select", required: true, options: members });
    if (a.action === "reject") fields.push({ key: "duplicateOfId", label: "원본 요청 ID (중복인 경우)", type: "text", placeholder: "예: 8" });
    setModal({ title: a.label, fields, submitLabel: a.label, action: a.action });
  }
  async function run(kind: "assign" | "transition", body: any) {
    const path = kind === "assign" ? `/api/requests/${id}/assign` : `/api/requests/${id}/transition`;
    setD(await api(path, { method: "POST", body: JSON.stringify(body) }));
    setModal(null);
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

  const tl = (e: any) => {
    const p = e.payload;
    switch (e.type) {
      case "CREATED": return { t: "요청 등록", s: `${e.actor}` , c: "var(--muted-2)" };
      case "ASSIGNED": return { t: p.by === "self" ? `담당 지정 — ${e.actor}` : "담당 변경", s: `${e.actor} · 처리할 요청에서 직접 수령`, c: "var(--muted-2)" };
      case "STATUS_CHANGED": {
        const head = p.to === "IN_PROGRESS" && p.from === "ON_HOLD" ? "처리중 재개" : `상태 변경 ${statusLabel(p.from)} → ${statusLabel(p.to)}`;
        const detail = p.result ? `처리 내역: ${p.result}` : p.reason ? `사유: ${p.reason}${p.resume_date ? ` · 예상 재개 ${p.resume_date}` : ""}` : "";
        return { t: head, s: [detail, e.actor].filter(Boolean).join(" · "), c: ST_COLOR[p.to]?.fg ?? "var(--muted-2)" };
      }
      case "COMMENTED": return { t: "코멘트", s: `${p.body} — ${e.actor}`, c: "var(--muted-2)" };
      case "FOLLOWED": return { t: `${e.actor} 님이 같은 문제예요로 참여`, s: p.via === "duplicate" ? "중복 반려로 자동 참여" : "중복 요청 대신 참여로 기록", c: "var(--green)" };
      case "AI_SUGGESTED": return { t: "AI 제안", s: "제목·카테고리·긴급도 제안", c: "var(--muted-2)" };
      default: return { t: e.type, s: e.actor, c: "var(--muted-2)" };
    }
  };
  const ai = d.aiSuggestion;
  const rows = ai ? [
    { k: "카테고리", a: categoryLabel(ai.category), f: categoryLabel(d.category), same: ai.category === d.category },
    { k: "긴급도", a: priorityLabel(ai.urgency), f: priorityLabel(d.priority), same: ai.urgency === d.priority },
  ] : [];

  return (
    <div>
      <div className="sm2" style={{ marginBottom: 12 }}>
        <Link href={d.viewer.role === "handler" ? "/queue" : "/my"} style={{ color: "var(--muted)", textDecoration: "none" }}>
          {d.viewer.role === "handler" ? "처리할 요청" : "내 요청"}</Link> / {code(d.id)}
      </div>

      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11, flexWrap: "wrap" }}>
            <span className="code" style={{ fontSize: 14 }}>{code(d.id)}</span>
            <h1 className="h1" style={{ fontSize: 19 }}>{d.title}</h1>
            <StatusBadge s={d.status} />
          </div>
          <div className="sm2" style={{ marginTop: 7, display: "flex", gap: 14, flexWrap: "wrap" }}>
            <span>담당 <b style={{ color: "var(--ink)" }}>{d.assignee?.name ?? "미배정"}</b> {d.assignee && d.department}</span>
            <span>긴급도 <b style={{ color: d.priority === "urgent" ? "var(--red)" : "var(--ink)" }}>{priorityLabel(d.priority)}</b></span>
            <span>참여자 <b style={{ color: "var(--ink)" }}>{d.followers.length + 1}명</b></span>
            <span>{categoryLabel(d.category)}</span>
            <span>등록 {fmtDate(d.createdAt, true)}</span>
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 7, flexWrap: "wrap" }}>
          {d.allowedActions.map((a: any) => {
            const prim = ["resolve", "close", "assign_self"].includes(a.action);
            const red = a.action === "reject";
            return <button key={a.action + a.label} className={`btn ${prim ? "prim" : red ? "ghost-red" : ""}`} onClick={() => openAction(a)}>{a.label}</button>;
          })}
          {d.canFollow && <button className="btn" onClick={follow}>나도 참여</button>}
        </div>
      </div>
      <p className="sm2" style={{ margin: "12px 0 18px" }}>
        {d.status === "CLOSED" ? "종료된 요청입니다. 더 이상 변경할 수 없습니다."
          : "보류·반려·완료는 사유 또는 처리 내역 입력이 필요합니다. 입력한 내용은 요청자와 참여자에게 그대로 전달되고 타임라인에 남습니다."}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 288px", gap: 16, alignItems: "start" }}>
        <div style={{ display: "grid", gap: 14 }}>
          {/* 강조 박스 */}
          {d.result && <div className="card" style={{ padding: 16, borderColor: "#cdebd9", background: "#f5fcf8" }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--green)" }}>처리 내역</div>
            <div className="sm2" style={{ marginTop: 2 }}>담당자가 등록한 최종 처리 결과입니다</div>
            <p style={{ margin: "9px 0 0", fontSize: 13.5, lineHeight: 1.7 }}>{d.result}</p></div>}
          {d.rejectReason && <div className="card" style={{ padding: 16, borderColor: "var(--red-line)", background: "var(--red-soft)" }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--red)" }}>반려</div>
            <div className="sm2" style={{ marginTop: 2 }}>처리 대상이 아니라고 판단되었습니다</div>
            <p style={{ margin: "9px 0 0", fontSize: 13.5, lineHeight: 1.7 }}>{d.rejectReason}</p>
            {d.duplicateOfId && <p className="sm2" style={{ marginTop: 6 }}>원본 요청 {code(d.duplicateOfId)}</p>}</div>}
          {d.holdReason && <div className="card" style={{ padding: 16, borderColor: "#f6e3c6", background: "var(--amber-soft)" }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--amber-dark)" }}>보류 중</div>
            <p style={{ margin: "7px 0 0", fontSize: 13.5, lineHeight: 1.7 }}>{d.holdReason}
              {d.holdResumeDate && <span className="sm2"> · 예상 재개 {d.holdResumeDate}</span>}</p></div>}

          {/* 요청 원문 + AI 비교 */}
          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 10 }}>요청 원문</div>
            <div style={{ background: "var(--bg-2)", border: "1px solid var(--line-2)", borderRadius: 8, padding: "12px 14px",
              fontSize: 13.5, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{d.description}</div>
            <div className="sm2" style={{ marginTop: 8 }}>{d.requester.name} · {d.requester.department} · {fmtDate(d.createdAt, true)}</div>
            {rows.length > 0 && <>
              <div style={{ fontSize: 12.5, fontWeight: 700, margin: "18px 0 8px" }}>AI 제안 vs 최종 값</div>
              <div style={{ border: "1px solid var(--line-2)", borderRadius: 8, overflow: "hidden" }}>
                <table style={{ fontSize: 12.5 }}>
                  <thead><tr style={{ background: "var(--bg-2)" }}>
                    <th style={{ width: 90 }}>항목</th><th>AI 제안</th><th>최종 값</th><th style={{ width: 110 }}>수정</th></tr></thead>
                  <tbody>{rows.map((r) => (
                    <tr key={r.k}><td className="sm2">{r.k}</td>
                      <td className="sm2">{r.a}</td>
                      <td style={{ fontWeight: 700 }}>{r.f}</td>
                      <td style={{ color: r.same ? "var(--muted-2)" : "var(--red)" }}>{r.same ? "그대로 등록" : "요청자 수정"}</td></tr>))}
                  </tbody></table>
              </div></>}
          </div>

          {/* 타임라인 */}
          <div className="card" style={{ padding: 18 }}>
            <div style={{ display: "flex", alignItems: "baseline" }}>
              <div style={{ fontSize: 12.5, fontWeight: 700 }}>처리 기록</div>
              <span className="sm2" style={{ marginLeft: "auto" }}>최신이 아래 · {d.timeline.length}건</span>
            </div>
            <div className="tl" style={{ marginTop: 12 }}>
              {d.timeline.map((e: any) => { const v = tl(e); return (
                <div className="tlr" key={e.id}>
                  <div className="tlt">{fmtTime(e.at)}</div>
                  <div className="tld"><i style={{ background: v.c }} /></div>
                  <div><div className="tlb">{v.t}</div>{v.s && <div className="tls">{v.s}</div>}</div>
                </div>); })}
            </div>
            {d.canComment && <div style={{ marginTop: 14, borderTop: "1px solid var(--line-2)", paddingTop: 14 }}>
              <div className="sm2" style={{ marginBottom: 7 }}>
                요청자 {d.requester.name} 님과 참여자 {d.followers.length + 1}명이 내 요청에서 확인할 수 있습니다</div>
              <textarea className="textarea" value={comment} onChange={(e) => setComment(e.target.value)}
                placeholder="코멘트를 남겨주세요" style={{ minHeight: 62 }} />
              <button className="btn prim sm" style={{ marginTop: 8 }} onClick={sendComment}>코멘트 등록</button>
            </div>}
          </div>
        </div>

        <aside style={{ display: "grid", gap: 14, position: "sticky", top: 64 }}>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700 }}>요청자 · 참여자 {d.followers.length + 1}명</span>
              {d.canFollow && <button className="btn sm" style={{ marginLeft: "auto" }} onClick={follow}>나도 참여</button>}
            </div>
            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <Avatar name={d.requester.name} />
                <span><b style={{ fontSize: 13 }}>{d.requester.name}</b><br /><span className="sm2">{d.requester.department}</span></span>
                <span className="pillbadge" style={{ marginLeft: "auto", background: "var(--red-soft)", color: "var(--red)" }}>요청자</span>
              </div>
              {d.followers.map((f: any) => (
                <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <Avatar name={f.name} />
                  <span><b style={{ fontSize: 13 }}>{f.name}</b></span>
                  <span className="pillbadge" style={{ marginLeft: "auto", background: "var(--line-3)", color: "var(--muted)" }}>참여</span>
                </div>))}
            </div>
          </div>

          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 11 }}>처리 정보</div>
            {[["접수", fmtDate(d.createdAt, true)], ["마지막 업데이트", fmtDate(d.updatedAt, true)],
              ["기록 수", `${d.timeline.length}건`], ["현재 상태", statusLabel(d.status)]].map(([k, v], i) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "4px 0", fontSize: 12.5 }}>
                <span className="sm2">{k}</span>
                <b style={{ color: i === 3 ? (ST_COLOR[d.status]?.fg ?? "var(--ink)") : "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{v}</b>
              </div>))}
          </div>

          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 11 }}>상태 흐름</div>
            {FLOW.map((s) => {
              const idx = FLOW.indexOf(d.status as any);
              const done = idx >= 0 && FLOW.indexOf(s) <= idx;
              const ev = d.timeline.find((e: any) => e.type === "STATUS_CHANGED" && e.payload.to === s)
                ?? (s === "SUBMITTED" ? d.timeline[0] : null);
              return (
                <div key={s} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 12.5 }}>
                  <i style={{ width: 6, height: 6, borderRadius: "50%", background: done ? (ST_COLOR[s]?.fg ?? "var(--ink)") : "var(--line)" }} />
                  <span style={{ color: done ? "var(--ink)" : "var(--muted-2)", fontWeight: done ? 600 : 400 }}>{statusLabel(s)}</span>
                  {done && ev && <span className="sm2" style={{ marginLeft: "auto", fontVariantNumeric: "tabular-nums" }}>{fmtTime(ev.at)}</span>}
                </div>);
            })}
            {d.status === "REJECTED" && <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 12.5 }}>
              <i style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--red)" }} />
              <span style={{ color: "var(--red)", fontWeight: 600 }}>반려</span></div>}
          </div>
        </aside>
      </div>

      {modal && <Modal title={modal.title} fields={modal.fields} submitLabel={modal.submitLabel}
        onSubmit={submitModal} onClose={() => setModal(null)} />}
    </div>
  );
}
