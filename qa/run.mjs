// 업무요청 센터 QA 스위트 — 의존성 없는 Node 스크립트.
// 실행: node qa/run.mjs            (기본 http://localhost:3310)
//       QA_BASE=... node qa/run.mjs
// 정상 흐름보다 예외 케이스에 무게를 둔다. 설계서 §4·§6·§7·§9의 규칙이
// 서버에서도 실제로 강제되는지를 확인하는 것이 목적.

const BASE = process.env.QA_BASE || "http://localhost:3310";

const R = { pass: 0, fail: 0, rows: [] };
const C = { g: "\x1b[32m", r: "\x1b[31m", y: "\x1b[33m", d: "\x1b[2m", x: "\x1b[0m" };

async function call(method, path, { user = "u_sales", body, raw } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "content-type": "application/json", "x-user-id": user },
    body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
  });
  let json = null, text = "";
  try { text = await res.text(); json = JSON.parse(text); } catch { /* 본문이 JSON이 아닐 수 있다 */ }
  return { status: res.status, json, text };
}

function record(id, group, name, ok, want, got, note) {
  ok ? R.pass++ : R.fail++;
  R.rows.push({ id, group, name, ok, want, got, note });
  const tag = ok ? `${C.g}PASS${C.x}` : `${C.r}FAIL${C.x}`;
  console.log(`${tag} ${id.padEnd(5)} ${name}`);
  if (!ok) console.log(`        ${C.y}기대${C.x} ${want}  ${C.y}실제${C.x} ${got}`);
}

// 케이스 등록기
const CASES = [];
const t = (id, group, name, fn) => CASES.push({ id, group, name, fn });
const expect = (cond, want, got) => ({ ok: !!cond, want, got });

/* ───────────────────────── A. 기본 조회 ───────────────────────── */

t("A1", "기본", "사용자 5명이 시드된다", async () => {
  const { status, json } = await call("GET", "/api/users");
  return expect(status === 200 && json.users?.length === 5, "200 / 5명", `${status} / ${json?.users?.length}명`);
});

t("A2", "기본", "내 요청 목록이 배열로 온다", async () => {
  const { status, json } = await call("GET", "/api/requests?view=mine");
  return expect(status === 200 && Array.isArray(json.items), "200 / 배열", `${status} / ${typeof json?.items}`);
});

t("A3", "기본", "부서 통계가 숫자 3개로 온다", async () => {
  const { status, json } = await call("GET", "/api/stats", { user: "u_fac" });
  const ok = status === 200 && ["todayCount", "avgResolveHours", "unassignedUrgent"].every((k) => typeof json[k] === "number");
  return expect(ok, "200 / 숫자 3개", `${status} / ${JSON.stringify(json)}`);
});

t("A4", "기본", "알 수 없는 사용자 헤더는 거부된다", async () => {
  const { status } = await call("GET", "/api/requests?view=mine", { user: "u_ghost" });
  return expect(status === 400, "400", String(status));
});

/* ─────────────────────── B. 등록 입력 검증 ─────────────────────── */

const NEW = (over = {}) => ({
  title: "QA 프로젝터 점검 요청", description: "QA 시나리오용 요청 본문입니다.",
  category: "facility_repair", priority: "normal", summary: "QA 요약", mode: "manual", ...over,
});

t("B1", "등록검증", "제목 누락은 400", async () => {
  const { status } = await call("POST", "/api/requests", { body: NEW({ title: "" }) });
  return expect(status === 400, "400", String(status));
});

t("B2", "등록검증", "본문 누락은 400", async () => {
  const { status } = await call("POST", "/api/requests", { body: NEW({ description: "" }) });
  return expect(status === 400, "400", String(status));
});

t("B3", "등록검증", "카테고리 누락은 400", async () => {
  const { status } = await call("POST", "/api/requests", { body: NEW({ category: "" }) });
  return expect(status === 400, "400", String(status));
});

