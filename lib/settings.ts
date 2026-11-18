import { eq, sql } from "drizzle-orm";
import { cache } from "react";
import { db } from "./db";
import { settings } from "./db/schema";

// cache(): dedupes repeated reads of the same key within one request —
// several pages ask for the TMDB credential and timezone independently.
export const getSetting = cache(async (key: string): Promise<string | null> => {
  const rows = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  return rows[0]?.value ?? null;
});

export async function setSetting(key: string, value: string) {
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
}

export async function deleteSetting(key: string) {
  await db.delete(settings).where(eq(settings.key, key));
}

/** The user's IANA timezone from Settings, or undefined for the server default. */
export async function getUserTimezone(): Promise<string | undefined> {
  const tz = await getSetting("timezone").catch(() => null);
  return tz ?? undefined;
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

const PLEX_TRACKED_KEY = "plex_tracked_shows";

/** Show ids the user ticked "Track for Plex" on — only these get Plex badges
 * on Upcoming. Stored as a JSON array in settings (no schema migration). */
export async function getPlexTrackedIds(): Promise<Set<number>> {
  const raw = await getSetting(PLEX_TRACKED_KEY).catch(() => null);
  try {
    const ids: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(ids) ? ids.filter((n) => typeof n === "number") : []);
  } catch {
    return new Set();
  }
}

/**
 * Add or remove one show id in a single atomic statement — the Shows grid
 * lets you tick many cards quickly, and a read-modify-write of the JSON
 * array would let concurrent toggles overwrite each other.
 */
export async function setPlexTrackedId(showId: number, isTracked: boolean) {
  // libsql binds JS numbers as REAL; cast so the array stores 5, not 5.0.
  const id = sql`CAST(${Math.trunc(showId)} AS INTEGER)`;
  if (isTracked) {
    await db.run(sql`
      INSERT INTO settings (key, value) VALUES (${PLEX_TRACKED_KEY}, json_array(${id}))
      ON CONFLICT (key) DO UPDATE SET value = CASE
        WHEN EXISTS (SELECT 1 FROM json_each(settings.value) WHERE value = ${id})
          THEN settings.value
        ELSE json_insert(settings.value, '$[#]', ${id})
      END`);
  } else {
    await db.run(sql`
      UPDATE settings
      SET value = (SELECT json_group_array(value) FROM json_each(settings.value) WHERE value != ${id})
      WHERE key = ${PLEX_TRACKED_KEY}`);
  }
}
