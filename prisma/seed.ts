import { PrismaClient } from "@prisma/client";
import { SEED_USERS, SEED_PASSWORD } from "../src/lib/domain";
import { hashPassword } from "../src/lib/password";
const db = new PrismaClient();

// 상대 시각 헬퍼
const hrsAgo = (h: number) => new Date(Date.now() - h * 3600_000);

async function main() {
  await db.session.deleteMany();
  await db.requestFollower.deleteMany();
  await db.requestEvent.deleteMany();
  await db.request.deleteMany();
  await db.user.deleteMany();

  const pw = await hashPassword(SEED_PASSWORD);
  for (const u of SEED_USERS) await db.user.create({ data: { ...u, passwordHash: pw } });

  // 요청 + 생성 이벤트를 함께 만드는 헬퍼
  async function mk(r: {
    title: string; description: string; summary: string; category: string; department: string;
    priority: string; status: string; requesterId: string; assigneeId?: string;
    result?: string; holdReason?: string; holdResumeDate?: string; rejectReason?: string;
    duplicateOfId?: number; createdAt: Date; resolvedAt?: Date;
  }) {
    const req = await db.request.create({ data: { ...r, updatedAt: r.createdAt } });
    await db.requestEvent.create({ data: {
      requestId: req.id, actorId: r.requesterId, type: "CREATED",
      payload: JSON.stringify({ title: r.title, category: r.category, priority: r.priority, mode: "seed" }),
      createdAt: r.createdAt,
    }});
    return req;
  }

  // 열린 요청들 (부서별 큐가 비지 않게)
  await mk({ title: "3층 회의실 프로젝터 전원 안 들어옴", description: "3층 대회의실 프로젝터가 전원이 안 켜집니다. 내일 오전 보고에 필요합니다.",
    summary: "3층 회의실 프로젝터 전원 불량", category: "facility_repair", department: "시설팀", priority: "high",
    status: "SUBMITTED", requesterId: "u_sales", createdAt: hrsAgo(5) });

  await mk({ title: "탕비실 정수기 온수 안 나옴", description: "탕비실 정수기에서 온수가 나오지 않습니다.",
    summary: "탕비실 정수기 온수 불량", category: "facility_equip", department: "시설팀", priority: "normal",
    status: "IN_PROGRESS", requesterId: "u_design", assigneeId: "u_fac", createdAt: hrsAgo(28) });

  await mk({ title: "사내 그룹웨어 접속 불가", description: "오전부터 그룹웨어에 접속이 안 됩니다. 팀 전체가 같은 증상입니다.",
    summary: "그룹웨어 전사 접속 장애", category: "it_incident", department: "IT팀", priority: "urgent",
    status: "SUBMITTED", requesterId: "u_sales", createdAt: hrsAgo(2) });

  await mk({ title: "노트북 배터리 교체 요청", description: "지급받은 노트북 배터리가 30분도 못 갑니다. 교체 부탁드립니다.",
    summary: "노트북 배터리 소모 심함", category: "it_device", department: "IT팀", priority: "normal",
    status: "ON_HOLD", requesterId: "u_design", assigneeId: "u_it",
    holdReason: "교체용 배터리 입고 대기", holdResumeDate: "2026-09-25", createdAt: hrsAgo(50) });

  await mk({ title: "복합기 토너 없음", description: "5층 복합기 토너가 떨어졌습니다.",
    summary: "5층 복합기 토너 소진", category: "ga_supplies", department: "총무팀", priority: "normal",
    status: "SUBMITTED", requesterId: "u_design", createdAt: hrsAgo(9) });

  // 완료 / 종료
  const done = await mk({ title: "VPN 계정 잠김 해제", description: "비밀번호 여러 번 틀려 VPN 계정이 잠겼습니다.",
    summary: "VPN 계정 잠금 해제 요청", category: "it_account", department: "IT팀", priority: "high",
    status: "RESOLVED", requesterId: "u_sales", assigneeId: "u_it",
    result: "계정 잠금 해제 및 임시 비밀번호 발급 완료. 로그인 확인했습니다.", createdAt: hrsAgo(30), resolvedAt: hrsAgo(6) });
  await db.requestEvent.create({ data: { requestId: done.id, actorId: "u_it", type: "ASSIGNED",
    payload: JSON.stringify({ to_user_id: "u_it", by: "self" }), createdAt: hrsAgo(26) }});
  await db.requestEvent.create({ data: { requestId: done.id, actorId: "u_it", type: "STATUS_CHANGED",
    payload: JSON.stringify({ from: "SUBMITTED", to: "IN_PROGRESS" }), createdAt: hrsAgo(26) }});
  await db.requestEvent.create({ data: { requestId: done.id, actorId: "u_it", type: "STATUS_CHANGED",
    payload: JSON.stringify({ from: "IN_PROGRESS", to: "RESOLVED", result: done.result }), createdAt: hrsAgo(6) }});

  await mk({ title: "책상 서랍 잠금 수리", description: "책상 서랍이 잠긴 채 안 열립니다.",
    summary: "책상 서랍 잠금 고장", category: "facility_repair", department: "시설팀", priority: "low",
    status: "CLOSED", requesterId: "u_design", assigneeId: "u_fac",
    result: "잠금장치 교체 완료", createdAt: hrsAgo(80), resolvedAt: hrsAgo(40) });

  // 중복 쌍: 원본(열림) + 반려 대상 후보(담당자가 나중에 중복 반려 시연)
  const origin = await mk({ title: "회의실 프로젝터 화면 안 나옴", description: "2층 회의실 프로젝터에 화면이 안 나옵니다.",
    summary: "2층 회의실 프로젝터 화면 불량", category: "facility_repair", department: "시설팀", priority: "high",
    status: "IN_PROGRESS", requesterId: "u_sales", assigneeId: "u_fac", createdAt: hrsAgo(6) });
  await mk({ title: "2층 프로젝터 안 켜져요", description: "2층 회의실 프로젝터가 켜지지 않습니다. 같은 문제 같아요.",
    summary: "2층 프로젝터 전원 문제", category: "facility_repair", department: "시설팀", priority: "normal",
    status: "SUBMITTED", requesterId: "u_design", createdAt: hrsAgo(3) });

  // 반려된 요청 (요청자가 '다시 요청' 시연용)
  const rej = await mk({ title: "개인 노트북 수리 요청", description: "개인적으로 쓰는 노트북이 고장났는데 수리 가능할까요?",
    summary: "개인 노트북 수리 문의", category: "it_device", department: "IT팀", priority: "low",
    status: "REJECTED", requesterId: "u_design", assigneeId: "u_it",
    rejectReason: "회사 지급 장비가 아니어서 사내 IT 지원 대상이 아닙니다. 개인 장비는 외부 A/S를 이용해 주세요.",
    createdAt: hrsAgo(20) });
  await db.requestEvent.create({ data: { requestId: rej.id, actorId: "u_it", type: "STATUS_CHANGED",
    payload: JSON.stringify({ from: "SUBMITTED", to: "REJECTED", reason: rej.rejectReason }), createdAt: hrsAgo(12) }});

  console.log("시드 완료:", await db.request.count(), "요청,", await db.user.count(), "사용자");
}
main().finally(() => db.$disconnect());