t("B4", "등록검증", "공백뿐인 제목은 400", async () => {
  const { status } = await call("POST", "/api/requests", { body: NEW({ title: "   " }) });
  return expect(status === 400, "400", String(status));
});

t("B5", "등록검증", "알 수 없는 카테고리는 400", async () => {
  const { status, json } = await call("POST", "/api/requests", { body: NEW({ category: "space_travel" }) });
  return expect(status === 400, "400", `${status} (id=${json?.id})`);
});

t("B6", "등록검증", "알 수 없는 긴급도는 400", async () => {
  const { status, json } = await call("POST", "/api/requests", { body: NEW({ priority: "banana" }) });
  return expect(status === 400, "400", `${status} (id=${json?.id})`);
});

t("B7", "등록검증", "본문 500자 초과는 400", async () => {
  const { status } = await call("POST", "/api/requests", { body: NEW({ description: "가".repeat(5000) }) });
  return expect(status === 400, "400", String(status));
});

t("B8", "등록검증", "깨진 JSON 본문은 500이 아니라 400", async () => {
  const { status } = await call("POST", "/api/requests", { body: "{not json", raw: true });
  return expect(status === 400, "400", String(status));
});

t("B9", "등록검증", "정상 등록 시 부서가 카테고리에서 자동 배정된다", async () => {
  const { status, json } = await call("POST", "/api/requests", { body: NEW({ category: "it_account" }) });
  if (status !== 200) return expect(false, "200", String(status));
  const d = await call("GET", `/api/requests/${json.id}`);
  const r = d.json;
  return expect(r.department === "IT팀" && r.status === "SUBMITTED",
    "IT팀 / SUBMITTED", `${r.department} / ${r.status}`);
});

/* ───────────────────── C. 권한 (설계서 §3·§7) ───────────────────── */

let facReqId;   // 시설팀으로 가는 영업팀 요청
t("C0", "권한", "권한 시나리오용 요청 준비", async () => {
  const { json } = await call("POST", "/api/requests", { body: NEW({ title: "QA 권한 시나리오 요청" }) });
  facReqId = json?.id;
  return expect(!!facReqId, "요청 id", String(facReqId));
});

t("C1", "권한", "타 부서 담당자는 배정할 수 없다", async () => {
  const { status } = await call("POST", `/api/requests/${facReqId}/assign`, { user: "u_it", body: {} });
  return expect(status === 403, "403", String(status));
});

t("C2", "권한", "요청자는 배정할 수 없다", async () => {
  const { status } = await call("POST", `/api/requests/${facReqId}/assign`, { user: "u_sales", body: {} });
  return expect(status === 403, "403", String(status));
});

t("C3", "권한", "부서 담당자가 아닌 대상에는 배정할 수 없다", async () => {
  const { status } = await call("POST", `/api/requests/${facReqId}/assign`, { user: "u_fac", body: { toUserId: "u_it" } });
  return expect(status === 400, "400", String(status));
});

t("C4", "권한", "존재하지 않는 사용자에게는 배정할 수 없다", async () => {
  const { status } = await call("POST", `/api/requests/${facReqId}/assign`, { user: "u_fac", body: { toUserId: "u_ghost" } });
  return expect(status === 400, "400", String(status));
});

/* ─────────────────── D. 상태 전이 (설계서 §4.2) ─────────────────── */

t("D1", "전이", "접수 상태에서 바로 완료 처리할 수 없다", async () => {
  const { status } = await call("POST", `/api/requests/${facReqId}/transition`, {
    user: "u_fac", body: { action: "resolve", result: "그냥 완료" } });
  return expect(status === 400, "400", String(status));
});

t("D2", "전이", "배정하면 처리중이 되고 담당자가 기록된다", async () => {
  const { status, json } = await call("POST", `/api/requests/${facReqId}/assign`, { user: "u_fac", body: {} });
  return expect(status === 200 && json.status === "IN_PROGRESS" && json.assignee?.id === "u_fac",
    "200 / IN_PROGRESS / u_fac", `${status} / ${json?.status} / ${json?.assignee?.id}`);
});

