import Image from "next/image";
import Link from "next/link";
import { eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { plexEpisodes, plexShows } from "@/lib/db/schema";
import { dayLabel, epCode, formatDateTime, relativeDays } from "@/lib/format";
import { getAllProgress, getUpcoming } from "@/lib/queries";
import { getUserTimezone } from "@/lib/settings";
import { RefreshAllButton } from "@/components/RefreshAllButton";
import { TodayScroll } from "@/components/TodayScroll";

export const dynamic = "force-dynamic";
// "Refresh air dates" syncs many shows against a throttled API.
export const maxDuration = 60;

export default async function UpcomingPage() {
  const [tz, upcoming, progress, plexShowRows, plexEpisodeRows] = await Promise.all([
    getUserTimezone(),
    getUpcoming(),
    getAllProgress(),
    db
      .select({ id: plexShows.tvmazeShowId })
      .from(plexShows)
      .where(isNotNull(plexShows.tvmazeShowId)),
    db
      .select({
        showId: plexShows.tvmazeShowId,
        season: plexEpisodes.season,
        number: plexEpisodes.number,
      })
      .from(plexEpisodes)
      .innerJoin(plexShows, eq(plexEpisodes.showRatingKey, plexShows.ratingKey))
      .where(isNotNull(plexShows.tvmazeShowId)),
  ]);
  const plexShowIds = new Set(plexShowRows.map((r) => r.id));
  const plexEpisodeKeys = new Set(
    plexEpisodeRows
      .filter((r) => r.season !== null && r.number !== null)
      .map((r) => `${r.showId}:${r.season}:${r.number}`)
  );

  const todayLabel = dayLabel(new Date().toISOString(), tz);
  const now = Date.now();
  interface DayGroup {
    label: string;
    items: typeof upcoming;
    isPast: boolean;
    isToday: boolean;
  }
  const groups: DayGroup[] = [];
  for (const u of upcoming) {
    const label = dayLabel(u.episode.airstamp!, tz);
    let g = groups[groups.length - 1];
    if (!g || g.label !== label) {
      g = {
        label,
        items: [],
        isToday: label === todayLabel,
        isPast: label !== todayLabel && Date.parse(u.episode.airstamp!) < now,
      };
      groups.push(g);
    }
    g.items.push(u);
  }
  const hasPast = groups.some((g) => g.isPast);
  const firstCurrentIdx = groups.findIndex((g) => !g.isPast);

  // "Waiting for a date" should only count shows with a *future* episode.
  const scheduledShowIds = new Set(
    upcoming
      .filter((u) => Date.parse(u.episode.airstamp!) > Date.now())
      .map((u) => u.show.id)
  );
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

      {groups.length === 0 && (
        <p className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 text-zinc-400">
          Nothing scheduled in the next few months.
        </p>
      )}

      {hasPast && <TodayScroll />}
      {groups.map((g, i) => (
        <section key={g.label} className={g.isPast ? "opacity-55" : undefined}>
          {i === firstCurrentIdx && <div id="today-anchor" className="scroll-mt-20" />}
          <h2
            className={`mb-2 flex items-baseline gap-2 text-sm font-semibold ${
              g.isPast ? "text-zinc-600" : "text-zinc-300"
            }`}
          >
            {g.label}
            {g.isToday ? (
              <span className="rounded-full bg-violet-600/20 px-2 py-px text-xs font-semibold text-violet-300">
                Today
              </span>
            ) : (
              <span className="font-normal text-zinc-600">
                {relativeDays(g.items[0].episode.airstamp!)}
              </span>
            )}
          </h2>
          <ul
            className={`overflow-hidden rounded-xl border bg-zinc-900/60 ${
              g.isPast ? "border-zinc-800/50" : "border-zinc-800"
            }`}
          >
            {g.items.map(({ show, episode }) => (
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
                  {plexEpisodeKeys.has(`${show.id}:${episode.season}:${episode.number}`) ? (
                    <p
                      className="mt-0.5 text-sm font-semibold text-amber-400"
                      title="Episode is in your Plex"
                    >
                      » In Plex
                    </p>
                  ) : (
                    plexShowIds.has(show.id) && (
                      <p
                        className="mt-0.5 text-sm text-amber-700"
                        title="Show is on your Plex — this episode isn't there yet"
                      >
                        » Plex
                      </p>
                    )
                  )}
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
