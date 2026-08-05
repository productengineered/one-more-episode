import Image from "next/image";
import { asc, inArray } from "drizzle-orm";
import { refreshAiring } from "@/app/actions";
import { DiscoverFilters, type FilterOption } from "@/components/DiscoverFilters";
import { FollowButton } from "@/components/FollowButton";
import { RefreshAiringButton } from "@/components/RefreshAiringButton";
import { db } from "@/lib/db";
import { airing, shows, type AiringShow } from "@/lib/db/schema";
import { dayLabel, epCode, formatDateTime, relativeDays, stripHtml } from "@/lib/format";
import { getUserTimezone } from "@/lib/settings";
import { isTmdbConfigured } from "@/lib/tmdb";
import { TrailerButton } from "@/components/TrailerButton";

export const dynamic = "force-dynamic";
// The full-schedule refresh downloads and parses a large feed — allow more
// than serverless defaults.
export const maxDuration = 60;

const RENDER_CAP = 200;

async function loadAiring() {
  let rows = await db.select().from(airing).orderBy(asc(airing.nextAirAt));
  if (!rows.length) {
    // First visit: build the table inline (one big TVmaze request, a few
    // seconds). revalidatePath can't run during render, so ignore the error
    // and re-read the table unconditionally.
    try {
      await refreshAiring();
    } catch {
      // offline — page renders its empty state
    }
    rows = await db.select().from(airing).orderBy(asc(airing.nextAirAt));
  }
  return rows;
}