t("D3", "전이", "transition으로 배정하면 담당자 없는 처리중이 되면 안 된다", async () => {
  const { json } = await call("POST", "/api/requests", { body: NEW({ title: "QA transition 우회 점검" }) });
  const res = await call("POST", `/api/requests/${json.id}/transition`, { user: "u_fac", body: { action: "assign_self" } });
  const d = await call("GET", `/api/requests/${json.id}`, { user: "u_fac" });
  const orphan = d.json.status === "IN_PROGRESS" && !d.json.assignee;
  return expect(!orphan, "담당자 없는 처리중 아님", `status=${d.json.status} assignee=${d.json.assignee?.id ?? "없음"} (transition ${res.status})`);
});

t("D4", "전이", "보류는 사유 없이 불가", async () => {
  const { status } = await call("POST", `/api/requests/${facReqId}/transition`, { user: "u_fac", body: { action: "hold" } });
  return expect(status === 400, "400", String(status));
});

t("D5", "전이", "보류 → 재개 → 완료 → 종료가 이어진다", async () => {
  const h = await call("POST", `/api/requests/${facReqId}/transition`, {
    user: "u_fac", body: { action: "hold", reason: "부품 입고 대기", resumeDate: "2026-10-01" } });
  if (h.json?.status !== "ON_HOLD") return expect(false, "ON_HOLD", h.json?.status);
  const rs = await call("POST", `/api/requests/${facReqId}/transition`, { user: "u_fac", body: { action: "resume" } });
  if (rs.json?.status !== "IN_PROGRESS") return expect(false, "IN_PROGRESS", rs.json?.status);
  const rv = await call("POST", `/api/requests/${facReqId}/transition`, {
    user: "u_fac", body: { action: "resolve", result: "부품 교체 완료" } });
  if (rv.json?.status !== "RESOLVED") return expect(false, "RESOLVED", rv.json?.status);
  const cl = await call("POST", `/api/requests/${facReqId}/transition`, { user: "u_sales", body: { action: "close" } });
  return expect(cl.json?.status === "CLOSED", "CLOSED", cl.json?.status);
});

t("D6", "전이", "재개 후 보류 사유가 지워진다", async () => {
  const d = await call("GET", `/api/requests/${facReqId}`);
  return expect(!d.json.holdReason, "보류 사유 없음", String(d.json.holdReason));
});

t("D7", "전이", "완료는 처리 내역 없이 불가", async () => {
  const { json } = await call("POST", "/api/requests", { body: NEW({ title: "QA 완료 검증 요청" }) });
  await call("POST", `/api/requests/${json.id}/assign`, { user: "u_fac", body: {} });
  const { status } = await call("POST", `/api/requests/${json.id}/transition`, { user: "u_fac", body: { action: "resolve", result: "  " } });
  return expect(status === 400, "400", String(status));
});

t("D8", "전이", "종료된 요청에는 코멘트를 달 수 없다", async () => {
  const { status } = await call("POST", `/api/requests/${facReqId}/comments`, { user: "u_sales", body: { body: "추가 문의" } });
  return expect(status === 400, "400", String(status));
});

t("D9", "전이", "종료된 요청은 더 전이되지 않는다", async () => {
  const { status } = await call("POST", `/api/requests/${facReqId}/transition`, { user: "u_sales", body: { action: "close" } });
  return expect(status === 400, "400", String(status));
});

t("D10", "전이", "종료된 요청의 담당자는 바꿀 수 없다", async () => {
  const { status } = await call("POST", `/api/requests/${facReqId}/assign`, { user: "u_fac", body: { toUserId: "u_fac" } });
  return expect(status === 400, "400", String(status));
});

