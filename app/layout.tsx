import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import "./globals.css";
import { NavLinks } from "@/components/NavLinks";
import { ScrollMemory } from "@/components/ScrollMemory";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "One More Episode",
  description: "Self-hosted TV show tracker — the lie we all tell at 1am",
  appleWebApp: { capable: true, title: "One More Ep", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* suppressHydrationWarning: browser extensions (e.g. ColorZilla) inject
          attributes into <body> before hydration; only this element's attribute
          mismatches are ignored, children are still validated. */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <header className="sticky top-0 z-20 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur">
          <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-6 px-4">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-violet-600 text-sm">
                ▶
              </span>
              One More Episode
            </Link>
            <NavLinks />
            <Link
              href="/settings"
              aria-label="Settings"
              className="ml-auto grid h-10 w-10 place-items-center rounded-full text-2xl text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
            >
              ⚙
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
        <Suspense fallback={null}>
          <ScrollMemory />
        </Suspense>
      </body>
    </html>
  );
}
