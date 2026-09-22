// 쿠키 이름만 담는다. 미들웨어는 Edge 런타임에서 돌아
// Prisma 같은 Node 전용 모듈을 끌어오면 통째로 깨진다.
export const SESSION_COOKIE = "wt_session";