t("D11", "전이", "요청 당사자가 아니면 종료할 수 없다", async () => {
  const { json } = await call("POST", "/api/requests", { body: NEW({ title: "QA 당사자 확인 요청" }) });
  await call("POST", `/api/requests/${json.id}/assign`, { user: "u_fac", body: {} });
  await call("POST", `/api/requests/${json.id}/transition`, { user: "u_fac", body: { action: "resolve", result: "처리함" } });
  const { status } = await call("POST", `/api/requests/${json.id}/transition`, { user: "u_design", body: { action: "close" } });
  return expect(status === 403, "403", String(status));
});

let rejectedId;
t("D12", "전이", "반려 → 다시 요청이 처리중으로 되돌린다", async () => {
  const { json } = await call("POST", "/api/requests", { body: NEW({ title: "QA 반려 시나리오 요청" }) });
  rejectedId = json.id;
  const rj = await call("POST", `/api/requests/${rejectedId}/transition`, {
    user: "u_fac", body: { action: "reject", reason: "요청 범위 밖" } });
  if (rj.json?.status !== "REJECTED") return expect(false, "REJECTED", rj.json?.status);
  const ro = await call("POST", `/api/requests/${rejectedId}/transition`, {
    user: "u_sales", body: { action: "reopen", reason: "내부 협의 완료" } });
  return expect(ro.json?.status === "IN_PROGRESS" && !ro.json.rejectReason,
    "IN_PROGRESS / 반려사유 삭제", `${ro.json?.status} / ${ro.json?.rejectReason}`);
});

t("D13", "전이", "다시 요청은 사유 없이 불가", async () => {
  const { json } = await call("POST", "/api/requests", { body: NEW({ title: "QA 재요청 사유 검증" }) });
  await call("POST", `/api/requests/${json.id}/transition`, { user: "u_fac", body: { action: "reject", reason: "중복" } });
  const { status } = await call("POST", `/api/requests/${json.id}/transition`, { user: "u_sales", body: { action: "reopen" } });
  return expect(status === 400, "400", String(status));
});

t("D14", "전이", "알 수 없는 액션은 400", async () => {
  const { status } = await call("POST", `/api/requests/${rejectedId}/transition`, { user: "u_fac", body: { action: "자폭" } });
  return expect(status === 400, "400", String(status));
});

t("D15", "전이", "담당자가 직접 낸 요청도 본인이 종료할 수 있다", async () => {
  // 시설팀 담당자(u_fac)가 시설 요청을 직접 낸 경우.
  // 역할을 담당자 하나로만 보면 완료 뒤 종료할 사람이 없어 요청이 갇힌다.
  const { json } = await call("POST", "/api/requests", { user: "u_fac", body: NEW({ title: "QA 담당자 본인 요청" }) });
  await call("POST", `/api/requests/${json.id}/assign`, { user: "u_fac", body: {} });
  await call("POST", `/api/requests/${json.id}/transition`, { user: "u_fac", body: { action: "resolve", result: "직접 처리" } });
  const d = await call("GET", `/api/requests/${json.id}`, { user: "u_fac" });
  const hasClose = d.json.allowedActions.some((a) => a.action === "close");
  const cl = await call("POST", `/api/requests/${json.id}/transition`, { user: "u_fac", body: { action: "close" } });
  return expect(hasClose && cl.json?.status === "CLOSED", "종료 가능 / CLOSED", `액션노출=${hasClose} / ${cl.json?.status ?? cl.status}`);
});

t("D16", "전이", "transition으로 담당 변경을 우회할 수 없다", async () => {
  const { json } = await call("POST", "/api/requests", { body: NEW({ title: "QA 담당변경 우회 점검" }) });
  await call("POST", `/api/requests/${json.id}/assign`, { user: "u_fac", body: {} });
  const { status } = await call("POST", `/api/requests/${json.id}/transition`, { user: "u_fac", body: { action: "reassign" } });
  return expect(status === 400, "400", String(status));
});

/* ──────────────── E. 중복·참여 (설계서 §4.4) ──────────────── */

