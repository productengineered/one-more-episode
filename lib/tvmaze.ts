// Minimal TVmaze API client. Free, no API key. Rate limit: 20 requests / 10 seconds,
// so calls are funneled through a queue that spaces them out.

const BASE = "https://api.tvmaze.com";

export interface TvmazeImage {
  medium: string;
  original: string;
}

export interface TvmazeEpisode {
  id: number;
  season: number;
  number: number | null;
  type: string;
  name: string | null;
  airdate: string | null;
  airstamp: string | null;
  runtime: number | null;
  image: TvmazeImage | null;
  summary: string | null;
}

export interface TvmazeShow {
  id: number;
  url: string;
  name: string;
  status: string;
  premiered: string | null;
  ended: string | null;
  runtime: number | null;
  averageRuntime: number | null;
  genres: string[];
  schedule: { time: string; days: string[] };
  network: { name: string } | null;
  webChannel: { name: string } | null;
  externals: { thetvdb: number | null; imdb: string | null };
  image: TvmazeImage | null;
  summary: string | null;
  _embedded?: { episodes?: TvmazeEpisode[] };
}

let queue: Promise<unknown> = Promise.resolve();
const SPACING_MS = 600; // ~16 req / 10s, safely under the limit

function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.then(
    () => new Promise((r) => setTimeout(r, SPACING_MS)),
    () => new Promise((r) => setTimeout(r, SPACING_MS))
  );
  return run;
}

async function get<T>(path: string, allow404 = false): Promise<T | null> {
  return throttled(async () => {
    for (let attempt = 0; attempt < 4; attempt++) {
      const res = await fetch(`${BASE}${path}`, { redirect: "follow" });
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
        continue;
      }
      if (res.status === 404 && allow404) return null;
      if (!res.ok) throw new Error(`TVmaze ${path} -> ${res.status}`);
      return (await res.json()) as T;
    }
    throw new Error(`TVmaze ${path} -> rate limited after retries`);
  });
}

export function lookupByTvdb(tvdbId: number): Promise<TvmazeShow | null> {
  return get<TvmazeShow>(`/lookup/shows?thetvdb=${tvdbId}`, true);
}

export function getShowWithEpisodes(tvmazeId: number): Promise<TvmazeShow | null> {
  return get<TvmazeShow>(`/shows/${tvmazeId}?embed[]=episodes&specials=1`, true);
}

export function searchShows(query: string): Promise<{ score: number; show: TvmazeShow }[]> {
  return get<{ score: number; show: TvmazeShow }[]>(
    `/search/shows?q=${encodeURIComponent(query)}`
  ).then((r) => r ?? []);
}
