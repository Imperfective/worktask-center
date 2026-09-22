import "./globals.css";
import type { Metadata } from "next";
import TopBar from "@/components/TopBar";

export const metadata: Metadata = {
  title: "업무요청 센터",
  description: "사내 업무요청을 ID·상태·담당자·이력을 가진 티켓으로 관리하는 PoC",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;600;700&display=swap" />
      </head>
      <body>
        <TopBar />
        <main className="wrap">{children}</main>
      </body>
    </html>
  );
}
