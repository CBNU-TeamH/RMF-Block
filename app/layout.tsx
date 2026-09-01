import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RMF-Block",
  description: "LAN-based real-time document collaboration",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      {/* `h-full`, not `min-h-full`: a min-height leaves the body's own height
          `auto`, so it grows with its content and nothing below it is ever
          bounded — the workspace shell's inner `flex-1 min-h-0 overflow-y-auto`
          panes then never overflow, and the whole page scrolls instead of the
          pane. Measured: the document editor's scroll container reported
          `scrollHeight === clientHeight` (it had grown to fit all 40 blocks)
          while `document.scrollingElement.scrollTop` was 570. */}
      <body className="h-full flex flex-col">{children}</body>
    </html>
  );
}
