// 설계서 §6 — AI는 제안만 하고 결정은 사람이 한다.
// Ollama(로컬 경량 모델)를 먼저 시도하고, 미기동·실패·타임아웃이면
// 규칙기반(키워드 분류·bigram 유사도)으로 같은 화면이 동작한다.
import { CATEGORIES, deptOfCategory, Priority } from "./domain";

export interface Suggestion {
  title: string;
  category: string;
  urgency: Priority;
  urgency_reason: string;
  summary: string;
  source: "ollama" | "rule";
}

const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:1.5b";
const TIMEOUT = Number(process.env.AI_TIMEOUT_MS || 20000);

// ── 규칙기반 분류 (fallback) ───────────────────────────────
const KW: { cat: string; words: string[] }[] = [
  { cat: "facility_repair", words: ["프로젝터", "조명", "누수", "출입", "카드", "문", "잠금", "형광등", "램프", "고장난 시설"] },
  { cat: "facility_equip",  words: ["냉난방", "에어컨", "히터", "환기", "공조", "온도", "덥", "추", "환풍"] },
  { cat: "it_incident",     words: ["네트워크", "인터넷", "와이파이", "wifi", "끊", "접속", "서버", "장애", "먹통", "안 됩니다", "다운"] },
  { cat: "it_device",       words: ["노트북", "모니터", "프린터", "키보드", "마우스", "장비", "지급", "데스크탑", "충전"] },
  { cat: "it_account",      words: ["vpn", "계정", "권한", "비밀번호", "패스워드", "로그인", "잠겼", "인증"] },
  { cat: "ga_supplies",     words: ["용지", "토너", "사무용품", "볼펜", "비품", "문구", "포스트잇", "종이"] },
];
const URGENT = ["긴급", "지금", "당장", "즉시", "발표", "곧", "오늘", "회의 전", "멈췄", "전체", "다운", "중단"];
const HIGH = ["빨리", "오후", "안 됩니다", "안됩니다", "불가", "고장", "먹통", "시간"];
const LOW = ["언제든", "천천히", "여유", "다음 주", "괜찮"];

function ruleClassify(text: string): Suggestion {
  const t = text.toLowerCase();
  let best: string = CATEGORIES[0].key;
  let bestN = 0;
  for (const { cat, words } of KW) {
    const n = words.reduce((a, w) => a + (t.includes(w.toLowerCase()) ? 1 : 0), 0);
    if (n > bestN) { bestN = n; best = cat; }
  }
  let urgency: Priority = "normal", reason = "특별한 시간 제약 표현이 없어 보통으로 판단했습니다.";
  if (URGENT.some((w) => t.includes(w))) { urgency = "urgent"; reason = "즉시·발표·전체중단 등 긴급 신호가 있어 긴급으로 판단했습니다."; }
  else if (HIGH.some((w) => t.includes(w))) { urgency = "high"; reason = "업무 지장·시간 제약 표현이 있어 높음으로 판단했습니다."; }
  else if (LOW.some((w) => t.includes(w))) { urgency = "low"; reason = "여유 있는 표현이 있어 낮음으로 판단했습니다."; }
  const first = text.trim().split(/[.!?\n]/)[0].slice(0, 40) || text.slice(0, 40);
  const title = first.length >= 6 ? first : text.trim().slice(0, 30);
  return { title, category: best, urgency, urgency_reason: reason, summary: first, source: "rule" };
}

// ── Ollama 호출 ────────────────────────────────────────────
async function ollamaClassify(text: string): Promise<Suggestion | null> {
  const cats = CATEGORIES.map((c) => `${c.key}(${c.label})`).join(", ");
  const sys = `너는 사내 업무요청을 분류하는 도우미다. 반드시 아래 JSON만 출력한다.
카테고리는 다음 중 하나의 key: ${cats}
긴급도(urgency)는 low·normal·high·urgent 중 하나.
{"title":"짧은 제목","category":"key","urgency":"...","urgency_reason":"한 문장 근거","summary":"한 줄 요약"}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: OLLAMA_MODEL, stream: false, format: "json",
        options: { temperature: 0.1 },
        messages: [{ role: "system", content: sys }, { role: "user", content: text }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const parsed = JSON.parse(data.message?.content ?? "{}");
    if (!parsed.category || !CATEGORIES.some((c) => c.key === parsed.category)) return null;
    const urg = ["low", "normal", "high", "urgent"].includes(parsed.urgency) ? parsed.urgency : "normal";
    return {
      title: String(parsed.title || text.slice(0, 30)).slice(0, 60),
      category: parsed.category,
      urgency: urg as Priority,
      urgency_reason: String(parsed.urgency_reason || "").slice(0, 200),
      summary: String(parsed.summary || parsed.title || text.slice(0, 40)).slice(0, 120),
      source: "ollama",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function classify(text: string, mode: "ai" | "manual"): Promise<Suggestion> {
  if (mode === "manual") {
    // 직접 입력: 한 줄 요약만 생성 (설계서 §6)
    const first = text.trim().split(/[.!?\n]/)[0].slice(0, 40) || text.slice(0, 40);
    return { title: "", category: "", urgency: "normal", urgency_reason: "", summary: first, source: "rule" };
  }
  const viaLLM = await ollamaClassify(text);
  return viaLLM ?? ruleClassify(text);
}

// ── 유사 요청: bigram 유사도 (설계서 §6 fallback) ───────────
function bigrams(s: string): Set<string> {
  const t = s.replace(/\s+/g, "");
  const out = new Set<string>();
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
  return out;
}
export function similarity(a: string, b: string): number {
  const A = bigrams(a), B = bigrams(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const g of A) if (B.has(g)) inter++;
  return (2 * inter) / (A.size + B.size); // Dice 계수
}

export function deptOf(category: string) { return deptOfCategory(category); }
