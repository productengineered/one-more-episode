"use server";

import { and, eq, inArray, isNotNull, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { episodes, shows, watched } from "@/lib/db/schema";
import { syncShow } from "@/lib/sync";
import { searchShows } from "@/lib/tvmaze";

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

export async function followShow(tvmazeId: number) {
  await syncShow(tvmazeId, { followedAt: new Date().toISOString() });
  revalidateAll();
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
