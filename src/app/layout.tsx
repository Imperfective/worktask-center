import "./globals.css";
import type { Metadata, Viewport } from "next";
import TopBar from "@/components/TopBar";

export const metadata: Metadata = {
  title: "업무요청 센터",
  description: "사내 업무요청을 ID·상태·담당자·이력을 가진 티켓으로 관리하는 PoC",
};

// 이게 없으면 모바일 브라우저가 980px 가상 폭으로 그린 뒤 축소해 버린다.
// 반응형 CSS를 아무리 써도 적용되지 않는 원인이 여기다.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css" />
      </head>
      <body>
        <TopBar />
        <main className="wrap">{children}</main>
      </body>
    </html>
  );
}
