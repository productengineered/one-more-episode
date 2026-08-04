import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { setSeasonWatched, refreshShow } from "@/app/actions";
import { UnfollowButton } from "@/components/UnfollowButton";
import { WatchedButton } from "@/components/WatchedButton";
import { CatchUpButton } from "@/components/CatchUpButton";
import { MarkAllButton } from "@/components/MarkAllButton";
import { TrailerButton } from "@/components/TrailerButton";
import { ProgressBar } from "@/components/ProgressBar";
import { SimilarGrid } from "@/components/SimilarGrid";
import { formatDate, formatDateTime, relativeDays, stripHtml } from "@/lib/format";
import { getShowDetail } from "@/lib/queries";
import { getSimilarShows } from "@/lib/similar";
import { isTmdbConfigured } from "@/lib/tmdb";
import { syncShow } from "@/lib/sync";
import { db } from "@/lib/db";
import { shows as showsTable, type Episode } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const STALE_MS = 24 * 3600_000;

export default async function ShowDetailPage({ params }: PageProps<"/shows/[id]">) {
  const { id } = await params;
  const showId = Number(id);
  let detail = await getShowDetail(showId);
  if (!detail) notFound();

  // Auto-refresh from TVmaze when the data is stale and the show could still change.
  const stale =
    detail.show.status !== "Ended" &&
    (!detail.show.lastSyncedAt || Date.parse(detail.show.lastSyncedAt) < Date.now() - STALE_MS);
  if (stale) {
    try {
      await syncShow(showId);
      detail = (await getShowDetail(showId))!;
    } catch {
      // offline or TVmaze hiccup — show what we have
    }
  }

  const { show, episodes: eps, watchedIds } = detail;
  const now = Date.now();
  const aired = (e: Episode) => !!e.airstamp && Date.parse(e.airstamp) <= now;

  const seasons = new Map<number, Episode[]>();
  for (const e of eps) {
    if (!seasons.has(e.season)) seasons.set(e.season, []);
    seasons.get(e.season)!.push(e);
  }

  const numberedAired = eps.filter((e) => e.number !== null && aired(e));
  const watchedCount = numberedAired.filter((e) => watchedIds.has(e.id)).length;
  const nextAiring = eps
    .filter((e) => e.airstamp && Date.parse(e.airstamp) > now)
    .sort((a, b) => Date.parse(a.airstamp!) - Date.parse(b.airstamp!))[0];
  const genres: string[] = show.genres ? JSON.parse(show.genres) : [];

  const tmdbConfigured = await isTmdbConfigured();
  const similarShows = tmdbConfigured ? await getSimilarShows(show).catch(() => []) : [];
  const followedNames = new Set(
    (await db.select({ name: showsTable.name }).from(showsTable)).map((s) =>
      s.name.toLowerCase()
    )
  );

  return (
    <div className="space-y-6">
      <section className="flex gap-5">
        {show.imageMedium && (
          <Image
            src={show.imageMedium}
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
              show.network,
              show.premiered?.slice(0, 4) &&
                `${show.premiered.slice(0, 4)}–${show.ended ? show.ended.slice(0, 4) : ""}`,
              genres.join(" · "),
              show.runtime ? `${show.runtime} min` : null,
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
                Next: {nextAiring.name ?? "TBA"} · {formatDateTime(nextAiring.airstamp)} (
                {relativeDays(nextAiring.airstamp!)})
              </span>
            </p>
          )}
          <div className="max-w-sm pt-1">
            <ProgressBar value={watchedCount} max={numberedAired.length} />
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {tmdbConfigured && (
              <TrailerButton
                showName={show.name}
                hints={{
                  tmdbId: show.tmdbId,
                  imdbId: show.imdbId,
                  tvdbId: show.tvdbId,
                  tvmazeShowId: show.id,
                }}
              />
            )}
            {watchedCount < numberedAired.length && (
              <MarkAllButton
                showId={showId}
                remaining={numberedAired.length - watchedCount}
                size="md"
              />
            )}
            <form
              action={async () => {
                "use server";
                await refreshShow(showId);
              }}
            >
              <button className="rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-1.5 text-sm text-zinc-300 hover:border-zinc-500">
                ↻ Refresh
              </button>
            </form>
            <UnfollowButton showId={showId} showName={show.name} />
          </div>
        </div>
      </section>

      <div className="space-y-4">
        {[...seasons.entries()]
          .sort((a, b) => b[0] - a[0])
          .map(([season, seasonEps]) => {
            const seasonAired = seasonEps.filter((e) => e.number !== null && aired(e));
            const seasonWatched = seasonAired.filter((e) => watchedIds.has(e.id)).length;
            const allWatched = seasonAired.length > 0 && seasonWatched === seasonAired.length;
            return (
              <details
                key={season}
                open={!allWatched}
                className="group overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60"
              >
                <summary className="flex cursor-pointer select-none items-center gap-3 p-3 hover:bg-zinc-900">
                  <span className="font-medium">Season {season}</span>
                  <span className="text-xs text-zinc-500">
                    {seasonWatched}/{seasonAired.length} watched
                    {seasonEps.length - seasonAired.length > 0 &&
                      ` · ${seasonEps.length - seasonAired.length} unaired`}
                  </span>
                  <span className="ml-auto flex items-center gap-2">
                    {seasonAired.length > 0 && (
                      <form
                        action={async () => {
                          "use server";
                          await setSeasonWatched(showId, season, !allWatched);
                        }}
                      >
                        <button className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-200">
                          {allWatched ? "Unwatch season" : "Mark season watched"}
                        </button>
                      </form>
                    )}
                    <span className="text-zinc-600 transition-transform group-open:rotate-90">
                      ›
                    </span>
                  </span>
                </summary>
                <ul className="border-t border-zinc-800/60">
                  {seasonEps.map((e) => {
                    const isWatched = watchedIds.has(e.id);
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
                        <span
                          className={`min-w-0 flex-1 truncate text-sm ${
                            isWatched ? "text-zinc-500" : "text-zinc-200"
                          }`}
                        >
                          {e.name ?? "TBA"}
                        </span>
                        <span className="hidden shrink-0 text-xs text-zinc-600 sm:block">
                          {formatDate(e.airdate ?? e.airstamp)}
                        </span>
                        {hasAired ? (
                          <span className="flex shrink-0 items-center gap-1.5">
                            {!isWatched && e.number !== null && (
                              <CatchUpButton episodeId={e.id} />
                            )}
                            <WatchedButton episodeId={e.id} isWatched={isWatched} size="sm" />
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-600">
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

      {similarShows.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-zinc-300">More like this</h2>
          <SimilarGrid items={similarShows} followedNames={followedNames} />
        </section>
      ) : (
        !tmdbConfigured && (
          <p className="text-xs text-zinc-600">
            Want “more like this” here? Add a free TMDB key in{" "}
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