let origId, dupId;
t("E0", "중복참여", "중복 시나리오용 원본/중복 요청 준비", async () => {
  const a = await call("POST", "/api/requests", { user: "u_sales", body: NEW({ title: "QA 4층 복합기 용지 걸림" }) });
  const b = await call("POST", "/api/requests", { user: "u_design", body: NEW({ title: "QA 4층 복합기 용지 걸림 재발" }) });
  origId = a.json?.id; dupId = b.json?.id;
  return expect(!!origId && !!dupId, "두 요청 생성", `${origId}, ${dupId}`);
});

t("E1", "중복참여", "본인 요청에는 참여할 수 없다", async () => {
  const { status } = await call("POST", `/api/requests/${origId}/follow`, { user: "u_sales", body: { via: "detail" } });
  return expect(status === 400, "400", String(status));
});

t("E2", "중복참여", "타인 요청에 참여하면 참여자에 들어간다", async () => {
  const { status, json } = await call("POST", `/api/requests/${origId}/follow`, { user: "u_design", body: { via: "detail" } });
  return expect(status === 200 && json.followers?.some((f) => f.id === "u_design"),
    "200 / 참여자 포함", `${status} / ${JSON.stringify(json?.followers)}`);
});

t("E3", "중복참여", "같은 사람이 두 번 참여해도 이력은 하나다", async () => {
  await call("POST", `/api/requests/${origId}/follow`, { user: "u_design", body: { via: "detail" } });
  const d = await call("GET", `/api/requests/${origId}`);
  const n = d.json.timeline.filter((e) => e.type === "FOLLOWED" && e.actorId === "u_design").length;
  return expect(n === 1, "FOLLOWED 1건", `${n}건`);
});

t("E4", "중복참여", "중복 반려하면 요청자가 원본의 참여자가 된다", async () => {
  const { status } = await call("POST", `/api/requests/${dupId}/transition`, {
    user: "u_fac", body: { action: "reject", reason: "기존 요청과 중복", duplicateOfId: origId } });
  if (status !== 200) return expect(false, "200", String(status));
  const d = await call("GET", `/api/requests/${origId}`);
  const f = d.json.followers.find((x) => x.id === "u_design");
  return expect(!!f, "u_design 참여자", JSON.stringify(d.json.followers));
});

t("E5", "중복참여", "반려된 요청에는 참여할 수 없다", async () => {
  const { status } = await call("POST", `/api/requests/${dupId}/follow`, { user: "u_sales", body: {} });
  return expect(status === 400, "400", String(status));
});

t("E6", "중복참여", "존재하지 않는 원본으로 중복 반려하면 400", async () => {
  const { json } = await call("POST", "/api/requests", { body: NEW({ title: "QA 잘못된 원본 지정" }) });
  const { status } = await call("POST", `/api/requests/${json.id}/transition`, {
    user: "u_fac", body: { action: "reject", reason: "중복", duplicateOfId: 999999 } });
  return expect(status === 400, "400", String(status));
});

t("E7", "중복참여", "자기 자신을 원본으로 지정할 수 없다", async () => {
  const { json } = await call("POST", "/api/requests", { body: NEW({ title: "QA 자기참조 원본 지정" }) });
  const res = await call("POST", `/api/requests/${json.id}/transition`, {
    user: "u_fac", body: { action: "reject", reason: "중복", duplicateOfId: json.id } });
  if (res.status === 400) return expect(true, "400", "400");
  const d = await call("GET", `/api/requests/${json.id}`);
  const selfFollow = d.json.followers.some((f) => f.id === d.json.requester.id);
  return expect(!selfFollow, "400 또는 본인 참여 없음", `${res.status} / 본인이 참여자로 등록됨`);
});

/* ──────────────────── F. AI 제안 (설계서 §6) ──────────────────── */

