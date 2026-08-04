import { eq } from "drizzle-orm";
import { db } from "./db";
import { settings } from "./db/schema";

export async function getSetting(key: string): Promise<string | null> {
  const rows = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  return rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: string) {
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
}

export async function deleteSetting(key: string) {
  await db.delete(settings).where(eq(settings.key, key));
}

export interface TmdbCredential {
  kind: "bearer" | "v3"; // v4 read access token vs classic v3 api key
  value: string;
}

/**
 * TMDB credential, if any: the Settings page value wins, env vars are the
 * fallback. Accepts either TMDB's v4 read access token (a JWT) or a v3 API key.
 */
export async function getTmdbCredential(): Promise<TmdbCredential | null> {
  const stored = await getSetting("tmdb_key").catch(() => null);
  const value =
    stored ?? process.env.TMDB_READ_ACCESS_TOKEN ?? process.env.TMDB_API_KEY ?? null;
  if (!value) return null;
  return { kind: value.startsWith("eyJ") ? "bearer" : "v3", value };
}
