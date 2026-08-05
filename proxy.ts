import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, sessionToken } from "./lib/auth";

export async function proxy(req: NextRequest) {
  const expected = await sessionToken();
  if (!expected) return NextResponse.next(); // no APP_PASSWORD -> auth disabled

  const { pathname } = req.nextUrl;
  if (pathname === "/login") return NextResponse.next();
  if (pathname === "/api/cron") return NextResponse.next(); // enforces its own CRON_SECRET
  if (req.cookies.get(SESSION_COOKIE)?.value === expected) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except static assets and PWA files.
  matcher: ["/((?!_next/static|_next/image|icon\\.svg|manifest\\.webmanifest|favicon\\.ico).*)"],
};
