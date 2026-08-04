// Server-only auth helpers (need cookies + DB, so they can't live in the
// edge-safe lib/auth.ts that the proxy imports).
import { cookies } from "next/headers";
import { authEnabled, SESSION_COOKIE, sessionToken } from "./auth";
import { getSetting } from "./settings";

/** True when the request carries a valid session (or auth is disabled). */
export async function isAuthenticated(): Promise<boolean> {
  if (!authEnabled()) return true;
  const token = await sessionToken();
  return (await cookies()).get(SESSION_COOKIE)?.value === token;
}

export async function getStoredPasswordHash(): Promise<string | null> {
  return getSetting("app_password_hash").catch(() => null);
}
