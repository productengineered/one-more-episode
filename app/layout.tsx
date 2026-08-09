import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import "./globals.css";
import { BottomTabs } from "@/components/BottomTabs";
import { NavLinks } from "@/components/NavLinks";
import { ScrollMemory } from "@/components/ScrollMemory";
import { isAuthenticated } from "@/lib/auth-server";

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
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const authed = await isAuthenticated();
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
            {authed && <NavLinks />}
            {authed && (
              <div className="ml-auto flex items-center gap-1">
                <Link
                  href="/add"
                  aria-label="Add show"
                  className="grid h-10 w-10 place-items-center rounded-full text-2xl text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100 sm:hidden"
                >
                  +
                </Link>
                <Link
                  href="/settings"
                  aria-label="Settings"
                  className="grid h-10 w-10 place-items-center rounded-full text-2xl text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
                >
                  ⚙
                </Link>
              </div>
            )}
          </div>
        </header>
        <main
          className={`mx-auto w-full max-w-5xl flex-1 px-4 pt-6 ${
            authed
              ? "pb-[calc(4.5rem+env(safe-area-inset-bottom))] sm:pb-6"
              : "pb-6"
          }`}
        >
          {children}
        </main>
        {authed && <BottomTabs />}
        <Suspense fallback={null}>
          <ScrollMemory />
        </Suspense>
      </body>
    </html>
  );
}
