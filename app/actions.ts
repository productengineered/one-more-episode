"use server";

import { and, eq, inArray, isNotNull, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { airing, episodes, shows, watched } from "@/lib/db/schema";
import { syncShow } from "@/lib/sync";
import { deleteSetting, setSetting } from "@/lib/settings";
import { findTvByExternal, getTvExternalIds, getTvVideos, validateCredential } from "@/lib/tmdb";
import { getFullSchedule, lookupByImdb, lookupByTvdb, searchShows } from "@/lib/tvmaze";

function revalidateAll() {
  revalidatePath("/", "layout");
}

export async function setEpisodeWatched(episodeId: number, isWatched: boolean) {
  if (isWatched) {
    const ep = await db
      .select({ showId: episodes.showId })
      .from(episodes)
      .where(eq(episodes.id, episodeId))
      .limit(1);
    if (!ep.length) return;
    await db
      .insert(watched)
      .values({ episodeId, showId: ep[0].showId, watchedAt: new Date().toISOString() })
      .onConflictDoNothing();
  } else {
    await db.delete(watched).where(eq(watched.episodeId, episodeId));
  }
  revalidateAll();
}

/** Mark every aired, numbered episode of a season as watched (or unwatched). */
export async function setSeasonWatched(showId: number, season: number, isWatched: boolean) {
  const now = new Date().toISOString();
  const eps = await db
    .select({ id: episodes.id })
    .from(episodes)
    .where(
      and(
        eq(episodes.showId, showId),
        eq(episodes.season, season),
        isNotNull(episodes.number),
        lte(episodes.airstamp, now)
      )
    );
  const ids = eps.map((e) => e.id);
  if (!ids.length) return;
  if (isWatched) {
    await db
      .insert(watched)
      .values(ids.map((episodeId) => ({ episodeId, showId, watchedAt: now })))
      .onConflictDoNothing();
  } else {
    await db.delete(watched).where(inArray(watched.episodeId, ids));
  }
  revalidateAll();
}

/** Mark every aired, numbered episode of a show as watched. */
export async function markShowWatched(showId: number) {
  const now = new Date().toISOString();
  const eps = await db
    .select({ id: episodes.id })
    .from(episodes)
    .where(
      and(eq(episodes.showId, showId), isNotNull(episodes.number), lte(episodes.airstamp, now))
    );
  if (!eps.length) return;
  await db
    .insert(watched)
    .values(eps.map((e) => ({ episodeId: e.id, showId, watchedAt: now })))
    .onConflictDoNothing();
  revalidateAll();
}

/** "Catch up": mark this episode and everything before it (aired, numbered) watched. */
export async function markWatchedUpTo(episodeId: number) {
  const target = await db.select().from(episodes).where(eq(episodes.id, episodeId)).limit(1);
  if (!target.length) return;
  const t = target[0];
  const now = new Date().toISOString();
  const eps = await db
    .select({ id: episodes.id, season: episodes.season, number: episodes.number })
    .from(episodes)
    .where(
      and(eq(episodes.showId, t.showId), isNotNull(episodes.number), lte(episodes.airstamp, now))
    );
  const upTo = eps.filter(
    (e) =>
      e.season < t.season || (e.season === t.season && (e.number ?? 0) <= (t.number ?? 0))
  );
  if (!upTo.length) return;
  await db
    .insert(watched)
    .values(upTo.map((e) => ({ episodeId: e.id, showId: t.showId, watchedAt: now })))
    .onConflictDoNothing();
  revalidateAll();
}

export async function refreshShow(showId: number) {
  await syncShow(showId);
  revalidateAll();
}

/** Refresh shows that could still get new episodes and haven't synced recently. */
export async function refreshStaleShows() {
  const cutoff = new Date(Date.now() - 12 * 3600_000).toISOString();
  const all = await db.select().from(shows).where(eq(shows.archived, 0));
  const stale = all.filter(
    (s) => s.status !== "Ended" && (!s.lastSyncedAt || s.lastSyncedAt < cutoff)
  );
  let synced = 0;
  for (const s of stale) {
    try {
      await syncShow(s.id);
      synced++;
    } catch {
      // keep going; individual failures are fine
    }
  }
  revalidateAll();
  return { checked: stale.length, synced };
}

/**
 * Rebuild the airing table from TVmaze's full future-schedule feed: every
 * English-language show with an episode in the next 90 days, keeping each
 * show's earliest upcoming episode. S1E1 earliest = a series premiere.
 */
export async function refreshAiring() {
  const items = await getFullSchedule();
  const now = Date.now();
  const horizon = now + 90 * 86400_000;
  const fetchedAt = new Date().toISOString();

  const byShow = new Map<number, typeof airing.$inferInsert>();
  for (const it of items) {
    const show = it.show ?? it._embedded?.show;
    if (!show || show.language !== "English") continue;
    const nextAirAt = it.airstamp ?? (it.airdate ? `${it.airdate}T00:00:00Z` : null);
    if (!nextAirAt) continue;
    const t = Date.parse(nextAirAt);
    if (!Number.isFinite(t) || t < now - 86400_000 || t > horizon) continue;
    const prev = byShow.get(show.id);
    if (prev && Date.parse(prev.nextAirAt) <= t) continue;
    byShow.set(show.id, {
      showId: show.id,
      name: show.name,
      imdbId: show.externals?.imdb ?? null,
      tvdbId: show.externals?.thetvdb ?? null,
      nextAirAt,
      season: it.season ?? null,
      number: it.number ?? null,
      isPremiere: it.season === 1 && it.number === 1 ? 1 : 0,
      network: show.network?.name ?? show.webChannel?.name ?? null,
      showType: show.type ?? null,
      genres: JSON.stringify(show.genres ?? []),
      country: show.network?.country?.code ?? show.webChannel?.country?.code ?? null,
      weight: show.weight ?? 0,
      summary: show.summary,
      imageMedium: show.image?.medium ?? null,
      url: show.url,
      fetchedAt,
    });
  }

  const rows = [...byShow.values()];
  await db.delete(airing);
  for (let i = 0; i < rows.length; i += 50) {
    await db.insert(airing).values(rows.slice(i, i + 50));
  }
  revalidateAll();
  return { count: rows.length };
}

export async function followShow(tvmazeId: number) {
  await syncShow(tvmazeId, { followedAt: new Date().toISOString() });
  revalidateAll();
}

/** Follow a show known only by its TMDB id (from a recommendation card). */
export async function followFromTmdb(tmdbId: number): Promise<{ ok: boolean }> {
  try {
    const ext = await getTvExternalIds(tmdbId);
    let tvmaze = ext.imdb_id ? await lookupByImdb(ext.imdb_id) : null;
    if (!tvmaze && ext.tvdb_id) tvmaze = await lookupByTvdb(ext.tvdb_id);
    if (!tvmaze) return { ok: false };
    await syncShow(tvmaze.id, { followedAt: new Date().toISOString() });
    await db.update(shows).set({ tmdbId }).where(eq(shows.id, tvmaze.id));
    revalidateAll();
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function unfollowShow(showId: number) {
  // Explicit child deletes: SQLite only honors ON DELETE CASCADE when the
  // foreign_keys pragma is on, which isn't guaranteed per-connection.
  await db.delete(watched).where(eq(watched.showId, showId));
  await db.delete(episodes).where(eq(episodes.showId, showId));
  await db.delete(shows).where(eq(shows.id, showId));
  revalidateAll();
}

export async function searchAction(query: string) {
  return searchShows(query);
}

export interface ShowVideo {
  key: string; // YouTube video id
  name: string;
  type: string;
  official: boolean;
}

/** YouTube videos for a show (trailers first), resolved via TMDB. */
export async function fetchShowVideos(input: {
  tmdbId?: number | null;
  imdbId?: string | null;
  tvdbId?: number | null;
  /** When set, the resolved TMDB id is cached on this library show. */
  tvmazeShowId?: number | null;
}): Promise<ShowVideo[]> {
  try {
    let tmdbId = input.tmdbId ?? null;
    if (!tmdbId) {
      tmdbId = await findTvByExternal({ imdbId: input.imdbId, tvdbId: input.tvdbId });
      if (tmdbId && input.tvmazeShowId) {
        await db.update(shows).set({ tmdbId }).where(eq(shows.id, input.tvmazeShowId));
      }
    }
    if (!tmdbId) return [];
    const rank = (t: string) =>
      ({ Trailer: 0, Teaser: 1, Featurette: 2, Clip: 3 } as Record<string, number>)[t] ?? 4;
    return (await getTvVideos(tmdbId))
      .filter((v) => v.site === "YouTube")
      .sort(
        (a, b) =>
          rank(a.type) - rank(b.type) ||
          Number(b.official) - Number(a.official) ||
          (b.published_at ?? "").localeCompare(a.published_at ?? "")
      )
      .map((v) => ({ key: v.key, name: v.name, type: v.type, official: v.official }));
  } catch {
    return [];
  }
}

/** Validate and store a TMDB credential (v4 read token or v3 API key). */
export async function saveTmdbKey(
  key: string
): Promise<{ ok: boolean; error?: string }> {
  const value = key.trim();
  if (!value) return { ok: false, error: "Key is empty" };
  const cred = { kind: value.startsWith("eyJ") ? ("bearer" as const) : ("v3" as const), value };
  if (!(await validateCredential(cred))) {
    return { ok: false, error: "TMDB rejected this key — double-check it" };
  }
  await setSetting("tmdb_key", value);
  revalidateAll();
  return { ok: true };
}

export async function clearTmdbKey() {
  await deleteSetting("tmdb_key");
  revalidateAll();
}
