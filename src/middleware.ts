import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-cookie";

// 세션 쿠키가 없으면 화면은 /login 으로 보낸다.
// 쿠키 유효성까지는 여기서 보지 않는다 — 미들웨어는 DB 를 읽을 수 없고,
// 실제 판정은 각 API 와 페이지가 서버에서 다시 한다.
const PUBLIC = ["/login"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (req.cookies.get(SESSION_COOKIE)) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // API·정적 자산은 제외한다. API 는 각자 401 로 답해야 한다.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
