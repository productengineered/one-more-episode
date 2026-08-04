import { eq } from "drizzle-orm";
import { db } from "./db";
import { episodes, shows } from "./db/schema";
import { getShowWithEpisodes, TvmazeShow } from "./tvmaze";

export function showValues(s: TvmazeShow, extra?: { followedAt?: string | null }) {
  return {
    id: s.id,
    tvdbId: s.externals?.thetvdb ?? null,
    imdbId: s.externals?.imdb ?? null,
    name: s.name,
    status: s.status ?? "Unknown",
    premiered: s.premiered,
    ended: s.ended,
    network: s.network?.name ?? s.webChannel?.name ?? null,
    scheduleTime: s.schedule?.time || null,
    scheduleDays: s.schedule?.days?.join(", ") || null,
    runtime: s.runtime ?? s.averageRuntime ?? null,
    genres: JSON.stringify(s.genres ?? []),
    summary: s.summary,
    imageMedium: s.image?.medium ?? null,
    imageOriginal: s.image?.original ?? null,
    url: s.url,
    lastSyncedAt: new Date().toISOString(),
    ...(extra?.followedAt !== undefined ? { followedAt: extra.followedAt } : {}),
  };
}

function episodeValues(showId: number, e: import("./tvmaze").TvmazeEpisode) {
  return {
    id: e.id,
    showId,
    season: e.season,
    number: e.number,
    type: e.type ?? "regular",
    name: e.name,
    airdate: e.airdate || null,
    airstamp: e.airstamp || null,
    runtime: e.runtime,
    imageMedium: e.image?.medium ?? null,
    summary: e.summary,
  };
}

/** Fetch a show + all episodes from TVmaze and upsert into the DB. */
export async function syncShow(tvmazeId: number, extra?: { followedAt?: string | null }) {
  const s = await getShowWithEpisodes(tvmazeId);
  if (!s) throw new Error(`TVmaze show ${tvmazeId} not found`);

  const sv = showValues(s, extra);
  await db
    .insert(shows)
    .values(sv)
    .onConflictDoUpdate({
      target: shows.id,
      set: { ...sv, followedAt: undefined } as Partial<typeof sv>,
    });

  const eps = s._embedded?.episodes ?? [];
  for (const e of eps) {
    const ev = episodeValues(s.id, e);
    await db.insert(episodes).values(ev).onConflictDoUpdate({ target: episodes.id, set: ev });
  }

  // Drop episodes TVmaze no longer lists (renumbered/removed), so ordering stays correct.
  const keep = new Set(eps.map((e) => e.id));
  const existing = await db
    .select({ id: episodes.id })
    .from(episodes)
    .where(eq(episodes.showId, s.id));
  for (const row of existing) {
    if (!keep.has(row.id)) await db.delete(episodes).where(eq(episodes.id, row.id));
  }

  return { show: s, episodeCount: eps.length };
}
