// 설계서 §3·§4 — 상태·역할·카테고리·긴급도의 단일 출처.
// 화면과 서버가 같은 상수를 참조해 어긋나지 않게 한다.

export const STATUS = {
  SUBMITTED: "접수",
  IN_PROGRESS: "처리중",
  ON_HOLD: "보류",
  RESOLVED: "완료",
  CLOSED: "종료",
  REJECTED: "반려",
} as const;
export type Status = keyof typeof STATUS;

// 목록 탭 분류(설계서 §7)
export const OPEN_STATUSES: Status[] = ["SUBMITTED", "IN_PROGRESS", "ON_HOLD"];

export const PRIORITY = {
  low: "낮음",
  normal: "보통",
  high: "높음",
  urgent: "긴급",
} as const;
export type Priority = keyof typeof PRIORITY;
export const PRIORITY_ORDER: Priority[] = ["urgent", "high", "normal", "low"];

// 카테고리 → 담당 부서 고정 매핑 (설계서 §4.3, 6개)
export const CATEGORIES = [
  { key: "facility_repair", label: "시설 - 보수", dept: "시설팀", examples: "프로젝터 고장, 조명, 누수, 출입카드 리더기" },
  { key: "facility_equip",  label: "시설 - 설비", dept: "시설팀", examples: "냉난방, 환기, 공조" },
  { key: "it_incident",     label: "IT - 장애",  dept: "IT팀",   examples: "네트워크 끊김, 시스템 접속 불가" },
  { key: "it_device",       label: "IT - 장비",  dept: "IT팀",   examples: "노트북·모니터·프린터 고장, 지급" },
  { key: "it_account",      label: "IT - 계정",  dept: "IT팀",   examples: "VPN·시스템 계정, 권한, 비밀번호" },
  { key: "ga_supplies",     label: "총무 - 비품", dept: "총무팀", examples: "용지, 사무용품, 토너" },
] as const;
export type CategoryKey = typeof CATEGORIES[number]["key"];
export const catByKey = (k: string) => CATEGORIES.find((c) => c.key === k);
export const deptOfCategory = (k: string) => catByKey(k)?.dept ?? "IT팀";

// 시드 사용자 (설계서 §3) — 요청자 2 + 담당자 3. 모두 가상 인물.
export const SEED_USERS = [
  { id: "u_sales",  name: "김영업",   department: "영업팀",   isHandler: false },
  { id: "u_design", name: "이하나",   department: "디자인팀", isHandler: false },
  { id: "u_fac",    name: "박시설",   department: "시설팀",   isHandler: true },
  { id: "u_it",     name: "최아이티", department: "IT팀",     isHandler: true },
  { id: "u_ga",     name: "정총무",   department: "총무팀",   isHandler: true },
] as const;

export const deptToHandlers: Record<string, string[]> = {
  시설팀: ["u_fac"], IT팀: ["u_it"], 총무팀: ["u_ga"],
};

export const EVENT = {
  CREATED: "CREATED", ASSIGNED: "ASSIGNED", STATUS_CHANGED: "STATUS_CHANGED",
  PRIORITY_CHANGED: "PRIORITY_CHANGED", COMMENTED: "COMMENTED",
  FOLLOWED: "FOLLOWED", AI_SUGGESTED: "AI_SUGGESTED",
} as const;
