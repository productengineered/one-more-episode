// Minimal TMDB client, used for "shows like this" recommendations.
// Credentials come from the Settings page (or env vars) and may be either a
// v4 read access token (Bearer header) or a classic v3 API key (query param).

import { getTmdbCredential, type TmdbCredential } from "./settings";

const BASE = "https://api.themoviedb.org/3";

export interface TmdbTvSummary {
  id: number;
  name: string;
  first_air_date: string | null;
  overview: string | null;
  poster_path: string | null;
  vote_average: number | null;
}

export async function isTmdbConfigured(): Promise<boolean> {
  return (await getTmdbCredential()) !== null;
}

async function getWith<T>(cred: TmdbCredential, path: string): Promise<T> {
  const sep = path.includes("?") ? "&" : "?";
  const url =
    cred.kind === "v3" ? `${BASE}${path}${sep}api_key=${cred.value}` : `${BASE}${path}`;
  const res = await fetch(url, {
    headers: cred.kind === "bearer" ? { Authorization: `Bearer ${cred.value}` } : {},
  });
  if (!res.ok) throw new Error(`TMDB ${path} -> ${res.status}`);
  return (await res.json()) as T;
}

async function get<T>(path: string): Promise<T> {
  const cred = await getTmdbCredential();
  if (!cred) throw new Error("TMDB is not configured — add a key in Settings");
  return getWith<T>(cred, path);
}

/** True if the credential can authenticate against TMDB. */
export async function validateCredential(cred: TmdbCredential): Promise<boolean> {
  try {
    await getWith(cred, "/configuration");
    return true;
  } catch {
    return false;
  }
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
