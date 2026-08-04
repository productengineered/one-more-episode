import { asc, eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { episodes, shows, watched, type Episode, type Show } from "./db/schema";

export interface ShowProgress {
  show: Show;
  airedCount: number;
  watchedCount: number;
  nextUnwatched: Episode | null; // earliest aired, unwatched, regular-numbered episode
  nextAiring: Episode | null; // earliest future episode
  lastWatchedAt: string | null;
}

function isAired(e: Episode, now: number): boolean {
  if (!e.airstamp) return e.airdate ? Date.parse(e.airdate) <= now : false;
  return Date.parse(e.airstamp) <= now;
}

function epOrder(a: Episode, b: Episode): number {
  if (a.season !== b.season) return a.season - b.season;
  return (a.number ?? 9999) - (b.number ?? 9999);
}

/** Progress + next-episode info for every followed show. */
export async function getAllProgress(): Promise<ShowProgress[]> {
  const allShows = await db
    .select()
    .from(shows)
    .where(eq(shows.archived, 0))
    .orderBy(asc(shows.name));
  if (!allShows.length) return [];

  const showIds = allShows.map((s) => s.id);
  const allEpisodes = await db
    .select()
    .from(episodes)
    .where(inArray(episodes.showId, showIds));
  const watchedRows = await db.select().from(watched);
  const watchedIds = new Set(watchedRows.map((w) => w.episodeId));
  const lastWatchedByShow = new Map<number, string>();
  for (const w of watchedRows) {
    const prev = lastWatchedByShow.get(w.showId);
    if (!prev || w.watchedAt > prev) lastWatchedByShow.set(w.showId, w.watchedAt);
  }

  const byShow = new Map<number, Episode[]>();
  for (const e of allEpisodes) {
    if (!byShow.has(e.showId)) byShow.set(e.showId, []);
    byShow.get(e.showId)!.push(e);
  }

  const now = Date.now();
  return allShows.map((show) => {
    const eps = (byShow.get(show.id) ?? []).sort(epOrder);
    // Progress counts only numbered episodes; specials don't block "up to date".
    const numbered = eps.filter((e) => e.number !== null);
    const aired = numbered.filter((e) => isAired(e, now));
    const airedCount = aired.length;
    const watchedCount = aired.filter((e) => watchedIds.has(e.id)).length;
    const nextUnwatched = aired.find((e) => !watchedIds.has(e.id)) ?? null;
    const future = eps
      .filter((e) => !isAired(e, now) && e.airstamp)
      .sort((a, b) => Date.parse(a.airstamp!) - Date.parse(b.airstamp!));
    return {
      show,
      airedCount,
      watchedCount,
      nextUnwatched,
      nextAiring: future[0] ?? null,
      lastWatchedAt: lastWatchedByShow.get(show.id) ?? null,
    };
  });
}

export interface UpcomingEpisode {
  show: Show;
  episode: Episode;
}

/** Future episodes for followed shows, soonest first. */
export async function getUpcoming(limitDays = 120): Promise<UpcomingEpisode[]> {
  const allShows = await db.select().from(shows).where(eq(shows.archived, 0));
  if (!allShows.length) return [];
  const byId = new Map(allShows.map((s) => [s.id, s]));
  const allEpisodes = await db
    .select()
    .from(episodes)
    .where(inArray(episodes.showId, allShows.map((s) => s.id)));

  const now = Date.now();
  const cutoff = now + limitDays * 86400_000;
  const out: UpcomingEpisode[] = [];
  for (const e of allEpisodes) {
    if (!e.airstamp) continue;
    const t = Date.parse(e.airstamp);
    if (t > now && t <= cutoff) out.push({ show: byId.get(e.showId)!, episode: e });
  }
  out.sort((a, b) => Date.parse(a.episode.airstamp!) - Date.parse(b.episode.airstamp!));
  return out;
}

export async function getShowDetail(showId: number) {
  const show = await db.select().from(shows).where(eq(shows.id, showId)).limit(1);
  if (!show.length) return null;
  const eps = await db
    .select()
    .from(episodes)
    .where(eq(episodes.showId, showId));
  eps.sort(epOrder);
  const watchedRows = await db.select().from(watched).where(eq(watched.showId, showId));
  return {
    show: show[0],
    episodes: eps,
    watchedIds: new Set(watchedRows.map((w) => w.episodeId)),
  };
}
