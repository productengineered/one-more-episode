import Image from "next/image";
import Link from "next/link";
import { refreshMovies } from "@/app/actions";
import { RefreshMoviesButton } from "@/components/RefreshMoviesButton";
import { TodayScroll } from "@/components/TodayScroll";
import { TrackMovieButton } from "@/components/TrackMovieButton";
import { TrailerButton } from "@/components/TrailerButton";
import { db } from "@/lib/db";
import {
  moviesFeed,
  plexMovies,
  trackedMovies,
  type MovieFeedItem,
} from "@/lib/db/schema";
import { dayLabel, formatDate, relativeDays } from "@/lib/format";
import { getUserTimezone } from "@/lib/settings";
import { isTmdbConfigured, tmdbPosterUrl } from "@/lib/tmdb";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// A movie's timeline slot: digital date when known, theatrical until then.
function displayDate(m: { digitalAt: string | null; theatricalAt: string | null }) {
  return m.digitalAt ?? m.theatricalAt;
}

export default async function MoviesPage() {
  if (!(await isTmdbConfigured())) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold tracking-tight">Movies</h1>
        <p className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 text-zinc-400">
          Movies need a free TMDB API key —{" "}
          <Link href="/settings" className="text-violet-400 hover:underline">
            add one in Settings
          </Link>{" "}
          to unlock this page.
        </p>
      </div>
    );
  }

  let [feed, tracked, plexRows, tz] = await Promise.all([
    db.select().from(moviesFeed),
    db.select().from(trackedMovies),
    db.select({ tmdbId: plexMovies.tmdbId }).from(plexMovies),
    getUserTimezone(),
  ]);
  if (!feed.length) {
    // First visit: build the feed inline (a couple of TMDB calls, a few
    // seconds). revalidatePath can't run during render, so ignore the error
    // and re-read the table unconditionally.
    try {
      await refreshMovies();
    } catch {
      // offline — page renders its empty state
    }
    feed = await db.select().from(moviesFeed);
  }
  const inPlex = new Set(plexRows.map((r) => r.tmdbId).filter(Boolean));
  const trackedIds = new Set(tracked.map((t) => t.tmdbId));

  const now = Date.now();
  const from = now - 60 * 86400_000;
  const to = now + 180 * 86400_000;
  const items = feed
    .filter((m) => {
      const d = displayDate(m);
      return d && Date.parse(d) >= from && Date.parse(d) <= to;
    })
    .sort((a, b) => displayDate(a)!.localeCompare(displayDate(b)!));

  const todayLabel = dayLabel(new Date().toISOString(), tz);
  interface DayGroup {
    label: string;
    items: MovieFeedItem[];
    isPast: boolean;
    isToday: boolean;
  }
  const groups: DayGroup[] = [];
  for (const m of items) {
    // Release dates are date-only; render them verbatim (UTC) so they never shift.
    const label = dayLabel(`${displayDate(m)!}T00:00:00Z`, "UTC");
    let g = groups[groups.length - 1];
    if (!g || g.label !== label) {
      g = {
        label,
        items: [],
        isToday: label === todayLabel,
        isPast: label !== todayLabel && Date.parse(displayDate(m)!) < now,
      };
      groups.push(g);
    }
    g.items.push(m);
  }
  const hasPast = groups.some((g) => g.isPast);
  const firstCurrentIdx = groups.findIndex((g) => !g.isPast);
  const fetchedAt = feed[0]?.fetchedAt;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-rose-600 text-sm">
              🎬
            </span>
            Movies
          </h1>
          <p className="text-sm text-zinc-500">
            Popular US releases · digital date when known, theatrical until then
            {fetchedAt && ` · updated ${relativeAge(fetchedAt)}`}
          </p>
        </div>
        <RefreshMoviesButton />
      </div>

      {tracked.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-rose-300">★ Tracking</h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {tracked
              .slice()
              .sort((a, b) => (displayDate(a) ?? "9999").localeCompare(displayDate(b) ?? "9999"))
              .map((t) => {
                const digitalOut = t.digitalAt && Date.parse(t.digitalAt) <= now;
                return (
                  <li
                    key={t.tmdbId}
                    className="flex items-center gap-3 rounded-xl border border-rose-900/40 bg-zinc-900/60 p-3"
                  >
                    <Poster path={t.posterPath} title={t.title} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {t.title}
                        {t.year && <span className="ml-2 text-sm text-zinc-500">{t.year}</span>}
                      </p>
                      {t.digitalAt ? (
                        <p className={`text-sm ${digitalOut ? "text-emerald-400" : "text-rose-300"}`}>
                          {digitalOut
                            ? `Available now — digital since ${formatDate(t.digitalAt)}`
                            : `Digital ${formatDate(t.digitalAt)} (${relativeDays(`${t.digitalAt}T12:00:00Z`)})`}
                        </p>
                      ) : (
                        <p className="text-sm text-zinc-500">
                          In theaters — waiting for a digital date
                        </p>
                      )}
                      {inPlex.has(t.tmdbId) && (
                        <p className="text-sm font-semibold text-amber-400">» In Plex</p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <TrailerButton
                        showName={t.title}
                        hints={{ tmdbId: t.tmdbId, movie: true }}
                        size="sm"
                      />
                      <TrackMovieButton tmdbId={t.tmdbId} tracked size="sm" />
                    </div>
                  </li>
                );
              })}
          </ul>
        </section>
      )}

      {groups.length === 0 && (
        <p className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 text-zinc-400">
          No release data yet — hit “Refresh”.
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
              <span className="rounded-full bg-rose-600/20 px-2 py-px text-xs font-semibold text-rose-300">
                Today
              </span>
            ) : (
              <span className="font-normal text-zinc-600">
                {relativeDays(`${displayDate(g.items[0])!}T12:00:00Z`)}
              </span>
            )}
          </h2>
          <ul
            className={`overflow-hidden rounded-xl border bg-zinc-900/60 ${
              g.isPast ? "border-zinc-800/50" : "border-zinc-800"
            }`}
          >
            {g.items.map((m) => {
              const digital = !!m.digitalAt;
              return (
                <li
                  key={m.tmdbId}
                  className="flex items-center gap-3 border-b border-zinc-800/60 p-3 last:border-0"
                >
                  <Poster path={m.posterPath} title={m.title} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {m.title}
                      {m.year && <span className="ml-2 text-sm text-zinc-500">{m.year}</span>}
                    </p>
                    <p className="line-clamp-1 text-sm text-zinc-500">{m.overview}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:hidden">
                      {digital ? (
                        <span className="rounded-full bg-rose-500/20 px-2 py-0.5 font-semibold text-rose-300">
                          DIGITAL
                        </span>
                      ) : (
                        <span
                          className="rounded-full border border-zinc-700 px-2 py-0.5 text-zinc-400"
                          title="Theatrical release — no digital date announced yet"
                        >
                          THEATERS
                        </span>
                      )}
                      <span className="text-zinc-500">{formatDate(displayDate(m))}</span>
                      {inPlex.has(m.tmdbId) && (
                        <span className="font-semibold text-amber-400">» In Plex</span>
                      )}
                    </p>
                  </div>
                  <div className="hidden shrink-0 text-right text-xs sm:block">
                    {digital ? (
                      <span className="rounded-full bg-rose-500/20 px-2 py-0.5 font-semibold text-rose-300">
                        DIGITAL
                      </span>
                    ) : (
                      <span
                        className="rounded-full border border-zinc-700 px-2 py-0.5 text-zinc-400"
                        title="Theatrical release — no digital date announced yet"
                      >
                        THEATERS · digital TBA
                      </span>
                    )}
                    <p className="mt-1 text-zinc-500">{formatDate(displayDate(m))}</p>
                    {digital && m.theatricalAt && (
                      <p className="text-zinc-600">theaters {formatDate(m.theatricalAt)}</p>
                    )}
                    {inPlex.has(m.tmdbId) && (
                      <p className="mt-0.5 text-sm font-semibold text-amber-400">» In Plex</p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <TrailerButton
                      showName={m.title}
                      hints={{ tmdbId: m.tmdbId, movie: true }}
                      size="sm"
                    />
                    <TrackMovieButton
                      tmdbId={m.tmdbId}
                      tracked={trackedIds.has(m.tmdbId)}
                      size="sm"
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Poster({ path, title }: { path: string | null; title: string }) {
  const url = tmdbPosterUrl(path, "w154");
  return url ? (
    <Image
      src={url}
      alt=""
      width={40}
      height={60}
      className="h-[60px] w-10 shrink-0 rounded-md object-cover"
    />
  ) : (
    <div
      className="grid h-[60px] w-10 shrink-0 place-items-center rounded-md bg-zinc-800 text-[8px] text-zinc-500"
      title={title}
    >
      🎬
    </div>
  );
}

function relativeAge(iso: string): string {
  const hours = Math.round((Date.now() - Date.parse(iso)) / 3600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
