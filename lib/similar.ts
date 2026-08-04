import { eq } from "drizzle-orm";
import { db } from "./db";
import { shows, similar, type Show, type SimilarShow } from "./db/schema";
import { findTvByExternal, getTvRecommendations, type TmdbTvSummary } from "./tmdb";

const MAX_RESULTS = 12;
const MAX_AGE_MS = 30 * 86400_000;

function toRow(sourceShowId: number, r: TmdbTvSummary, fetchedAt: string) {
  return {
    sourceShowId,
    tmdbId: r.id,
    name: r.name,
    year: r.first_air_date?.slice(0, 4) ?? null,
    overview: r.overview,
    posterPath: r.poster_path,
    voteAverage: r.vote_average,
    fetchedAt,
  };
}

/** Cached "shows like this" for a followed show; fetches from TMDB when empty or stale. */
export async function getSimilarShows(show: Show): Promise<SimilarShow[]> {
  const cached = await db.select().from(similar).where(eq(similar.sourceShowId, show.id));
  const fresh =
    cached.length > 0 && Date.now() - Date.parse(cached[0].fetchedAt) < MAX_AGE_MS;
  if (fresh) return cached;

  let tmdbId = show.tmdbId;
  if (!tmdbId) {
    tmdbId = await findTvByExternal({ imdbId: show.imdbId, tvdbId: show.tvdbId });
    if (tmdbId) await db.update(shows).set({ tmdbId }).where(eq(shows.id, show.id));
  }
  if (!tmdbId) return cached; // unmappable — keep whatever we had

  const recs = (await getTvRecommendations(tmdbId)).slice(0, MAX_RESULTS);
  const fetchedAt = new Date().toISOString();
  await db.delete(similar).where(eq(similar.sourceShowId, show.id));
  if (recs.length) {
    await db.insert(similar).values(recs.map((r) => toRow(show.id, r, fetchedAt)));
  }
  return db.select().from(similar).where(eq(similar.sourceShowId, show.id));
}

/** Uncached lookup for shows not in the library (e.g. from search results). */
export async function fetchSimilarByExternal(ids: {
  imdbId?: string | null;
  tvdbId?: number | null;
}): Promise<TmdbTvSummary[]> {
  const tmdbId = await findTvByExternal(ids);
  if (!tmdbId) return [];
  return (await getTvRecommendations(tmdbId)).slice(0, MAX_RESULTS);
}
