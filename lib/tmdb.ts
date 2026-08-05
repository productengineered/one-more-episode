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

async function getWith<T>(
  cred: TmdbCredential,
  path: string,
  revalidate?: number
): Promise<T> {
  const sep = path.includes("?") ? "&" : "?";
  const url =
    cred.kind === "v3" ? `${BASE}${path}${sep}api_key=${cred.value}` : `${BASE}${path}`;
  const res = await fetch(url, {
    headers: cred.kind === "bearer" ? { Authorization: `Bearer ${cred.value}` } : {},
    ...(revalidate ? { next: { revalidate } } : {}),
  });
  if (!res.ok) throw new Error(`TMDB ${path} -> ${res.status}`);
  return (await res.json()) as T;
}

async function get<T>(path: string, revalidate?: number): Promise<T> {
  const cred = await getTmdbCredential();
  if (!cred) throw new Error("TMDB is not configured — add a key in Settings");
  return getWith<T>(cred, path, revalidate);
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

export interface TmdbVideo {
  key: string;
  site: string;
  type: string; // Trailer | Teaser | Featurette | Clip | ...
  name: string;
  official: boolean;
  published_at: string | null;
}

export function getTvVideos(tmdbId: number): Promise<TmdbVideo[]> {
  // Cached for a day so show pages can check availability at render time.
  return get<{ results: TmdbVideo[] }>(`/tv/${tmdbId}/videos`, 86400).then(
    (r) => r.results ?? []
  );
}

export interface TmdbTvDetails {
  name: string;
  first_air_date: string | null;
  overview: string | null;
  status: string | null;
  number_of_seasons: number | null;
  number_of_episodes: number | null;
  vote_average: number | null;
  genres: { name: string }[];
  networks: { name: string }[];
}

export function getTvDetails(tmdbId: number): Promise<TmdbTvDetails> {
  return get<TmdbTvDetails>(`/tv/${tmdbId}`, 86400);
}

export function getMovieVideos(tmdbId: number): Promise<TmdbVideo[]> {
  return get<{ results: TmdbVideo[] }>(`/movie/${tmdbId}/videos`, 86400).then(
    (r) => r.results ?? []
  );
}

export function tmdbPosterUrl(posterPath: string | null, size = "w185"): string | null {
  return posterPath ? `https://image.tmdb.org/t/p/${size}${posterPath}` : null;
}

export interface TmdbMovieSummary {
  id: number;
  title: string;
  release_date: string | null;
  overview: string | null;
  poster_path: string | null;
  popularity: number;
}

/** Popular movies with a US theatrical or digital release inside the window. */
export async function discoverUsMovies(
  fromIso: string,
  toIso: string,
  pages = 3
): Promise<TmdbMovieSummary[]> {
  const out: TmdbMovieSummary[] = [];
  for (let page = 1; page <= pages; page++) {
    const r = await get<{ results: TmdbMovieSummary[] }>(
      `/discover/movie?region=US&with_release_type=3|4&release_date.gte=${fromIso}` +
        `&release_date.lte=${toIso}&sort_by=popularity.desc&with_original_language=en&page=${page}`
    );
    out.push(...r.results);
    if (r.results.length < 20) break;
  }
  return out;
}

/** Earliest US theatrical (type 2/3) and digital (type 4) release dates. */
export async function getUsReleaseDates(
  tmdbId: number
): Promise<{ theatrical: string | null; digital: string | null }> {
  const r = await get<{
    results: { iso_3166_1: string; release_dates: { type: number; release_date: string }[] }[];
  }>(`/movie/${tmdbId}/release_dates`);
  const us = r.results.find((x) => x.iso_3166_1 === "US");
  let theatrical: string | null = null;
  let digital: string | null = null;
  for (const rd of us?.release_dates ?? []) {
    const date = rd.release_date?.slice(0, 10) ?? null;
    if (!date) continue;
    if ((rd.type === 2 || rd.type === 3) && (!theatrical || date < theatrical)) theatrical = date;
    if (rd.type === 4 && (!digital || date < digital)) digital = date;
  }
  return { theatrical, digital };
}
