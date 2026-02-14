import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Poker AI Colosseum",
  description: "GTO AI vs Exploit AI - ポーカー最適解を激論",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-background text-foreground">
        <nav className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
          <div className="container mx-auto flex h-14 items-center px-4">
            <a href="/" className="font-bold text-accent">
              Poker AI Colosseum
            </a>
            <div className="ml-8 flex gap-4">
              <a
                href="/"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                The Arena
              </a>
              <a
                href="/lab"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                The Lab
              </a>
            </div>
          </div>
        </nav>
        <main className="container mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
