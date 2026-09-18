import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { inArray, or } from "drizzle-orm";
import { refreshMovies } from "@/app/actions";
import { MovieInfoButton } from "@/components/MovieInfo";
import { MovieTabs } from "@/components/MovieTabs";
import { RefreshMoviesButton } from "@/components/RefreshMoviesButton";
import { TrackMovieButton } from "@/components/TrackMovieButton";
import { TrailerButton } from "@/components/TrailerButton";
import { db } from "@/lib/db";
import { moviesFeed, plexMovies, trackedMovies } from "@/lib/db/schema";
import { formatDate, monthLabel, relativeDays, todayIso } from "@/lib/format";
import { getUserTimezone } from "@/lib/settings";
import {
  getUsReleaseDates,
  isTmdbConfigured,
  searchMovies,
  tmdbPosterUrl,
} from "@/lib/tmdb";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// First entry is the default tab (plain /movies).
const TABS = [
  { key: "now", label: "Watch now" },
  { key: "theaters", label: "In theaters" },
  { key: "soon", label: "Coming soon" },
  { key: "tracking", label: "★ Tracking" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

interface MovieDates {
  theatricalAt: string | null;
  digitalAt: string | null;
}

interface RowMovie extends MovieDates {
  tmdbId: number;
  title: string;
  year: number | null;
  posterPath: string | null;
  overview?: string | null;
}

// Earliest US availability, theatrical or digital.
function firstRelease(m: MovieDates): string | null {
  if (m.theatricalAt && m.digitalAt) {
    return m.theatricalAt < m.digitalAt ? m.theatricalAt : m.digitalAt;
  }
  return m.theatricalAt ?? m.digitalAt;
}

function addDays(isoDate: string, days: number): string {
  return new Date(Date.parse(`${isoDate}T00:00:00Z`) + days * 86400_000)
    .toISOString()
    .slice(0, 10);
}

/**
 * Split the feed by where a movie can be watched today: digital is out →
 * Watch now; in cinemas without digital yet → In theaters; not released
 * anywhere → Coming soon. Release dates are date-only strings, so plain
 * string comparison against `today` is exact.
 */
function bucketFeed<T extends MovieDates>(feed: T[], today: string) {
  const from = addDays(today, -60);
  const to = addDays(today, 180);
  const now: T[] = [];
  const theaters: T[] = [];
  const soon: T[] = [];
  for (const m of feed) {
    // Same window the feed is built for, keyed on digital-else-theatrical.
    const slot = m.digitalAt ?? m.theatricalAt;
    if (!slot || slot < from || slot > to) continue;
    if (m.digitalAt && m.digitalAt <= today) now.push(m);
    else if (m.theatricalAt && m.theatricalAt <= today) theaters.push(m);
    else soon.push(m);
  }
  now.sort((a, b) => b.digitalAt!.localeCompare(a.digitalAt!));
  theaters.sort((a, b) => b.theatricalAt!.localeCompare(a.theatricalAt!));
  soon.sort((a, b) => firstRelease(a)!.localeCompare(firstRelease(b)!));
  return { now, theaters, soon };
}

// Only the Plex rows that match a feed or tracked movie — the library is big.
async function plexTmdbIds(): Promise<Set<number>> {
  const rows = await db
    .select({ tmdbId: plexMovies.tmdbId })
    .from(plexMovies)
    .where(
      or(
        inArray(plexMovies.tmdbId, db.select({ id: moviesFeed.tmdbId }).from(moviesFeed)),
        inArray(plexMovies.tmdbId, db.select({ id: trackedMovies.tmdbId }).from(trackedMovies))
      )
    );
  return new Set(rows.map((r) => r.tmdbId).filter((id): id is number => id !== null));
}

async function loadFeed() {
  const [feed, inPlex] = await Promise.all([db.select().from(moviesFeed), plexTmdbIds()]);
  if (feed.length) return { feed, inPlex };
  // First visit: build the feed inline (a couple of TMDB calls, a few
  // seconds). revalidatePath can't run during render, so ignore the error
  // and re-read unconditionally.
  try {
    await refreshMovies();
  } catch {
    // offline — page renders its empty state
  }
  const [rebuilt, rebuiltPlex] = await Promise.all([
    db.select().from(moviesFeed),
    plexTmdbIds(),
  ]);
  return { feed: rebuilt, inPlex: rebuiltPlex };
}

export default async function MoviesPage({ searchParams }: PageProps<"/movies">) {
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

  const sp = await searchParams;
  const query = typeof sp.q === "string" ? sp.q.trim() : "";
  const tab: TabKey = TABS.find((t) => t.key === sp.tab)?.key ?? "now";

  const [{ feed, inPlex }, tracked, tz] = await Promise.all([
    loadFeed(),
    db.select().from(trackedMovies),
    getUserTimezone(),
  ]);
  const today = todayIso(tz);
  const { now, theaters, soon } = bucketFeed(feed, today);
  const trackedIds = new Set(tracked.map((t) => t.tmdbId));
  const counts: Record<TabKey, number> = {
    now: now.length,
    theaters: theaters.length,
    soon: soon.length,
    tracking: tracked.length,
  };

  const row = (m: RowMovie) => (
    <MovieRow
      key={m.tmdbId}
      m={m}
      today={today}
      tracked={trackedIds.has(m.tmdbId)}
      inPlex={inPlex.has(m.tmdbId)}
    />
  );
  const list = (items: RowMovie[], empty: string) =>
    items.length ? (
      <ul className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60">
        {items.map(row)}
      </ul>
    ) : (
      <p className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 text-zinc-400">
        {feed.length ? empty : "No release data yet — hit “Refresh”."}
      </p>
    );

  // Month sections on each tab's own date; items arrive already sorted, so
  // the months come out in the tab's order (newest-first or soonest-first).
  const byMonth = (items: RowMovie[], dateOf: (m: RowMovie) => string, empty: string) => {
    if (!items.length) return list([], empty);
    const months = new Map<string, RowMovie[]>();
    for (const m of items) {
      const label = monthLabel(dateOf(m));
      months.set(label, [...(months.get(label) ?? []), m]);
    }
    return (
      <div className="space-y-6">
        {[...months].map(([label, group]) => (
          <section key={label}>
            <h2 className="mb-2 flex items-baseline gap-2 text-sm font-semibold text-zinc-300">
              {label}
              <span className="font-normal text-zinc-600">{group.length}</span>
            </h2>
            {list(group, "")}
          </section>
        ))}
      </div>
    );
  };

  let panels: Record<string, ReactNode> = {};
  if (!query) {
    panels = {
      now: byMonth(now, (m) => m.digitalAt!, "No new digital releases in the last 60 days."),
      theaters: byMonth(theaters, (m) => m.theatricalAt!, "Nothing in theaters right now."),
      soon: byMonth(soon, (m) => firstRelease(m)!, "No upcoming releases announced."),
      tracking: list(
        tracked
          .slice()
          .sort((a, b) =>
            (a.digitalAt ?? a.theatricalAt ?? "9999").localeCompare(
              b.digitalAt ?? b.theatricalAt ?? "9999"
            )
          ),
        "Nothing tracked yet — hit ☆ Track on any movie to follow its digital date here."
      ),
    };
  }

  return (
    <div className="space-y-4">
      <Header fetchedAt={feed[0]?.fetchedAt} />
      <MovieTabs
        // Remount when entering/leaving a search. Not keyed on tab: a refresh
        // after tracking must not remount (it would close an open info modal).
        key={query}
        tabs={TABS.map((t) => ({ key: t.key, label: t.label, count: counts[t.key] }))}
        initial={tab}
        query={query}
        panels={panels}
        results={
          query ? (
            <SearchResults query={query} tab={tab} today={today} trackedIds={trackedIds} />
          ) : undefined
        }
      />
    </div>
  );
}

function Header({ fetchedAt }: { fetchedAt?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-rose-600 text-sm">
            🎬
          </span>
          Movies
        </h1>
        <p className="text-sm text-zinc-500">
          Popular US releases
          {fetchedAt && ` · updated ${relativeAge(fetchedAt)}`}
        </p>
      </div>
      <RefreshMoviesButton />
    </div>
  );
}

async function SearchResults({
  query,
  tab,
  today,
  trackedIds,
}: {
  query: string;
  tab: TabKey;
  today: string;
  trackedIds: Set<number>;
}) {
  const clear = (
    <Link
      href={tab === TABS[0].key ? "/movies" : `/movies?tab=${tab}`}
      className="font-normal text-rose-400 hover:underline"
    >
      ✕ Clear search
    </Link>
  );
  const results = await searchMovies(query).catch(() => null);
  if (!results) {
    return (
      <p className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 text-zinc-400">
        Couldn’t reach TMDB — try again in a moment.
      </p>
    );
  }
  if (!results.length) {
    return (
      <p className="flex flex-wrap gap-x-2 text-zinc-500">
        No movies match “{query}”. {clear}
      </p>
    );
  }

  const ids = results.map((m) => m.id);
  const [dates, plexRows] = await Promise.all([
    Promise.all(results.map((m) => getUsReleaseDates(m.id, 86400).catch(() => null))),
    db
      .select({ tmdbId: plexMovies.tmdbId })
      .from(plexMovies)
      .where(inArray(plexMovies.tmdbId, ids)),
  ]);
  const inPlex = new Set(plexRows.map((r) => r.tmdbId));

  return (
    <section>
      <h2 className="mb-2 flex flex-wrap items-baseline gap-x-3 text-sm font-semibold text-zinc-300">
        Top matches for “{query}”
        {clear}
      </h2>
      <ul className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60">
        {results.map((r, i) => (
          <MovieRow
            key={r.id}
            m={{
              tmdbId: r.id,
              title: r.title,
              year: r.release_date ? Number(r.release_date.slice(0, 4)) : null,
              posterPath: r.poster_path,
              overview: r.overview,
              theatricalAt: dates[i]?.theatrical ?? null,
              digitalAt: dates[i]?.digital ?? null,
            }}
            today={today}
            tracked={trackedIds.has(r.id)}
            inPlex={inPlex.has(r.id)}
          />
        ))}
      </ul>
    </section>
  );
}

function MovieRow({
  m,
  today,
  tracked,
  inPlex,
}: {
  m: RowMovie;
  today: string;
  tracked: boolean;
  inPlex: boolean;
}) {
  return (
    <li className="flex items-center gap-3 border-b border-zinc-800/60 p-3 last:border-0">
      <MovieInfoButton
        tmdbId={m.tmdbId}
        title={m.title}
        year={m.year}
        posterPath={m.posterPath}
        tracked={tracked}
        inPlex={inPlex}
      >
        <Poster path={m.posterPath} title={m.title} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium transition-colors group-hover:text-rose-300">
            {m.title}
            {m.year && <span className="ml-2 text-sm text-zinc-500">{m.year}</span>}
            <span className="ml-2 hidden text-xs font-normal text-rose-300 group-aria-busy:inline">
              Loading…
            </span>
          </p>
          <ReleaseStatus theatrical={m.theatricalAt} digital={m.digitalAt} today={today} />
          {m.overview && <p className="line-clamp-2 text-sm text-zinc-500">{m.overview}</p>}
          {inPlex && <p className="text-sm font-semibold text-amber-400">» On Plex</p>}
        </div>
      </MovieInfoButton>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <TrailerButton showName={m.title} hints={{ tmdbId: m.tmdbId, movie: true }} size="sm" />
        <TrackMovieButton tmdbId={m.tmdbId} tracked={tracked} size="sm" />
      </div>
    </li>
  );
}

/** One-line US release status. Dates are date-only; `today` is in the user's timezone. */
function ReleaseStatus({
  theatrical,
  digital,
  today,
}: {
  theatrical: string | null;
  digital: string | null;
  today: string;
}) {
  const rel = (d: string) => relativeDays(`${d}T12:00:00Z`);
  if (digital && digital <= today) {
    return <p className="text-sm text-emerald-400">Digital since {formatDate(digital)}</p>;
  }
  if (digital) {
    return (
      <p className="text-sm text-rose-300">
        {theatrical && theatrical <= today
          ? `In theaters · digital ${formatDate(digital)} (${rel(digital)})`
          : theatrical && theatrical < digital
            ? `Theaters ${formatDate(theatrical)} (${rel(theatrical)}) · digital ${formatDate(digital)}`
            : `Digital ${formatDate(digital)} (${rel(digital)})`}
      </p>
    );
  }
  if (theatrical) {
    return (
      <p className="text-sm text-zinc-400">
        {theatrical <= today
          ? `Theaters ${formatDate(theatrical)} · no digital date listed`
          : `Theaters ${formatDate(theatrical)} (${rel(theatrical)})`}
      </p>
    );
  }
  return <p className="text-sm text-zinc-500">No US release date listed</p>;
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
