"use client";
import { useState } from "react";

export interface Field { key: string; label: string; type?: "text" | "textarea" | "date" | "select"; required?: boolean; options?: { value: string; label: string }[]; placeholder?: string; }

export default function Modal({ title, fields, submitLabel, onSubmit, onClose }: {
  title: string; fields: Field[]; submitLabel: string;
  onSubmit: (v: Record<string, string>) => Promise<void>; onClose: () => void;
}) {
  const [v, setV] = useState<Record<string, string>>({});
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function go() {
    for (const f of fields) if (f.required && !v[f.key]?.trim()) { setErr(`${f.label}을(를) 입력하세요`); return; }
    setBusy(true); setErr("");
    try { await onSubmit(v); } catch (e: any) { setErr(e.message); setBusy(false); }
  }
  return (
    <div className="mbg" onClick={onClose}>
      <div className="mbox" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: "0 0 14px", fontSize: 16 }}>{title}</h3>
        <div style={{ display: "grid", gap: 12 }}>
          {fields.map((f) => (
            <div key={f.key}>
              <div className="flabel">{f.label}{f.required && <span style={{ color: "var(--red)" }}>*</span>}</div>
              {f.type === "textarea"
                ? <textarea className="textarea" placeholder={f.placeholder} value={v[f.key] ?? ""} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} />
                : f.type === "select"
                ? <select className="select" value={v[f.key] ?? ""} onChange={(e) => setV({ ...v, [f.key]: e.target.value })}>
                    <option value="">선택</option>
                    {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                : <input className="input" type={f.type === "date" ? "date" : "text"} placeholder={f.placeholder} value={v[f.key] ?? ""} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} />}
            </div>
          ))}
          {err && <div style={{ color: "var(--red)", fontSize: 12.5 }}>{err}</div>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
            <button className="btn" onClick={onClose}>취소</button>
            <button className="btn prim" onClick={go} disabled={busy}>{busy ? "처리 중…" : submitLabel}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
