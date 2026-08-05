import { asc, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { episodes, shows, watched, type Episode, type Show } from "./db/schema";

// Raw-SQL episode selection with camelCase aliases matching the Episode type.
const EP_COLS = `id, show_id AS showId, season, number, type, name, airdate,
  airstamp, runtime, image_medium AS imageMedium, summary`;

export interface ShowProgress {
  show: Show;
  airedCount: number;
  watchedCount: number;
  nextUnwatched: Episode | null; // earliest aired, unwatched, regular-numbered episode
  nextAiring: Episode | null; // earliest future episode
  lastWatchedAt: string | null;
}

function epOrder(a: Episode, b: Episode): number {
  if (a.season !== b.season) return a.season - b.season;
  return (a.number ?? 9999) - (b.number ?? 9999);
}

/**
 * Progress + next-episode info for every followed show.
 *
 * Computed in SQL: the naive version shipped every episode row (12k+) over the
 * network per page view, which made the deployed app feel slow. These five
 * parallel queries each return at most one row per show.
 */
export async function getAllProgress(): Promise<ShowProgress[]> {
  const nowIso = new Date().toISOString();
  const today = nowIso.slice(0, 10);
  // Aired = airstamp in the past, or (no airstamp) date-only airdate in the past.
  const aired = (p: string) =>
    `(${p}.airstamp <= '${nowIso}' OR (${p}.airstamp IS NULL AND ${p}.airdate <= '${today}'))`;

  const [allShows, airedCounts, watchedCounts, nextUnwatchedRows, nextAiringRows, lastWatchedRows] =
    await Promise.all([
      db.select().from(shows).where(eq(shows.archived, 0)).orderBy(asc(shows.name)),
      db.all<{ showId: number; c: number }>(
        sql.raw(`SELECT e.show_id AS showId, COUNT(*) AS c FROM episodes e
          WHERE e.number IS NOT NULL AND ${aired("e")} GROUP BY e.show_id`)
      ),
      db.all<{ showId: number; c: number }>(
        sql.raw(`SELECT e.show_id AS showId, COUNT(*) AS c FROM watched w
          JOIN episodes e ON e.id = w.episode_id
          WHERE e.number IS NOT NULL AND ${aired("e")} GROUP BY e.show_id`)
      ),
      db.all<Episode>(
        sql.raw(`SELECT ${EP_COLS} FROM (
          SELECT e.*, ROW_NUMBER() OVER (PARTITION BY e.show_id ORDER BY e.season, e.number) AS rn
          FROM episodes e
          WHERE e.number IS NOT NULL AND ${aired("e")}
            AND e.id NOT IN (SELECT episode_id FROM watched)
        ) WHERE rn = 1`)
      ),
      db.all<Episode>(
        sql.raw(`SELECT ${EP_COLS} FROM (
          SELECT e.*, ROW_NUMBER() OVER (PARTITION BY e.show_id ORDER BY e.airstamp) AS rn
          FROM episodes e WHERE e.airstamp > '${nowIso}'
        ) WHERE rn = 1`)
      ),
      db.all<{ showId: number; w: string }>(
        sql.raw(`SELECT show_id AS showId, MAX(watched_at) AS w FROM watched GROUP BY show_id`)
      ),
    ]);
  if (!allShows.length) return [];

  const byShowId = <T extends { showId: number }>(rows: T[]) =>
    new Map(rows.map((r) => [r.showId, r]));
  const airedMap = byShowId(airedCounts);
  const watchedMap = byShowId(watchedCounts);
  const nextUnwatchedMap = byShowId(nextUnwatchedRows);
  const nextAiringMap = byShowId(nextAiringRows);
  const lastWatchedMap = byShowId(lastWatchedRows);

  return allShows.map((show) => ({
    show,
    airedCount: airedMap.get(show.id)?.c ?? 0,
    watchedCount: watchedMap.get(show.id)?.c ?? 0,
    nextUnwatched: nextUnwatchedMap.get(show.id) ?? null,
    nextAiring: nextAiringMap.get(show.id) ?? null,
    lastWatchedAt: lastWatchedMap.get(show.id)?.w ?? null,
  }));
}

export interface UpcomingEpisode {
  show: Show;
  episode: Episode;
}

/** Episodes for followed shows around now: `lookbackDays` back, `limitDays` ahead. */
export async function getUpcoming(limitDays = 120, lookbackDays = 14): Promise<UpcomingEpisode[]> {
  const startIso = new Date(Date.now() - lookbackDays * 86400_000).toISOString();
  const cutoffIso = new Date(Date.now() + limitDays * 86400_000).toISOString();
  const [allShows, futureEpisodes] = await Promise.all([
    db.select().from(shows).where(eq(shows.archived, 0)),
    db.all<Episode>(
      sql.raw(`SELECT ${EP_COLS} FROM episodes e
        WHERE e.airstamp > '${startIso}' AND e.airstamp <= '${cutoffIso}'
          AND e.show_id IN (SELECT id FROM shows WHERE archived = 0)
        ORDER BY e.airstamp`)
    ),
  ]);
  const byId = new Map(allShows.map((s) => [s.id, s]));
  return futureEpisodes
    .filter((e) => byId.has(e.showId))
    .map((e) => ({ show: byId.get(e.showId)!, episode: e }));
}

export async function getShowDetail(showId: number) {
  const [show, eps, watchedRows] = await Promise.all([
    db.select().from(shows).where(eq(shows.id, showId)).limit(1),
    db.select().from(episodes).where(eq(episodes.showId, showId)),
    db.select().from(watched).where(eq(watched.showId, showId)),
  ]);
  if (!show.length) return null;
  eps.sort(epOrder);
  return {
    show: show[0],
    episodes: eps,
    watchedIds: new Set(watchedRows.map((w) => w.episodeId)),
  };
}