function options(rows: AiringShow[], pick: (p: AiringShow) => string[]): FilterOption[] {
  const counts = new Map<string, number>();
  for (const p of rows) {
    for (const v of pick(p)) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

function parseGenres(p: AiringShow): string[] {
  return p.genres ? JSON.parse(p.genres) : [];
}

export default async function DiscoverPage({ searchParams }: PageProps<"/discover">) {
  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const current = {
    q: get("q"),
    stage: get("stage"),
    sort: get("sort"),
    type: get("type"),
    platform: get("platform"),
    genre: get("genre"),
    country: get("country"),
  };

  const [rows, tz, tmdbConfigured] = await Promise.all([
    loadAiring(),
    getUserTimezone(),
    isTmdbConfigured(),
  ]);
  const upcoming = rows.filter((p) => Date.parse(p.nextAirAt) > Date.now() - 86400_000);

  let filtered = upcoming;
  if (current.q) {
    const q = current.q.toLowerCase();
    filtered = filtered.filter((p) => p.name.toLowerCase().includes(q));
  }
  if (current.stage === "premieres") filtered = filtered.filter((p) => p.isPremiere);
  if (current.stage === "returning") filtered = filtered.filter((p) => !p.isPremiere);
  if (current.platform) filtered = filtered.filter((p) => p.network === current.platform);
  if (current.type) filtered = filtered.filter((p) => p.showType === current.type);
  if (current.genre) filtered = filtered.filter((p) => parseGenres(p).includes(current.genre));
  if (current.country)
    filtered = filtered.filter((p) => (p.country ?? "Global") === current.country);
  if (current.sort === "buzz") filtered = [...filtered].sort((a, b) => b.weight - a.weight);

  const total = filtered.length;
  filtered = filtered.slice(0, RENDER_CAP);

  const followedIds = new Set<number>(
    filtered.length
      ? (
          await db
            .select({ id: shows.id })
            .from(shows)
            .where(inArray(shows.id, filtered.map((p) => p.showId)))
        ).map((r) => r.id)
      : []
  );

  // Group by date only when date-sorted; buzz sort renders one flat list.
  const groups = new Map<string | null, AiringShow[]>();
  if (current.sort === "buzz") {
    groups.set(null, filtered);
  } else {
    for (const p of filtered) {
      const key = dayLabel(p.nextAirAt, tz);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
    }
  }

  const fetchedAt = rows[0]?.fetchedAt;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Discover</h1>
          <p className="text-sm text-zinc-500">
            {upcoming.length.toLocaleString()} English-language shows airing in the next 180
            days{fetchedAt && ` · updated ${relativeAge(fetchedAt)}`}
          </p>
        </div>
        <RefreshAiringButton />
      </div>

      <DiscoverFilters
        types={options(upcoming, (p) => (p.showType ? [p.showType] : []))}
        platforms={options(upcoming, (p) => (p.network ? [p.network] : []))}
        genres={options(upcoming, parseGenres)}
        countries={options(upcoming, (p) => [p.country ?? "Global"])}
        current={current}
      />

      {total > RENDER_CAP && (
        <p className="text-xs text-zinc-600">
          Showing the first {RENDER_CAP} of {total.toLocaleString()} matches — narrow the
          filters to see the rest.
        </p>
      )}

      {total === 0 && (
        <p className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 text-zinc-400">
          {upcoming.length === 0
            ? "No schedule data yet — hit “Refresh”."
            : "Nothing matches these filters."}
        </p>
      )}

      {[...groups.entries()].map(([date, items]) => (
        <section key={date ?? "buzz"}>
          {date && (
            <h2 className="mb-2 flex items-baseline gap-2 text-sm font-semibold text-zinc-300">
              {date}
              <span className="font-normal text-zinc-600">
                {relativeDays(items[0].nextAirAt)}
              </span>
            </h2>
          )}
          <ul className="grid gap-3 sm:grid-cols-2">
            {items.map((p) => (
              <AiringCard
                key={p.showId}
                item={p}
                following={followedIds.has(p.showId)}
                showBuzz={current.sort === "buzz"}
                trailers={tmdbConfigured}
                tz={tz}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function AiringCard({
  item: p,
  following,
  showBuzz,
  trailers,
  tz,
}: {
  item: AiringShow;
  following: boolean;
  showBuzz: boolean;
  trailers: boolean;
  tz: string | undefined;
}) {
  const genres = parseGenres(p);
  return (
    <li className="flex gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
      {p.imageMedium ? (
        <Image
          src={p.imageMedium}
          alt=""
          width={64}
          height={90}
          className="h-[90px] w-16 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <div className="h-[90px] w-16 shrink-0 rounded-lg bg-zinc-800" />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate font-medium">
            {p.name}
            {p.isPremiere === 1 && (
              <span className="ml-2 rounded-full bg-violet-600/20 px-1.5 py-px text-[10px] font-semibold text-violet-300">
                ✦ PREMIERE
              </span>
            )}
          </p>
          {following ? (
            <span className="shrink-0 rounded-lg bg-emerald-500/15 px-2 py-1 text-xs text-emerald-400">
              ✓ Following
            </span>
          ) : (
            <FollowButton tvmazeId={p.showId} />
          )}
        </div>
        <p className="truncate text-xs text-zinc-500">
          {[p.network, p.showType, genres.slice(0, 3).join(" · ")].filter(Boolean).join("  ·  ")}
        </p>
        <p className="line-clamp-2 pt-1 text-sm text-zinc-400">{stripHtml(p.summary)}</p>
        <div className="flex items-center justify-between gap-2 pt-1">
          <p className="min-w-0 truncate text-xs text-zinc-600">
            {p.season !== null && p.number !== null && (
              <span className="mr-2 font-mono">{epCode(p.season, p.number)}</span>
            )}
            {formatDateTime(p.nextAirAt, tz)}
            {showBuzz && ` · buzz ${p.weight}`}
          </p>
          {trailers && (
            <TrailerButton
              showName={p.name}
              hints={{ imdbId: p.imdbId, tvdbId: p.tvdbId }}
              size="sm"
            />
          )}
        </div>
      </div>
    </li>
  );
}

function relativeAge(iso: string): string {
  const hours = Math.round((Date.now() - Date.parse(iso)) / 3600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
