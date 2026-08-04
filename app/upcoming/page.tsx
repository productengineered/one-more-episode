import Image from "next/image";
import Link from "next/link";
import { dayLabel, epCode, formatDateTime, relativeDays } from "@/lib/format";
import { getAllProgress, getUpcoming } from "@/lib/queries";
import { getUserTimezone } from "@/lib/settings";
import { RefreshAllButton } from "@/components/RefreshAllButton";

export const dynamic = "force-dynamic";
// "Refresh air dates" syncs many shows against a throttled API.
export const maxDuration = 60;

export default async function UpcomingPage() {
  const tz = await getUserTimezone();
  const [upcoming, progress] = await Promise.all([getUpcoming(), getAllProgress()]);

  const byDate = new Map<string, typeof upcoming>();
  for (const u of upcoming) {
    const key = dayLabel(u.episode.airstamp!, tz);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(u);
  }

  const scheduledShowIds = new Set(upcoming.map((u) => u.show.id));
  const waiting = progress.filter(
    (p) => !scheduledShowIds.has(p.show.id) && p.show.status !== "Ended"
  );
  const endedCount = progress.filter((p) => p.show.status === "Ended").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Upcoming</h1>
        <RefreshAllButton />
      </div>

      {byDate.size === 0 && (
        <p className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 text-zinc-400">
          Nothing scheduled in the next few months.
        </p>
      )}

      {[...byDate.entries()].map(([date, items]) => (
        <section key={date}>
          <h2 className="mb-2 flex items-baseline gap-2 text-sm font-semibold text-zinc-300">
            {date}
            <span className="font-normal text-zinc-600">
              {relativeDays(items[0].episode.airstamp!)}
            </span>
          </h2>
          <ul className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60">
            {items.map(({ show, episode }) => (
              <li
                key={episode.id}
                data-scroll-anchor={`episode-${episode.id}`}
                className="flex items-center gap-3 border-b border-zinc-800/60 p-3 last:border-0"
              >
                <Link href={`/shows/${show.id}`} className="shrink-0">
                  {show.imageMedium ? (
                    <Image
                      src={show.imageMedium}
                      alt=""
                      width={40}
                      height={56}
                      className="h-14 w-10 rounded-md object-cover"
                    />
                  ) : (
                    <div className="h-14 w-10 rounded-md bg-zinc-800" />
                  )}
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/shows/${show.id}`}
                    className="truncate font-medium hover:text-violet-300"
                  >
                    {show.name}
                  </Link>
                  <p className="truncate text-sm text-zinc-400">
                    <span className="font-mono text-xs text-zinc-500">
                      {epCode(episode.season, episode.number)}
                    </span>{" "}
                    {episode.name ?? "TBA"}
                  </p>
                </div>
                <div className="shrink-0 text-right text-xs text-zinc-500">
                  <p>{formatDateTime(episode.airstamp, tz)}</p>
                  {show.network && <p className="text-zinc-600">{show.network}</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {waiting.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-zinc-300">
            Waiting for a date{" "}
            <span className="font-normal text-zinc-600">
              — running or between seasons, nothing scheduled yet
            </span>
          </h2>
          <ul className="flex flex-wrap gap-2">
            {waiting.map((p) => (
              <li key={p.show.id}>
                <Link
                  href={`/shows/${p.show.id}`}
                  className="inline-block rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1 text-sm text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                >
                  {p.show.name}
                  <span className="ml-1.5 text-xs text-zinc-600">{p.show.status}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {endedCount > 0 && (
        <p className="text-sm text-zinc-600">
          {endedCount} of your shows have ended —{" "}
          <Link href="/shows" className="text-zinc-500 hover:text-zinc-300">
            see them under Shows
          </Link>
          .
        </p>
      )}
    </div>
  );
}