t("E8", "중복참여", "같은 사람의 요청을 원본으로 지정해도 본인 참여는 생기지 않는다", async () => {
  const a = await call("POST", "/api/requests", { user: "u_design", body: NEW({ title: "QA 동일인 원본" }) });
  const b = await call("POST", "/api/requests", { user: "u_design", body: NEW({ title: "QA 동일인 중복" }) });
  await call("POST", `/api/requests/${b.json.id}/transition`, {
    user: "u_fac", body: { action: "reject", reason: "중복", duplicateOfId: a.json.id } });
  const d = await call("GET", `/api/requests/${a.json.id}`);
  const selfFollow = d.json.followers.some((f) => f.id === "u_design");
  return expect(!selfFollow, "본인 참여 없음", JSON.stringify(d.json.followers));
});

t("E9", "중복참여", "잘못된 형식의 원본 ID는 400", async () => {
  const { json } = await call("POST", "/api/requests", { body: NEW({ title: "QA 원본 형식 검증" }) });
  const { status } = await call("POST", `/api/requests/${json.id}/transition`, {
    user: "u_fac", body: { action: "reject", reason: "중복", duplicateOfId: "여덟번" } });
  return expect(status === 400, "400", String(status));
});

t("F1", "AI", "빈 텍스트 분석은 400", async () => {
  const { status } = await call("POST", "/api/ai/analyze", { body: { text: "   ", mode: "ai" } });
  return expect(status === 400, "400", String(status));
});

t("F2", "AI", "제안 카테고리·긴급도가 허용값 안에 있다", async () => {
  const { status, json } = await call("POST", "/api/ai/analyze", {
    body: { text: "3층 회의실 프로젝터가 안 켜져요. 오후 3시 발표 전에 봐주세요", mode: "ai" } });
  const cats = ["facility_repair", "facility_equip", "it_incident", "it_device", "it_account", "ga_supplies"];
  const s = json?.suggestion;
  const ok = status === 200 && cats.includes(s?.category) && ["low", "normal", "high", "urgent"].includes(s?.urgency) && s?.title;
  return expect(ok, "허용 카테고리/긴급도", `${status} / ${s?.category} / ${s?.urgency} / ${s?.source}`);
});

t("F3", "AI", "직접 입력 모드는 요약만 만든다", async () => {
  const { json } = await call("POST", "/api/ai/analyze", { body: { text: "탕비실 전등이 깜빡입니다", mode: "manual" } });
  const s = json.suggestion;
  return expect(!!s.summary && !s.title && !s.category, "요약만", JSON.stringify(s));
});

t("F4", "AI", "유사 요청에 본인 요청은 포함되지 않는다", async () => {
  const { json } = await call("POST", "/api/ai/analyze", {
    user: "u_sales", body: { text: "QA 4층 복합기 용지 걸림", mode: "ai" } });
  const mine = await call("GET", "/api/requests?view=mine");
  const myIds = new Set(mine.json.items.filter((i) => i.requesterId === "u_sales").map((i) => i.id));
  const bad = json.similar.filter((s) => myIds.has(s.id));
  return expect(bad.length === 0, "본인 요청 0건", `${bad.length}건`);
});

t("F5", "AI", "아주 긴 입력에도 죽지 않는다", async () => {
  const { status } = await call("POST", "/api/ai/analyze", { body: { text: "프로젝터 고장 ".repeat(2000), mode: "ai" } });
  return expect(status === 200 || status === 400, "200 또는 400", String(status));
});

t("F6", "AI", "text 필드 누락은 500이 아니라 400", async () => {
  const { status } = await call("POST", "/api/ai/analyze", { body: { mode: "ai" } });
  return expect(status === 400, "400", String(status));
});

/* ─────────────────── G. 목록·정렬·404 (설계서 §7) ─────────────────── */

t("G1", "목록", "처리할 요청 큐에는 본인 부서만 보인다", async () => {
  const { json } = await call("GET", "/api/requests?view=queue", { user: "u_fac" });
  const bad = json.items.filter((i) => i.department !== "시설팀");
  return expect(bad.length === 0, "타 부서 0건", `${bad.length}건`);
});

