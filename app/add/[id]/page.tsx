import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { FollowButton } from "@/components/FollowButton";
import { SimilarGrid } from "@/components/SimilarGrid";
import { TrailerButton } from "@/components/TrailerButton";
import { db } from "@/lib/db";
import { shows } from "@/lib/db/schema";
import { formatDate, formatDateTime, relativeDays, stripHtml } from "@/lib/format";
import { getUserTimezone } from "@/lib/settings";
import { fetchSimilarByExternal } from "@/lib/similar";
import { isTmdbConfigured } from "@/lib/tmdb";
import { getShowWithEpisodes, type TvmazeEpisode } from "@/lib/tvmaze";

export const dynamic = "force-dynamic";

/** Read-only preview of a show that isn't followed yet (from /add search). */
export default async function ShowPreviewPage({ params }: PageProps<"/add/[id]">) {
  const { id } = await params;
  const showId = Number(id);
  if (!Number.isInteger(showId)) notFound();

  // Already followed — the real page has everything this one has, and more.
  const followed = await db
    .select({ id: shows.id })
    .from(shows)
    .where(eq(shows.id, showId));
  if (followed.length > 0) redirect(`/shows/${showId}`);

  const show = await getShowWithEpisodes(showId);
  if (!show) notFound();
  const eps = show._embedded?.episodes ?? [];

  const now = Date.now();
  const aired = (e: TvmazeEpisode) => !!e.airstamp && Date.parse(e.airstamp) <= now;

  const seasons = new Map<number, TvmazeEpisode[]>();
  for (const e of eps) {
    if (!seasons.has(e.season)) seasons.set(e.season, []);
    seasons.get(e.season)!.push(e);
  }

  const nextAiring = eps
    .filter((e) => e.airstamp && Date.parse(e.airstamp) > now)
    .sort((a, b) => Date.parse(a.airstamp!) - Date.parse(b.airstamp!))[0];

  const [tz, tmdbConfigured] = await Promise.all([getUserTimezone(), isTmdbConfigured()]);
  const imdbId = show.externals?.imdb ?? null;
  const tvdbId = show.externals?.thetvdb ?? null;
  const similarItems = tmdbConfigured
    ? await fetchSimilarByExternal({ imdbId, tvdbId }).catch(() => [])
    : [];
  const followedNames = new Set(
    (await db.select({ name: shows.name }).from(shows)).map((s) => s.name.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-500">
        <Link href="/add" className="text-violet-400 hover:underline">
          ← Back to search
        </Link>
      </p>

      <section className="flex gap-5">
        {show.image?.medium && (
          <Image
            src={show.image.medium}
            alt=""
            width={140}
            height={196}
            className="hidden h-[196px] w-[140px] shrink-0 rounded-xl object-cover sm:block"
          />
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">{show.name}</h1>
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
              {show.status}
            </span>
          </div>
          <p className="text-sm text-zinc-500">
            {[
              show.network?.name ?? show.webChannel?.name,
              show.premiered?.slice(0, 4) &&
                `${show.premiered.slice(0, 4)}–${show.ended ? show.ended.slice(0, 4) : ""}`,
              show.genres.join(" · "),
              show.runtime ?? show.averageRuntime
                ? `${show.runtime ?? show.averageRuntime} min`
                : null,
            ]
              .filter(Boolean)
              .join("  ·  ")}
          </p>
          {show.summary && (
            <p className="line-clamp-3 max-w-2xl text-sm text-zinc-400">
              {stripHtml(show.summary)}
            </p>
          )}
          {nextAiring && (
            <p className="text-sm">
              <span className="rounded-lg bg-violet-600/15 px-2 py-1 text-violet-300">
                Next: {nextAiring.name ?? "TBA"} · {formatDateTime(nextAiring.airstamp, tz)} (
                {relativeDays(nextAiring.airstamp!)})
              </span>
            </p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <FollowButton tvmazeId={show.id} />
            {tmdbConfigured && (
              <TrailerButton showName={show.name} hints={{ imdbId, tvdbId }} />
            )}
            <Link
              href={`/similar?name=${encodeURIComponent(show.name)}&imdb=${imdbId ?? ""}&tvdb=${
                tvdbId ?? ""
              }`}
              className="rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-1.5 text-sm text-zinc-300 hover:border-zinc-500"
            >
              Shows like this
            </Link>
          </div>
        </div>
      </section>

      <div className="space-y-4">
        {[...seasons.entries()]
          .sort((a, b) => b[0] - a[0])
          .map(([season, seasonEps], i) => {
            const unaired = seasonEps.filter((e) => !aired(e)).length;
            return (
              <details
                key={season}
                open={i === 0}
                className="group overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60"
              >
                <summary className="flex cursor-pointer select-none items-center gap-3 p-3 hover:bg-zinc-900">
                  <span className="font-medium">Season {season}</span>
                  <span className="text-xs text-zinc-500">
                    {seasonEps.length} episode{seasonEps.length === 1 ? "" : "s"}
                    {unaired > 0 && ` · ${unaired} unaired`}
                  </span>
                  <span className="ml-auto text-zinc-600 transition-transform group-open:rotate-90">
                    ›
                  </span>
                </summary>
                <ul className="border-t border-zinc-800/60">
                  {seasonEps.map((e) => {
                    const hasAired = aired(e);
                    return (
                      <li
                        key={e.id}
                        className={`flex items-center gap-3 border-b border-zinc-800/40 px-3 py-2 last:border-0 ${
                          hasAired ? "" : "opacity-50"
                        }`}
                      >
                        <span className="w-8 shrink-0 text-right font-mono text-xs text-zinc-600">
                          {e.number ?? "SP"}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-zinc-200">
                            {e.name ?? "TBA"}
                          </span>
                          {(e.airstamp ?? e.airdate) && (
                            <span className="block text-[11px] text-zinc-600 sm:hidden">
                              {formatDate(e.airstamp ?? e.airdate, tz)}
                            </span>
                          )}
                        </span>
                        <span className="hidden shrink-0 text-xs text-zinc-600 sm:block">
                          {formatDate(e.airstamp ?? e.airdate, tz)}
                        </span>
                        {!hasAired && (
                          <span className="shrink-0 text-xs text-zinc-600">
                            {e.airstamp ? relativeDays(e.airstamp) : "TBA"}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </details>
            );
          })}
      </div>

      {similarItems.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-zinc-300">More like this</h2>
          <SimilarGrid
            items={similarItems.map((r) => ({
              tmdbId: r.id,
              name: r.name,
              year: r.first_air_date?.slice(0, 4) ?? null,
              overview: r.overview,
              posterPath: r.poster_path,
              voteAverage: r.vote_average,
            }))}
            followedNames={followedNames}
          />
        </section>
      ) : (
        !tmdbConfigured && (
          <p className="text-xs text-zinc-600">
            Want trailers and “more like this” here? Add a free TMDB key in{" "}
            <Link href="/settings" className="text-zinc-400 hover:text-zinc-200">
              Settings
            </Link>
            .
          </p>
        )
      )}
    </div>
  );
}
