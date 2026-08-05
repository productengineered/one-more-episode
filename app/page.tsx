import Image from "next/image";
import Link from "next/link";
import { WatchedButton } from "@/components/WatchedButton";
import { ProgressBar } from "@/components/ProgressBar";
import { epCode, formatDate } from "@/lib/format";
import { getAllProgress } from "@/lib/queries";
import { getUserTimezone } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function WatchNextPage() {
  const [tz, progress] = await Promise.all([getUserTimezone(), getAllProgress()]);
  const behind = progress
    .filter((p) => p.nextUnwatched)
    .sort((a, b) => {
      // Shows you touched recently float to the top.
      const la = a.lastWatchedAt ?? "";
      const lb = b.lastWatchedAt ?? "";
      if (la !== lb) return la < lb ? 1 : -1;
      return a.show.name.localeCompare(b.show.name);
    });
  const caughtUp = progress.length - behind.length;

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Watch Next</h1>
        <p className="text-sm text-zinc-500">
          {behind.length} shows to catch up on · {caughtUp} up to date
        </p>
      </div>

      {behind.length === 0 && (
        <p className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 text-zinc-400">
          You&apos;re caught up on everything. Check{" "}
          <Link href="/upcoming" className="text-violet-400 hover:underline">
            what&apos;s coming up
          </Link>
          .
        </p>
      )}

      <ul className="grid gap-3 sm:grid-cols-2">
        {behind.map(({ show, nextUnwatched, airedCount, watchedCount }) => {
          const ep = nextUnwatched!;
          const remaining = airedCount - watchedCount;
          return (
            <li
              key={show.id}
              data-scroll-anchor={`show-${show.id}`}
              className="flex gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 transition-colors hover:border-zinc-700"
            >
              <Link href={`/shows/${show.id}`} className="shrink-0">
                {show.imageMedium ? (
                  <Image
                    src={show.imageMedium}
                    alt=""
                    width={64}
                    height={90}
                    className="h-[90px] w-16 rounded-lg object-cover"
                  />
                ) : (
                  <div className="h-[90px] w-16 rounded-lg bg-zinc-800" />
                )}
              </Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/shows/${show.id}`}
                    className="truncate font-medium hover:text-violet-300"
                  >
                    {show.name}
                  </Link>
                  {remaining > 1 && (
                    <span className="shrink-0 rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                      {remaining} left
                    </span>
                  )}
                </div>
                <p className="truncate text-sm text-zinc-400">
                  <span className="font-mono text-xs text-zinc-500">
                    {epCode(ep.season, ep.number)}
                  </span>{" "}
                  {ep.name}
                </p>
                <p className="text-xs text-zinc-600">{formatDate(ep.airstamp ?? ep.airdate, tz)}</p>
                <div className="mt-auto flex items-center gap-3 pt-2">
                  <div className="flex-1">
                    <ProgressBar value={watchedCount} max={airedCount} />
                  </div>
                  <WatchedButton episodeId={ep.id} isWatched={false} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