t("G2", "목록", "긴급 요청이 목록 맨 앞에 온다", async () => {
  await call("POST", "/api/requests", { body: NEW({ title: "QA 긴급 정렬 확인", priority: "urgent" }) });
  const { json } = await call("GET", "/api/requests?view=queue", { user: "u_fac" });
  const order = ["urgent", "high", "normal", "low"];
  const idx = json.items.map((i) => order.indexOf(i.priority));
  const sorted = idx.every((v, i) => i === 0 || idx[i - 1] <= v) && idx.every((v) => v >= 0);
  return expect(sorted, "긴급→낮음 순", JSON.stringify(json.items.map((i) => i.priority)));
});

t("G2b", "목록", "코멘트 1000자 초과는 400", async () => {
  const { json } = await call("POST", "/api/requests", { body: NEW({ title: "QA 코멘트 길이 검증" }) });
  const { status } = await call("POST", `/api/requests/${json.id}/comments`, { body: { body: "가".repeat(1001) } });
  return expect(status === 400, "400", String(status));
});

t("G3", "목록", "없는 요청 상세는 404", async () => {
  const { status } = await call("GET", "/api/requests/999999");
  return expect(status === 404, "404", String(status));
});

t("G4", "목록", "숫자가 아닌 요청 id는 500이 아니라 404", async () => {
  const { status } = await call("GET", "/api/requests/abc");
  return expect(status === 404, "404", String(status));
});

t("G5", "목록", "코멘트 빈 내용은 400", async () => {
  const { json } = await call("POST", "/api/requests", { body: NEW({ title: "QA 코멘트 검증 요청" }) });
  const { status } = await call("POST", `/api/requests/${json.id}/comments`, { body: { body: "   " } });
  return expect(status === 400, "400", String(status));
});

t("G6", "목록", "타임라인이 시간순 추가 전용으로 쌓인다", async () => {
  const { json } = await call("POST", "/api/requests", { body: NEW({ title: "QA 타임라인 확인 요청" }) });
  await call("POST", `/api/requests/${json.id}/assign`, { user: "u_fac", body: {} });
  await call("POST", `/api/requests/${json.id}/comments`, { user: "u_fac", body: { body: "확인 중입니다" } });
  const d = await call("GET", `/api/requests/${json.id}`);
  const ts = d.json.timeline.map((e) => new Date(e.at).getTime());
  const asc = ts.every((v, i) => i === 0 || ts[i - 1] <= v);
  const types = d.json.timeline.map((e) => e.type).join(",");
  return expect(asc && types.startsWith("CREATED"), "시간순 / CREATED 시작", `${asc} / ${types}`);
});

/* ───────────────────────────── 실행 ───────────────────────────── */

const only = process.argv[2];
console.log(`\n업무요청 센터 QA — ${BASE}\n${"─".repeat(60)}`);
let group = "";
for (const c of CASES) {
  if (only && !c.id.startsWith(only)) continue;
  if (c.group !== group) { group = c.group; console.log(`\n${C.d}[${group}]${C.x}`); }
  try {
    const r = await c.fn();
    record(c.id, c.group, c.name, r.ok, r.want, r.got);
  } catch (e) {
    record(c.id, c.group, c.name, false, "예외 없음", `throw ${e.message}`);
  }
}
console.log(`\n${"─".repeat(60)}`);
console.log(`${C.g}통과 ${R.pass}${C.x}  ${R.fail ? C.r : ""}실패 ${R.fail}${C.x}  합계 ${R.pass + R.fail}`);
if (R.fail) {
  console.log(`\n실패 목록`);
  for (const r of R.rows.filter((x) => !x.ok)) console.log(`  ${r.id} [${r.group}] ${r.name}\n      기대 ${r.want} / 실제 ${r.got}`);
}
process.exit(R.fail ? 1 : 0);
