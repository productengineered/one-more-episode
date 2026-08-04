// Minimal TMDB client, used for "shows like this" recommendations.
// Auth: v4 read access token as a Bearer header.

const BASE = "https://api.themoviedb.org/3";

export interface TmdbTvSummary {
  id: number;
  name: string;
  first_air_date: string | null;
  overview: string | null;
  poster_path: string | null;
  vote_average: number | null;
}

async function get<T>(path: string): Promise<T> {
  const token = process.env.TMDB_READ_ACCESS_TOKEN;
  if (!token) throw new Error("TMDB_READ_ACCESS_TOKEN is not set");
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`TMDB ${path} -> ${res.status}`);
  return (await res.json()) as T;
}

/** Resolve a TMDB TV id from an IMDB or TVDB id. */
export async function findTvByExternal(ids: {
  imdbId?: string | null;
  tvdbId?: number | null;
}): Promise<number | null> {
  if (ids.imdbId) {
    const r = await get<{ tv_results: TmdbTvSummary[] }>(
      `/find/${ids.imdbId}?external_source=imdb_id`
    );
    if (r.tv_results[0]) return r.tv_results[0].id;
  }
  if (ids.tvdbId) {
    const r = await get<{ tv_results: TmdbTvSummary[] }>(
      `/find/${ids.tvdbId}?external_source=tvdb_id`
    );
    if (r.tv_results[0]) return r.tv_results[0].id;
  }
  return null;
}

/** "People who liked X also liked" — falls back to metadata-similar when empty. */
export async function getTvRecommendations(tmdbId: number): Promise<TmdbTvSummary[]> {
  const recs = await get<{ results: TmdbTvSummary[] }>(`/tv/${tmdbId}/recommendations`);
  if (recs.results.length) return recs.results;
  const similar = await get<{ results: TmdbTvSummary[] }>(`/tv/${tmdbId}/similar`);
  return similar.results;
}

export function getTvExternalIds(
  tmdbId: number
): Promise<{ imdb_id: string | null; tvdb_id: number | null }> {
  return get(`/tv/${tmdbId}/external_ids`);
}

export function tmdbPosterUrl(posterPath: string | null, size = "w185"): string | null {
  return posterPath ? `https://image.tmdb.org/t/p/${size}${posterPath}` : null;
}
