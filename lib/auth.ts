// Single-password auth, kept deliberately simple:
// - AUTH_SECRET env var (any random string) turns the login gate on and signs
//   the session cookie. Unset = no auth (local dev / trusted networks).
// - The password itself lives in the database (settings.app_password_hash,
//   SHA-256), so it's changeable from the Settings page. A fresh deployment
//   with no stored password asks the first visitor to create one.
// Web Crypto only — this must run in both the edge proxy and node.

export const SESSION_COOKIE = "ome_session";

export function authEnabled(): boolean {
  return !!process.env.AUTH_SECRET;
}

export async function sessionToken(): Promise<string | null> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("one-more-episode-session-v1"));
  return hex(sig);
}

export async function sha256Hex(value: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

function hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
