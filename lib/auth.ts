// Single-password auth. When APP_PASSWORD is unset, auth is disabled entirely
// (local dev / trusted networks). The session cookie holds an HMAC derived
// from the password, so changing the password invalidates all sessions.
// Web Crypto only — this must run in both the edge proxy and node.

export const SESSION_COOKIE = "ome_session";

export function authEnabled(): boolean {
  return !!process.env.APP_PASSWORD;
}

export async function sessionToken(): Promise<string | null> {
  const pw = process.env.APP_PASSWORD;
  if (!pw) return null;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(pw),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("one-more-episode-session-v1"));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
