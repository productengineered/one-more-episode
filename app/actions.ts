"use server";

import { and, eq, inArray, isNotNull, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { episodes, premieres, shows, watched } from "@/lib/db/schema";
import { syncShow } from "@/lib/sync";
import { getTvExternalIds } from "@/lib/tmdb";
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
 * Rebuild the premieres table from TVmaze's full future-schedule feed:
 * S1E1s of English-language shows airing in the next 90 days.
 */
export async function refreshPremieres() {
  const items = await getFullSchedule();
  const now = Date.now();
  const horizon = now + 90 * 86400_000;
  const fetchedAt = new Date().toISOString();

  const byShow = new Map<number, typeof premieres.$inferInsert>();
  for (const it of items) {
    if (it.season !== 1 || it.number !== 1) continue;
    const show = it.show ?? it._embedded?.show;
    if (!show || show.language !== "English") continue;
    const premiereAt = it.airstamp ?? (it.airdate ? `${it.airdate}T00:00:00Z` : null);
    if (!premiereAt) continue;
    const t = Date.parse(premiereAt);
    if (!Number.isFinite(t) || t < now - 86400_000 || t > horizon) continue;
    byShow.set(show.id, {
      showId: show.id,
      name: show.name,
      premiereAt,
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
  await db.delete(premieres);
  for (let i = 0; i < rows.length; i += 50) {
    await db.insert(premieres).values(rows.slice(i, i + 50));
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
