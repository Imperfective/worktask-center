# 업무요청 센터 (PoC)

사내 업무요청을 **ID·상태·담당자·이력을 가진 티켓**으로 만들어
요청 누락·중복·진행 상황 확인·처리 기록 부재 네 문제를 구조로 푸는 PoC.

> **동작 중인 서비스 → https://minkyu.app**
> 데모 계정으로 바로 로그인해 요청자·담당자 관점을 모두 볼 수 있습니다 (아래 [데모 계정](#데모-계정)).

| | |
|---|---|
| [로그인과 계정](#로그인과-계정) | 데모 계정·가입 |
| [문제를 어떻게 봤나](#문제를-어떻게-봤나) · [설계 요점](#설계-요점) | 왜 이렇게 만들었나 |
| [시스템 아키텍처](#시스템-아키텍처) · [API 명세](#api-명세) | 어떻게 돌아가나 |
| [품질 검증 (QA)](#품질-검증-qa) | 무엇을 어떻게 확인했나 |
| [실행](#실행) · [구조](#구조) | 직접 돌려보기 |

---

## 문제를 어떻게 봤나

원인을 "메일·메신저라는 **채널**"이 아니라 **"요청이 상태·담당자·식별자를 가진 객체로 존재하지 않는 것"** 으로 봤다.
그래서 새 채널을 하나 더 만드는 대신, 모든 요청을 티켓으로 만드는 데 집중했다.

| 증상 | 근본 원인 | 이 PoC의 대응 |
|---|---|---|
| 요청 누락 | "접수됨"이라는 상태 자체가 없음 | 등록 즉시 ID·접수 상태 부여, 미배정 건은 부서 큐에 항상 노출 |
| 요청 중복 | 기존 요청을 찾아볼 방법이 없음 | 등록 중 유사 건 제안 + "같은 문제로 참여" |
| 진행 상황 확인 어려움 | 담당자 개인 메일함에서 처리 | 요청자·담당자가 같은 상세 화면과 타임라인을 봄 |
| 처리 기록 부재 | 처리 과정이 대화에 묻힘 | 모든 변경을 수정 불가(append-only) 이벤트로 기록 |

네 문제는 독립적이지 않다. 요청이 객체가 되고 상태 전이가 강제되면 누락·가시성·기록이 같은 구조에서 함께 풀린다.
중복만은 구조로 풀리지 않아 **AI를 쓰는 지점**으로 삼았다.

---

## 10분 확인 순서

1. **김영업**으로 `요청하기` → **AI 자동 작성** → `3층 회의실 프로젝터가 안 켜져요. 오후 3시 발표 전에 봐주세요`
   → **버튼을 누르지 않아도** 입력이 멎으면 AI가 제목·카테고리(시설-보수)·긴급도와 **판단 근거 문장**을 채우고
   오른쪽에 비슷한 요청이 함께 뜬다 → 긴급도를 고쳐도 됨 → **요청 등록**
   ⇒ ID와 접수 상태가 부여된다. *(누락·기록)*
2. **이하나**로 전환 → 비슷한 내용 입력 → 오른쪽 **비슷한 요청** 패널에 1번이 뜸 → **같은 문제예요, 참여하기**
   ⇒ 새 요청이 생기지 않고 참여자가 2명이 된다. *(중복)*
3. **박시설**(담당자)로 전환 → `처리할 요청` 미배정 탭 → **내가 맡기**
   ⇒ 배정과 착수가 한 번에 일어나 처리중이 된다. *(누락)*
4. 상세에서 **보류** → 사유 `램프 입고 대기` + 예상 재개일
   ⇒ 요청자 목록 행 아래와 상세에 사유가 보인다. *(가시성)*
5. **처리 재개** → **완료** + 처리 내역 `램프 교체 완료, 정상 작동 확인`
6. **김영업**으로 전환 → 완료 탭 **확인하기** → **확인하고 종료**
   ⇒ 타임라인에 등록·참여·맡기·보류·재개·완료·종료가 시간순으로 남는다. *(기록·가시성)*
7. **최아이티**로 전환 → 중복 건을 **반려**(사유: 중복, 원본 ID 지정)
   ⇒ 반려된 요청의 요청자가 **원본의 참여자로 자동 추가**된다. *(중복)*
8. 반려된 `개인 노트북 수리` 건에서 **다시 요청** → 같은 타임라인에 이어서 처리중으로 복귀 *(기록)*
9. Ollama를 꺼도(`docker stop worktask-ollama`) 1~8이 **규칙 기반으로 그대로** 동작한다. *(AI 의존성 없음)*

---

## 설계 요점

### 상태는 6개, 배정은 상태가 아니다

```
[등록] → 접수 ──(내가 맡기)──→ 처리중 ──(처리 내역)──→ 완료 ──(요청자 확인)──→ 종료
             └──(반려 사유)──→ 반려          ↕ 보류              ↓ 다시 요청
                                반려 ──(다시 요청)──→ 처리중  ←────┘
```

- **"배정"을 별도 상태로 두지 않았다.** 담당자 지정 여부는 담당자 필드로 이미 보이고,
  "내가 맡기" 한 번으로 배정과 착수가 함께 일어나므로 둘 사이에 상태가 있을 필요가 없다.
- **반려는 종착이 아니다.** 요청자가 사유를 적어 다시 요청하면 같은 기록 위에서 처리가 이어진다.
  재등록으로 기록이 끊기는 것을 막기 위해서다.

### 전이 검증은 서버 한 곳에서만

`src/lib/transitions.ts`의 **전이 맵 하나**가 "누가 · 어느 상태에서 · 무엇을 · 무엇을 입력해야" 할 수 있는지를 정의한다.
전이 API와 상세 API의 *허용 액션 목록*이 같은 맵을 참조하므로 화면 버튼과 서버 규칙이 어긋날 수 없다.
규칙이 두 곳에 흩어지는 것이 이런 시스템의 흔한 결함이다.

```
빈 사유로 보류 시도      → "보류 사유을(를) 입력하세요"
담당자가 종료 시도        → "허용되지 않는 전이입니다"  (완료→종료는 요청자 전용)
```

### 기록은 추가만 한다

모든 변경이 `request_events`에 쌓이고 **수정·삭제 API가 없다.**
사유 없는 상태 변경도 없다 — 보류·반려·완료·다시 요청은 입력한 문장이 그대로 타임라인 항목이 된다.

### 제안은 적는 동안 알아서 갱신된다

등록 화면에는 분석을 실행하는 버튼이 없다. 입력이 **700ms** 멎으면 스스로 분석해
제목·카테고리·긴급도·한 줄 요약과 유사 요청을 갱신한다. 내용을 고치면 다시 갱신된다.
"제안을 받으려면 버튼을 눌러야 한다"는 단계가 하나 있으면, 그 단계를 건너뛴 사람은
AI가 없는 것과 같은 화면을 보게 된다.

자동으로 도는 만큼 세 가지를 따로 막았다.

| 문제 | 처리 |
|---|---|
| 사용자가 고친 값을 덮어씀 | 손댄 항목(`touched`)은 이후 분석이 건드리지 않는다. 한 줄 요약만 AI 소유라 항상 갱신 |
| 느린 이전 응답이 최신 결과를 덮음 | 요청마다 순번(`seq`)을 매겨 최신이 아니면 응답을 버린다 |
| 같은 문장을 반복 분석 | 마지막으로 분석한 문장(`lastText`)과 같으면 건너뛴다. 4자 미만도 호출하지 않는다 |

### AI는 제안만, 결정은 사람이

| 지점 | AI가 하는 일 | 사람이 하는 일 |
|---|---|---|
| 요청 등록 | 적는 동안 제목·카테고리·긴급도 + **판단 근거 한 문장** 을 실시간 제안 | 확인·수정 후 등록 (한 줄 요약만 읽기 전용) |
| 중복 감지 | 유사한 열린 요청 최대 3건 제시 | 참여할지 새로 등록할지 선택 |

**자동 배정·자동 완료·긴급도 자동 확정에는 쓰지 않았다.** 잘못된 배정은 누락보다 발견하기 어렵고,
처리 책임이 사람에게 있어야 기록을 신뢰할 수 있기 때문이다.

AI는 **Ollama 로컬 경량 모델**(`qwen2.5:1.5b`)로 돌아 외부 API 키가 필요 없다.
모델이 없거나 실패·타임아웃이면 **규칙 기반 fallback**(키워드 분류 · bigram 유사도)으로 같은 화면이 동작한다.
상세 화면의 *AI 제안 vs 최종 값* 표가 제안 수용률을 드러낸다.

---

## 화면 4개

| 화면 | 사용자 | 푸는 문제 |
|---|---|---|
| **요청하기** | 요청자 | 입구 카드 2개(AI 자동 작성 / 직접 입력) → 제안 카드 → 오른쪽 유사 요청 패널 | 입력 부담, 중복 |
| **내 요청** | 요청자 | 진행 중 / 완료 / 종료·반려 탭. 보류 건은 행 아래 사유, 완료 건은 확인하기 | 가시성 |
| **처리할 요청** | 담당자 | 숫자 3개 + 미배정/내게 할당/보류/완료 탭. 긴급 건 상단 강조, 행에서 바로 맡기 | 누락 |
| **요청 상세** | 양측 | 역할·상태별 액션, 처리 내역·반려 사유 강조, AI 제안 비교, 타임라인, 참여자 | 가시성, 기록 |

---

## 시스템 아키텍처

### 전체 구성

```
 브라우저
    │  HTTPS
    ▼
┌─────────────────────────────────────────────────────────┐
│ Caddy (Docker)                  :80 / :443              │
│  · TLS 자동 발급·갱신                                    │
│  · minkyu.app → reverse_proxy worktask-app:3300         │
└───────────────┬─────────────────────────────────────────┘
                │ 도커 네트워크
                ▼
┌─────────────────────────────────────────────────────────┐
│ worktask-app   Next.js 15 standalone   :3300            │
│  ├ App Router 화면 4개 (요청하기·내 요청·처리할 요청·상세) │
│  ├ Route Handlers = API 10개                             │
│  └ Prisma Client                                         │
└───────┬─────────────────────────────┬───────────────────┘
        │ 파일 I/O                     │ HTTP (worktask 네트워크)
        ▼                             ▼
┌───────────────────┐     ┌─────────────────────────────┐
│ SQLite            │     │ worktask-ollama             │
│ /app/data/app.db  │     │ qwen2.5:1.5b · CPU · 3GB 상한│
│ 도커 볼륨에 영속   │     │ 실패·타임아웃 시 규칙기반 대체 │
└───────────────────┘     └─────────────────────────────┘
```

- **앱 컨테이너는 호스트 포트를 열지 않는다.** Caddy가 도커 네트워크로 직접 붙는다.
  포트를 새로 여는 만큼 노출면이 늘고 충돌 여지도 생기기 때문이다.
- **Ollama는 외부에 노출되지 않는다.** `worktask` 내부 네트워크에만 속해 앱만 호출한다.
- Ollama에 메모리 상한 3GB를 걸어 호스트 자원을 독점하지 않게 했다.

### 요청 한 건이 흐르는 경로

```
[등록]  화면 → POST /api/requests
          → 입력 검증(validate.ts) → 카테고리로 부서 결정
          → requests 1행 INSERT
          → request_events 에 CREATED (+ AI 모드면 AI_SUGGESTED) INSERT
          → { id } 반환 → /r/:id 로 이동

[전이]  화면 → POST /api/requests/:id/transition
          → 전이 맵(transitions.ts)에서 "이 역할이 이 상태에서 이 액션" 이 있는지 확인
          → 필수 입력(사유·처리 내역) 검증
          → requests UPDATE + request_events 에 STATUS_CHANGED INSERT
          → 갱신된 상세 DTO 를 그대로 반환 (화면은 재조회하지 않는다)
```

상태를 바꾸는 모든 API는 **갱신된 상세 DTO를 응답으로 돌려준다.** 화면이 따로 다시
읽지 않아도 되고, 무엇보다 화면이 계산한 상태와 서버 상태가 어긋날 여지가 없다.

### 데이터 모델

```
users ──┬─< requests >──┬─< request_events     (추가 전용 이력)
        │   requesterId │
        └───────────────┴─< request_followers  (참여자, PK = requestId+userId)
            assigneeId
            duplicateOfId ──> requests (중복 반려 시 원본)
```

| 테이블 | 역할 |
|---|---|
| `users` | 가입한 계정. 데모 계정 5명이 시드된다 |
| `requests` | **현재 상태**만 들고 있다 |
| `request_events` | **모든 변경 이력.** 수정·삭제 API가 없는 추가 전용 |
| `request_followers` | 참여자. 복합 PK라 같은 사람이 두 번 들어갈 수 없다 |

`requests`가 현재 상태를, `request_events`가 과정을 나눠 맡는다. 목록·상세는 한 행만
읽으면 되고, "누가 언제 무엇을 왜" 는 이벤트를 순서대로 읽으면 재구성된다.

### 결과가 실제로 쌓이는가 — 운영 환경에서 확인

DB는 도커 볼륨 `worktask-center_worktask-data` 의 `/app/data/app.db` 에 있다.
배포로 컨테이너를 다시 만들어도 볼륨은 유지된다.

운영 API로 요청 한 건을 등록해 **등록 → 배정 → 완료 → 종료**까지 돌린 뒤,
`docker restart worktask-app` 으로 컨테이너를 재시작하고 다시 조회했다.

```
1) POST /api/requests                       → id = 11
2) POST /api/requests/11/assign             → IN_PROGRESS · 담당 박시설
3) POST /api/requests/11/transition resolve → RESOLVED
4) POST /api/requests/11/transition close   → CLOSED
5) docker restart worktask-app  후 재조회   → CLOSED · 이벤트 5건 그대로

   CREATED         김영업  {"title":"[검증] 2층 탕비실 조명 깜빡임", ...}
   ASSIGNED        박시설  {"to_user_id":"u_fac","by":"self"}
   STATUS_CHANGED  박시설  {"from":"SUBMITTED","to":"IN_PROGRESS"}
   STATUS_CHANGED  박시설  {"from":"IN_PROGRESS","to":"RESOLVED","result":"안정기 교체 완료..."}
   STATUS_CHANGED  김영업  {"from":"RESOLVED","to":"CLOSED"}
```

상태 변경뿐 아니라 **행위자와 입력한 문장까지** 이벤트에 남아 재시작 후에도 복원된다.
(위 검증용 요청 #11은 확인 후 삭제했다. 현재 운영 DB는 시드 10건 상태)

### DB 스키마

SQLite. Prisma가 스키마 하나에서 클라이언트 타입과 테이블을 함께 만든다.
Postgres로 옮기려면 `datasource` 의 `provider` 와 `url` 만 바꾸면 된다.

#### 테이블 관계 (ERD)

```
                    ┌──────────────────────────┐
                    │ User                     │
                    │  id            PK  TEXT  │
                    │  email         UQ  TEXT? │──── 로그인 아이디
                    │  passwordHash      TEXT? │──── scrypt 해시 (평문 없음)
                    │  name              TEXT  │
                    │  department        TEXT  │
                    │  isHandler         BOOL  │──── 부서에서 결정
                    │  createdAt         DATE  │
                    └───┬───┬───┬───┬──────┬───┘
      requesterId (1:N) │   │   │   │      │ (1:N) userId
      ┌─────────────────┘   │   │   │      └──────────────┐
      │   assigneeId (1:N)  │   │   │ actorId (1:N)       │
      │   ┌─────────────────┘   │   └──────────┐          │
      │   │                     │              │          │
      ▼   ▼                     │              ▼          ▼
┌──────────────────────┐        │   ┌──────────────────┐ ┌────────────────┐
│ Request              │        │   │ RequestEvent     │ │ Session        │
│  id           PK INT │        │   │  id        PK INT│ │  token   PK TXT│
│  title           TEXT│        │   │  requestId FK ───┼─┤  userId  FK    │
│  description     TEXT│        │   │  actorId   FK    │ │  createdAt DATE│
│  summary         TEXT│        │   │  type      TEXT  │ │  expiresAt DATE│
│  category        TEXT│        │   │  payload   TEXT  │ └────────────────┘
│  department      TEXT│        │   │  createdAt DATE  │   onDelete: Cascade
│  priority        TEXT│        │   └──────────────────┘
│  status          TEXT│        │            ▲
│  requesterId  FK TEXT│        │            │ requestId (1:N)
│  assigneeId   FK TEXT│◄───────┘            │
│  duplicateOfId FK INT│──┐                  │
│  holdReason      TEXT│  │ 자기 참조         │
│  holdResumeDate  TEXT│  │ (중복 반려 시 원본)│
│  result          TEXT│  │                  │
│  rejectReason    TEXT│  │                  │
│  aiSuggestion    TEXT│  │                  │
│  createdAt       DATE│  │                  │
│  updatedAt       DATE│◄─┘                  │
│  resolvedAt      DATE│─────────────────────┘
└──────────┬───────────┘
           │ requestId (1:N)
           ▼
┌──────────────────────────────┐
│ RequestFollower              │
│  requestId  FK ┐             │
│  userId     FK ┘ 복합 PK     │──── 같은 사람이 두 번 들어갈 수 없다
│  via            TEXT         │     register · detail · duplicate
│  createdAt      DATE         │
└──────────────────────────────┘
```

#### 외래키 정리

| 관계 | 컬럼 | 대상 | 의미 | 삭제 동작 |
|---|---|---|---|---|
| Request → User | `requesterId` | `User.id` | 요청을 낸 사람 | 제한 (요청이 있으면 사용자를 못 지움) |
| Request → User | `assigneeId` | `User.id` | 담당자. **nullable** — 미배정 상태가 있다 | 제한 |
| Request → Request | `duplicateOfId` | `Request.id` | 중복 반려 시 원본. **자기 참조** | 제한 |
| RequestEvent → Request | `requestId` | `Request.id` | 어느 요청의 이력인가 | 제한 |
| RequestEvent → User | `actorId` | `User.id` | 누가 한 일인가 | 제한 |
| RequestFollower → Request | `requestId` | `Request.id` | 참여 대상 | 제한 |
| RequestFollower → User | `userId` | `User.id` | 참여자 | 제한 |
| Session → User | `userId` | `User.id` | 세션 주인 | **Cascade** — 사용자를 지우면 세션도 사라진다 |

세션만 Cascade다. 나머지는 기본 동작(제한)이라 **사용자를 지우려 해도 그 사람의 요청과
이력이 남아 있으면 막힌다.** 기록이 사람 삭제로 끊기면 안 되기 때문이다.
퇴사자 처리가 필요하면 행을 지우는 대신 비활성 플래그를 두는 쪽이 맞다.

#### 제약과 인덱스

| 종류 | 대상 | 이유 |
|---|---|---|
| UNIQUE | `User.email` | 같은 이메일로 두 번 가입 못 하게 |
| 복합 PK | `RequestFollower(requestId, userId)` | 중복 참여를 **DB가** 막는다. 앱 코드가 빠뜨려도 안전 |
| PK | `Session.token` | 토큰 자체가 키라 조회가 한 번에 끝난다 |
| INDEX | `Session.userId` | 사용자별 세션 정리용 |

`RequestFollower` 의 복합 PK 가 좋은 예다. "이미 참여 중인지" 를 앱에서 확인하지만,
확인을 빠뜨려도 DB 가 거절한다. 규칙을 두 겹으로 두는 편이 낫다.

#### 왜 현재 상태와 이력을 나눴나

`Request` 는 **지금 상태**만, `RequestEvent` 는 **거쳐온 과정**을 맡는다.

- 목록·상세는 `Request` 한 행만 읽으면 된다. 이력을 접어 계산할 필요가 없다.
- `RequestEvent` 에는 **수정·삭제 API 가 없다.** 추가만 한다.
- `payload` 는 JSON 문자열이다. 이벤트 종류마다 담을 내용이 달라
  (`{"from","to"}` · `{"reason","resume_date"}` · `{"result"}` · `{"suggestion","accepted"}`)
  컬럼으로 못 박으면 종류가 늘 때마다 스키마가 바뀐다.

이 구조 덕에 **AI 제안 수용률** 같은 지표를 나중에 코드 변경 없이 계산할 수 있다.
`AI_SUGGESTED` 이벤트에 제안값과 최종 채택 여부가 함께 들어 있기 때문이다.

#### 마이그레이션

개발은 `prisma db push` 로 스키마를 맞춘다. 운영 DB 는 이미 데이터가 있어
**추가만 하는 DDL** 로 올린다 (`prisma/upgrade-auth.mjs`).

```
ALTER TABLE User ADD COLUMN email TEXT
ALTER TABLE User ADD COLUMN passwordHash TEXT
ALTER TABLE User ADD COLUMN createdAt DATETIME
CREATE UNIQUE INDEX User_email_key ON User(email)
CREATE TABLE Session (...)
→ 기존 5개 계정에 이메일·비밀번호 해시를 채운다
```

기존 행을 지우지 않는다. 요청·이력이 `User.id` 를 참조하고 있어
사용자를 다시 만들면 그 참조가 전부 끊기기 때문이다.

---

## 로그인과 계정

### 인증 방식

| | |
|---|---|
| 비밀번호 | `scrypt` (Node 내장, salt 16바이트 · 키 64바이트). **평문은 저장하지 않는다** |
| 세션 | 랜덤 32바이트 토큰을 `Session` 테이블에 저장 |
| 쿠키 | `wt_session` · **HttpOnly** · `SameSite=Lax` · 운영에서 `Secure` · 14일 |
| 비교 | `timingSafeEqual` — 바이트가 몇 개까지 맞는지 시간으로 새지 않게 |

**세션을 DB 행으로 둔 이유**는 로그아웃 때문이다. 토큰에 정보를 담아 서명만 하는
방식이면 로그아웃은 "브라우저에서 쿠키를 지운다"에 그친다. 이미 복사된 토큰은
만료까지 살아 있다. 행을 지우면 **서버가 즉시 거절**한다 (QA H9).

**쿠키는 HttpOnly 라 스크립트가 읽지 못한다.** 이전에는 `x-user-id` 헤더로 사용자를
정했는데, 그건 헤더 한 줄을 바꾸는 것만으로 남의 계정이 된다는 뜻이었다.

### 담당자 여부는 부서가 정한다

가입 폼에 "담당자로 가입" 체크박스를 두지 않았다. 체크하면 누구나 담당자가 되어
남의 부서 요청 큐를 볼 수 있기 때문이다. 서버가 **부서만 보고** 결정한다.

```
시설팀 · IT팀 · 총무팀  →  처리 담당 (해당 부서 큐를 본다)
그 밖의 부서            →  요청자
```

본문에 `isHandler: true` 를 실어 보내도 무시된다 (QA H6).

### 데모 계정

**모두 가상 인물이고, 공개된 데모 비밀번호다.** 실제 자격 증명이 아니다.

비밀번호는 모두 `worktask1234`

#### 시설팀 (시설 관리) 및 처리 담당 부서

| 이메일 | 이름 | 부서 | 역할 |
|---|---|---|---|
| `fac@example.com` | 박시설 | **시설팀** | 처리 담당 — 시설 보수·설비 요청을 받는다 |
| `it@example.com` | 최아이티 | IT팀 | 처리 담당 — 장애·장비·계정 요청을 받는다 |
| `ga@example.com` | 정총무 | 총무팀 | 처리 담당 — 비품 요청을 받는다 |

#### 이외 팀 (요청자)

| 이메일 | 이름 | 부서 | 역할 |
|---|---|---|---|
| `sales@example.com` | 김영업 | 영업팀 | 요청자 — 요청 등록·진행 확인·종료 |
| `design@example.com` | 이하나 | 디자인팀 | 요청자 |

로그인 화면의 계정 칩을 누르면 바로 채워진다.
회원가입으로 새 계정을 만들어도 되고, 담당 부서를 고르면 그 부서 큐가 보인다.

---

---

## API 명세

모든 엔드포인트는 `application/json` 을 주고받는다. **외부 API 키가 없다.**

### 인증

**세션 쿠키**로만 사용자가 정해진다. 클라이언트가 보내는 값으로 신원을 정하지 않는다.

```
POST /api/auth/signup   { email, password(8자+), name, department }  → 가입 + 자동 로그인
POST /api/auth/login    { email, password }                          → 세션 발급
POST /api/auth/logout                                                → 서버에서 세션 삭제
GET  /api/auth/me                                                    → 현재 로그인 계정
```

- 성공하면 `Set-Cookie: wt_session=… ; HttpOnly; SameSite=Lax; Secure(운영)` 이 내려온다.
- 로그인 실패는 **없는 계정과 틀린 비밀번호를 구분하지 않는다.** 구분해 알려주면
  응답만으로 계정 존재 여부를 알아낼 수 있다 (QA H4).
- 권한은 매 요청마다 서버가 DB 에서 다시 판정한다. 요청의 담당 부서와 사용자의
  부서·담당자 여부를 대조해 역할(`handler` / `requester`)을 정한다(`serve.ts` 의 `rolesFor`).
- 세션 없이 호출한 모든 API 는 **401** (QA H1·H2). 화면은 미들웨어가 `/login` 으로 보낸다.

#### `GET /api/members?dept=`
배정 드롭다운용. 그 부서의 담당자 목록을 **DB 에서** 구한다 — 가입으로 담당자가 늘면
코드 수정 없이 배정 대상에 들어온다. → `{ members: [{ id, name, department }] }`

### 공통 응답

| 상황 | 코드 | 본문 |
|---|---|---|
| 성공 | 200 | 엔드포인트별 DTO |
| 입력·규칙 위반 | 400 | `{ "error": "사람이 읽을 한국어 메시지" }` |
| 권한 없음 | 403 | `{ "error": "..." }` |
| 대상 없음 | 404 | `{ "error": "요청을 찾을 수 없습니다" }` |

오류 메시지는 화면에 그대로 표시된다. 그래서 `"invalid request"` 같은 말 대신
`"원본 요청 #999999 을(를) 찾을 수 없습니다"` 처럼 무엇을 고쳐야 할지 적는다.

### 엔드포인트

#### `GET /api/users`
요청자·담당자 이름 표시용. **비밀번호 해시와 이메일은 내보내지 않는다** (QA H11).
→ `{ users: [{ id, name, department, isHandler }] }`

#### `GET /api/requests?view=&tab=`
| 파라미터 | 값 | 의미 |
|---|---|---|
| `view` | `mine`(기본) | 내가 낸 것 + 내가 참여 중인 것 |
| | `queue` | 내 부서로 접수된 것 (담당자용) |
| `tab` | mine: `progress` `resolved` `closed` | 진행 중 / 완료 / 종료·반려 |
| | queue: `unassigned` `mine` `hold` `resolved` | 미배정 / 내게 할당 / 보류 / 완료 |

→ `{ items: [...] }`. 정렬은 **긴급도 → 최근 업데이트순**.

```json
{ "id": 24, "title": "사내 그룹웨어 접속 불가", "summary": "그룹웨어 전사 접속 장애",
  "category": "it_incident", "department": "IT팀", "priority": "urgent", "status": "SUBMITTED",
  "requesterId": "u_sales", "assigneeId": null, "duplicateOfId": null,
  "holdReason": null, "holdResumeDate": null, "result": null, "rejectReason": null,
  "followerCount": 0, "requesterName": "김영업", "assigneeName": null,
  "createdAt": "...", "updatedAt": "...", "resolvedAt": null }
```

#### `POST /api/requests` — 등록
```json
{ "title": "1~120자", "description": "1~500자", "category": "<6개 키 중 하나>",
  "priority": "low|normal|high|urgent", "summary": "0~200자",
  "mode": "ai|manual", "aiSuggestion": {...}|null, "acceptedFields": {...} }
```
→ `{ "id": 11 }` · 부서는 카테고리에서 서버가 정한다(본문으로 못 바꾼다) · 상태는 항상 `SUBMITTED`

거절: 제목·본문 공백 또는 길이 초과, 미지정 카테고리·긴급도, 깨진 JSON → 400
`aiSuggestion` 을 보내면 `AI_SUGGESTED` 이벤트가 함께 남아 **제안 수용률**을 나중에 계산할 수 있다.

#### `GET /api/requests/:id` — 상세
요청 필드 전체 + 아래를 덧붙여 돌려준다.

| 필드 | 내용 |
|---|---|
| `requester` `assignee` `followers` | 이름까지 펼친 사람 정보 |
| `timeline[]` | `{ id, type, actor, actorId, payload, at }` 시간순 |
| `viewer` | `{ id, role, isRequester, isFollower }` — 서버가 판정한 역할 |
| `allowedActions[]` | `{ action, label, needs[], reasonLabel }` — **이 사람이 지금 할 수 있는 것** |
| `canComment` `canFollow` | 코멘트·참여 가능 여부 |

`allowedActions` 가 핵심이다. **화면은 버튼을 스스로 판단하지 않고 이 배열만 그린다.**
전이 API도 같은 전이 맵을 보므로 버튼과 서버 규칙이 어긋날 수 없다.

```json
"allowedActions": [
  { "action": "hold",     "label": "보류",      "needs": ["reason","resumeDate"], "reasonLabel": "보류 사유" },
  { "action": "reject",   "label": "반려",      "needs": ["reason"],  "reasonLabel": "반려 사유" },
  { "action": "reassign", "label": "담당 변경", "needs": ["member"] },
  { "action": "resolve",  "label": "완료",      "needs": ["result"],  "reasonLabel": "처리 내역" } ]
```

#### `POST /api/requests/:id/transition` — 상태 전이
```json
{ "action": "hold|resume|resolve|close|reopen|reject",
  "reason": "보류·반려·다시요청 사유", "result": "완료 시 처리 내역",
  "resumeDate": "YYYY-MM-DD", "duplicateOfId": 8 }
```
→ 갱신된 **상세 DTO**

| 거절 | 코드 |
|---|---|
| 이 역할·상태에서 허용되지 않는 액션 | 400 |
| 요청자 액션인데 당사자가 아님 | 403 |
| 필수 사유·처리 내역 누락(공백 포함) | 400 |
| 배정 계열(`assign_self` `assign_member` `reassign`) | 400 — 배정 API 전담 |
| `duplicateOfId` 가 없는 번호·자기 자신·이미 종료된 요청 | 400 |

#### `POST /api/requests/:id/assign` — 배정·담당 변경
```json
{ "toUserId": "u_fac" }     // 생략하면 호출자 본인 (= 내가 맡기)
```
→ 갱신된 상세 DTO · `SUBMITTED` 면 **배정과 착수가 함께** 일어나 `IN_PROGRESS` 가 된다

거절: 담당자 아님 403 · 대상이 그 부서 담당자가 아님 400 · **완료·종료·반려 상태** 400 · 이미 같은 담당자 400

#### `POST /api/requests/:id/comments`
`{ "body": "1~1000자" }` → 상세 DTO · 종료된 요청은 400

#### `POST /api/requests/:id/follow` — 같은 문제로 참여
`{ "via": "register|detail|duplicate" }` → 상세 DTO
본인 요청 400 · 종료·반려 상태 400 · **이미 참여 중이면 이력을 남기지 않는다**

#### `POST /api/ai/analyze` — 제안 + 유사 요청
```json
{ "text": "1~2000자", "mode": "ai|manual" }
```
```json
{ "suggestion": { "title": "...", "category": "facility_repair", "urgency": "urgent",
                  "urgency_reason": "판단 근거 한 문장", "summary": "...",
                  "source": "ollama|rule" },
  "similar": [ { "id": 8, "title": "...", "status": "IN_PROGRESS", "priority": "high",
                 "assigneeName": "박시설", "followerCount": 2, "score": 42 } ] }
```

- **등록 화면이 입력 700ms마다 자동 호출한다.** 누르는 버튼이 없다.
- `mode: "manual"` 이면 `summary` 만 채우고 제목·카테고리·긴급도는 비운다.
- 유사 요청은 열린 상태 + 완료 건에서, **본인 요청은 빼고**, Dice 계수 0.18 이상 상위 3건.
- `source` 가 `ollama` 인지 `rule` 인지 응답에 담긴다. 모델이 죽어도 200으로 답한다.

#### `GET /api/stats`
→ `{ "todayCount": 2, "avgResolveHours": 40, "unassignedUrgent": 0 }` (호출자 부서 기준)


## 품질 검증 (QA)

예외 케이스를 사람이 매번 클릭해 확인하면 빠뜨린다. API를 직접 두드리는
**68건 시나리오 스위트**를 만들어 규칙이 서버에서 실제로 강제되는지 확인한다.

```bash
npm run qa            # 전용 DB(prisma/qa.db) + 3310 포트로 격리 실행
npm run qa -- H       # 접두사로 특정 그룹만 (A 기본 / B 등록검증 / C 권한 / D 전이 / E 중복참여 / F AI / G 목록)
```

개발용 `dev.db`는 건드리지 않는다. 끝나면 서버와 DB를 정리한다.

| 그룹 | 건수 | 무엇을 보나 |
|---|---|---|
| A 기본 | 4 | 시드·목록·통계·비로그인 차단 |
| **H 인증** | **11** | **비로그인 차단·로그인 실패·세션 쿠키·권한 상승·로그아웃·정보 유출** |
| B 등록검증 | 9 | 공백 제목, 미지정 카테고리·긴급도, 길이 초과, 깨진 JSON |
| C 권한 | 5 | 타 부서 담당자, 요청자의 배정 시도, 부서 외 대상 |
| D 전이 | 17 | 전이 맵 위반, 필수 입력 누락, 종료 이후 변경, API 우회 |
| E 중복참여 | 10 | 본인 참여, 중복 이력, 없는 원본·자기 참조 원본 |
| F AI | 6 | 빈 입력, 허용값 밖 분류, 본인 요청 제외, 초장문 |
| G 목록 | 7 | 부서 격리, 긴급 정렬, 404, 타임라인 순서 |


### 시나리오 68건 전체

`t(id, 그룹, 이름)` 으로 등록된 케이스 그대로다. 정상 흐름은 최소한만 두고
**예외 경로에 무게를 실었다.**

<details>
<summary><b>A 기본 (4건)</b> — 시드·목록·통계·미인증</summary>

| ID | 확인하는 것 |
|---|---|
| A1 | 사용자 5명이 시드된다 |
| A2 | 내 요청 목록이 배열로 온다 |
| A3 | 부서 통계가 숫자 3개로 온다 |
| A4 | 로그인 없이 목록을 볼 수 없다 |
</details>

<details>
<summary><b>H 인증 (11건)</b> — 로그인·세션·권한 상승</summary>

| ID | 확인하는 것 |
|---|---|
| H1 | 모든 쓰기 API가 비로그인을 막는다 |
| H2 | 모든 읽기 API가 비로그인을 막는다 |
| H3 | 틀린 비밀번호는 401 |
| H4 | 없는 계정과 틀린 비밀번호의 응답이 구분되지 않는다 |
| H5 | 세션 쿠키는 HttpOnly 로 내려온다 |
| H6 | 가입 시 담당자 여부는 부서가 정한다 |
| H7 | 담당 부서로 가입하면 담당자가 되고 부서 큐가 보인다 |
| H8 | 가입 입력 검증 |
| H9 | 로그아웃하면 세션이 서버에서 무효가 된다 |
| H10 | 위조한 세션 토큰은 통하지 않는다 |
| H11 | 사용자 목록에 비밀번호 해시·이메일이 실리지 않는다 |
</details>

<details>
<summary><b>B 등록 검증 (9건)</b> — 잘못된 값이 DB에 들어가지 않는가</summary>

| ID | 확인하는 것 |
|---|---|
| B1 | 제목 누락은 400 |
| B2 | 본문 누락은 400 |
| B3 | 카테고리 누락은 400 |
| B4 | 공백뿐인 제목은 400 |
| B5 | 알 수 없는 카테고리는 400 |
| B6 | 알 수 없는 긴급도는 400 |
| B7 | 본문 500자 초과는 400 |
| B8 | 깨진 JSON 본문은 500이 아니라 400 |
| B9 | 정상 등록 시 부서가 카테고리에서 자동 배정된다 |
</details>

<details>
<summary><b>C 권한 (5건)</b> — 헤더를 바꿔도 못 하는 것</summary>

| ID | 확인하는 것 |
|---|---|
| C0 | 권한 시나리오용 요청 준비 |
| C1 | 타 부서 담당자는 배정할 수 없다 |
| C2 | 요청자는 배정할 수 없다 |
| C3 | 부서 담당자가 아닌 대상에는 배정할 수 없다 |
| C4 | 존재하지 않는 사용자에게는 배정할 수 없다 |
</details>

<details>
<summary><b>D 상태 전이 (16건)</b> — 전이 맵이 서버에서 실제로 강제되는가</summary>

| ID | 확인하는 것 |
|---|---|
| D1 | 접수 상태에서 바로 완료 처리할 수 없다 |
| D2 | 배정하면 처리중이 되고 담당자가 기록된다 |
| D3 | transition으로 배정하면 담당자 없는 처리중이 되면 안 된다 |
| D4 | 보류는 사유 없이 불가 |
| D5 | 보류 → 재개 → 완료 → 종료가 이어진다 |
| D6 | 재개 후 보류 사유가 지워진다 |
| D7 | 완료는 처리 내역 없이 불가 |
| D8 | 종료된 요청에는 코멘트를 달 수 없다 |
| D9 | 종료된 요청은 더 전이되지 않는다 |
| D10 | 종료된 요청의 담당자는 바꿀 수 없다 |
| D11 | 요청 당사자가 아니면 종료할 수 없다 |
| D12 | 반려 → 다시 요청이 처리중으로 되돌린다 |
| D13 | 다시 요청은 사유 없이 불가 |
| D14 | 알 수 없는 액션은 400 |
| D15 | 담당자가 직접 낸 요청도 본인이 종료할 수 있다 |
| D16 | transition으로 담당 변경을 우회할 수 없다 |
</details>

<details>
<summary><b>E 중복·참여 (10건)</b> — 중복 반려와 참여자 자동 추가</summary>

| ID | 확인하는 것 |
|---|---|
| E0 | 중복 시나리오용 원본/중복 요청 준비 |
| E1 | 본인 요청에는 참여할 수 없다 |
| E2 | 타인 요청에 참여하면 참여자에 들어간다 |
| E3 | 같은 사람이 두 번 참여해도 이력은 하나다 |
| E4 | 중복 반려하면 요청자가 원본의 참여자가 된다 |
| E5 | 반려된 요청에는 참여할 수 없다 |
| E6 | 존재하지 않는 원본으로 중복 반려하면 400 |
| E7 | 자기 자신을 원본으로 지정할 수 없다 |
| E8 | 같은 사람의 요청을 원본으로 지정해도 본인 참여는 생기지 않는다 |
| E9 | 잘못된 형식의 원본 ID는 400 |
</details>

<details>
<summary><b>F AI (6건)</b> — 모델이 무엇을 내놓든 화면이 깨지지 않는가</summary>

| ID | 확인하는 것 |
|---|---|
| F1 | 빈 텍스트 분석은 400 |
| F2 | 제안 카테고리·긴급도가 허용값 안에 있다 |
| F3 | 직접 입력 모드는 요약만 만든다 |
| F4 | 유사 요청에 본인 요청은 포함되지 않는다 |
| F5 | 아주 긴 입력에도 죽지 않는다 |
| F6 | text 필드 누락은 500이 아니라 400 |
</details>

<details>
<summary><b>G 목록·정렬 (7건)</b> — 부서 격리와 정렬</summary>

| ID | 확인하는 것 |
|---|---|
| G1 | 처리할 요청 큐에는 본인 부서만 보인다 |
| G2 | 긴급 요청이 목록 맨 앞에 온다 |
| G2b | 코멘트 1000자 초과는 400 |
| G3 | 없는 요청 상세는 404 |
| G4 | 숫자가 아닌 요청 id는 500이 아니라 404 |
| G5 | 코멘트 빈 내용은 400 |
| G6 | 타임라인이 시간순 추가 전용으로 쌓인다 |
</details>

### 자동 스위트로 잡히지 않는 것 — 손으로 확인한 항목

API 스위트는 서버 규칙만 본다. 화면 동작과 배포 상태는 따로 확인했다.

| 항목 | 방법 | 결과 |
|---|---|---|
| 자동 분석이 버튼 없이 도는가 | 한 글자씩 36자 입력 후 상태 확인 | 제목·카테고리·긴급도·요약 + 유사 요청 3건 |
| 사용자가 고친 값을 덮지 않는가 | 긴급도·제목을 바꾼 뒤 본문 추가 입력 | 두 값 유지, 요약만 갱신 |
| 느린 응답이 최신 결과를 덮지 않는가 | A 분석 중 B로 교체 | 최신 입력 기준으로 정착 |
| 오류가 화면에 보이는가 | 반려 모달에 없는 원본 ID 입력 | 모달 안에 한국어 메시지 |
| 모바일 레이아웃 | iframe에 실제 폭을 주고 `scrollWidth - innerWidth` | 280~1440px 9개 폭에서 넘침 0 |
| 드롭다운을 연 상태의 넘침 | 같은 방법, 팝오버 열고 측정 | 9개 폭 모두 0 |
| DB 영속 | 운영 API로 생애주기 1회전 + 컨테이너 재시작 | 상태·이벤트 5건 그대로 |
| Ollama 경로 | 운영 API 호출해 `source` 확인 | `source: "ollama"` |
| 규칙 기반 대체 경로 | 모델 없는 로컬에서 같은 입력 | `source: "rule"` 로 동일 화면 |
| 배포 후 사이트 응답 | 재배포 직후 HTTPS 응답 확인 | 200 |

### 첫 실행에서 나온 결함 12건과 수정

전부 **정상 흐름이 아니라 예외 경로**에서 나왔다.

| # | 증상 | 원인 | 수정 |
|---|---|---|---|
| 1 | 공백뿐인 제목이 등록됨 | `!title`만 검사 | `trim()` 후 검사 (`src/lib/validate.ts`) |
| 2 | 없는 카테고리가 IT팀으로 배정됨 | `deptOfCategory`의 기본값이 조용히 삼킴 | 허용 키 검증 후 400 |
| 3 | `priority:"banana"`가 저장됨 | 긴급도 미검증 | 허용값 검증 후 400 |
| 4 | **긴급 요청이 목록 2번째로 밀림** | 3의 결과. `PRIORITY_ORDER.indexOf`가 `-1`을 돌려 맨 앞에 정렬 | 3으로 해소 |
| 5 | 본문 5000자가 그대로 저장됨 | 서버 길이 제한 없음 (화면만 500자) | 길이 상한 |
| 6 | 깨진 JSON에 500 | `req.json()` 미보호 | `readJson()` → 400 |
| 7 | **담당자 없는 "처리중"이 생성됨** | `transition` API가 배정 액션까지 받아 상태만 바꿈 | 배정 계열은 `assign` API 전담, transition은 400 |
| 8 | **종료된 요청의 담당자가 바뀜** | `assign`이 전이 맵을 안 봄 | `findRule`로 현재 상태 확인 |
| 9 | 참여 버튼을 두 번 누르면 타임라인 2줄 | 이미 참여 중인지 확인 없이 이벤트 기록 | 신규일 때만 기록 |
| 10 | 없는 원본 ID로 중복 반려 시 500 | FK 제약 위반이 그대로 노출 | 사전 조회 후 400 |
| 11 | 자기 자신을 원본으로 지정 가능 | 검사 없음 | 자기 참조·동일 요청자 차단 |
| 12 | `/api/requests/abc`에 500 | `Number("abc")=NaN`이 Prisma까지 감 | `reqId()`로 404 |

### 반응형

시안이 `min-width:900px` 데스크톱 전용이라 모바일 동작은 직접 설계했다.
**가장 큰 원인은 CSS가 아니라 `viewport` 메타 태그가 없던 것** — 모바일 브라우저가
980px 가상 폭으로 그린 뒤 축소하므로 미디어 쿼리가 아예 적용되지 않았다.

| 폭 | 바뀌는 것 |
|---|---|
| ~980px | 본문 2단 → 1단 (유사 요청·타임라인 사이드바가 아래로), 사이드바 sticky 해제 |
| ~900px | 날짜·PoC 숨김 (상단바가 비좁아 날짜가 두 줄로 접혔다) |
| ~700px | 상단바 2줄(로고+사용자 / 가로 스크롤 내비), 표는 제목·상태·액션만, 탭 가로 스크롤, 입력 글꼴 16px, 사용자 드롭다운은 헤더 아래 전체 폭 |
| ~380px | 브랜드명 숨기고 로고만 |

- **입력 글꼴 16px**: iOS Safari는 16px 미만 입력란에 포커스하면 화면을 확대해 버린다.
- **`th{width:auto!important}`**: 열 폭이 인라인 스타일이라 미디어 쿼리로는 못 푼다.
  풀지 않으면 좁은 화면에서 제목 열이 눌려 어절마다 줄바꿈된다.
- 통계 카드의 `minWidth:104`도 같은 이유로 클래스(`.stat`)로 옮겼다.
- **`position:absolute`의 기준은 뷰포트가 아니라 가장 가까운 배치된 조상이다.**
  사용자 드롭다운에 `left/right:14px`를 줬더니 기준이 93px짜리 칩 래퍼여서
  폭 66px·높이 583px로 찌그러지고, 그 튀어나온 만큼 상단바에 가로 스크롤이 생겼다.
  래퍼를 `position:static`으로 돌려 sticky 헤더를 기준으로 삼고 `top:100%`로 헤더 아래에 붙였다.
- 검증은 iframe에 실제 폭을 주고 `scrollWidth - innerWidth`로 쟀다.
  드롭다운을 **연 상태로** 280 · 320 · 360 · 390 · 600 · 768 · 900 · 1024 · 1440px에서 가로 넘침 0.

### QA 중 화면에서 추가로 발견한 것

| 증상 | 원인 | 수정 |
|---|---|---|
| **담당자가 직접 낸 요청이 완료 상태에 갇힘** | 역할을 하나로만 판정해, 시설팀 담당자가 낸 시설 요청에 *종료* 액션이 아무에게도 안 보임 | `rolesFor()` — 담당자이면서 요청자인 경우 두 역할의 액션을 합친다 |
| 필드 없는 액션(내가 맡기·재개·종료)이 실패해도 **아무 반응이 없음** | `run()`에 catch가 없어 서버 400이 조용히 버려짐 | 오류 배너 + 재조회 |
| 오류가 `alert()`로만 표시 | 흐름이 끊기고 어떤 필드 문제인지 모름 | 모달·화면 내 인라인 메시지로 교체 (`alert` 0건) |
| 첫 방문 시 부서 배지가 빈칸 | `localStorage`를 직접 읽어 기본값이 없음 | `getUserId()` 사용 |
| 상단 로고·상단바 치수가 시안과 다름 | 마크를 임의로 그림 | 시안의 워드마크 SVG 원본과 수치(58px·22px·1392px) 적용 |

---

## 실행

```bash
npm install
npx prisma db push && npm run db:seed
npm run dev                 # http://localhost:3300
npm run qa                  # 예외 케이스 스위트 68건
```

Docker로:

```bash
docker compose up -d --build
docker exec worktask-ollama ollama pull qwen2.5:1.5b   # AI를 쓸 때만. 없어도 동작한다
```

환경변수는 `.env.example` 참고. **API 키가 필요 없다.**

---

## 구조

```
src/lib/domain.ts        상태·카테고리(6)·긴급도(4)·시드 사용자 — 단일 출처
src/lib/transitions.ts   전이 맵 — 누가 어느 상태에서 무엇을 할 수 있는가
src/lib/ai.ts            Ollama 호출 + 규칙 기반 fallback(키워드·bigram)
src/lib/serve.ts         사용자 식별·역할 판정(복수 역할)·이벤트 기록·상세 DTO
src/lib/validate.ts      입력 검증·id 파싱·JSON 파싱 — 라우트 공용
src/lib/password.ts      scrypt 해시·검증 (Next 런타임 비의존 — 시드에서도 쓴다)
src/lib/auth.ts          세션 발급·조회·파기, 세션 쿠키
src/middleware.ts        세션 쿠키 없는 화면 접근을 /login 으로

src/app/api/requests     GET 목록(내 요청/부서 큐) · POST 등록
src/app/api/requests/[id]            GET 상세 DTO (허용 액션 포함)
src/app/api/requests/[id]/assign     POST 배정·담당 변경
src/app/api/requests/[id]/transition POST 상태 전이
src/app/api/requests/[id]/comments   POST 코멘트
src/app/api/requests/[id]/follow     POST 같은 문제로 참여
src/app/api/ai/analyze   POST 자연어 → 제안 + 유사 요청
src/app/api/stats        GET 오늘 접수 · 평균 처리 시간 · 미배정 긴급
src/app/api/users        GET 사용자 목록(이름 표시용)
src/app/api/members      GET 부서 담당자 목록(배정 대상)
src/app/api/auth/{signup,login,logout,me}  가입·로그인·로그아웃·현재 계정

src/app/                 요청하기 / my(내 요청) / queue(처리할 요청) / r/[id](상세)
prisma/schema.prisma     4테이블 (users · requests · request_events · request_followers)
prisma/seed.ts           열린 요청 · 완료 · 종료 · 중복 쌍 · 반려 건
docs/DECISIONS.md        판단 기록 — 무엇을 왜 그렇게 정했나 (번복 포함)
docs/AI_LOG.md           AI 활용 기록 — AI 결과에서 고친 것
qa/run.mjs               예외 케이스 시나리오 68건 (의존성 없음)
qa/run.sh                전용 DB·포트로 격리 실행
docs/시안_주석.html       기획 의도가 주석으로 달린 화면 시안 (설계 근거)
```

## 의도적으로 넣지 않은 것

| 항목 | 이유 | 대체 |
|---|---|---|
| SSO·소셜 로그인 | 이메일 로그인으로 흐름 검증에 충분 | 이메일+비밀번호 가입·로그인 |
| 메일·메신저 알림 | 원인이 채널이 아니라고 판단 | 화면 내 상태 표시 |
| 첨부파일 | 스토리지 필요, 핵심 흐름과 무관 | 텍스트 설명 |
| SLA·에스컬레이션 | 합의된 기준 없이 임의 시간은 의미 없음 | 긴급도 필드만 |
| 부서 재라우팅 | 화면·전이·이벤트가 느는 데 비해 시연할 장면 없음 | 반려 사유로 안내 후 재등록 |
| 통계 대시보드 | 데이터가 쌓인 뒤에 가치 생김 | 숫자 3개까지만 |

이벤트 로그만으로 계산 가능한 **중복 감지율**과 **AI 제안 수용률**이 실제 도입 시 가장 먼저 만들 지표다.
