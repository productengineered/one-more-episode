import Image from "next/image";
import { asc, inArray } from "drizzle-orm";
import { refreshPremieres } from "@/app/actions";
import { FollowButton } from "@/components/FollowButton";
import { PremiereFilters, type FilterOption } from "@/components/PremiereFilters";
import { RefreshPremieresButton } from "@/components/RefreshPremieresButton";
import { db } from "@/lib/db";
import { premieres, shows, type Premiere } from "@/lib/db/schema";
import { formatDateTime, relativeDays, stripHtml } from "@/lib/format";

export const dynamic = "force-dynamic";

async function loadPremieres() {
  let rows = await db.select().from(premieres).orderBy(asc(premieres.premiereAt));
  if (!rows.length) {
    // First visit: build the table inline (one big TVmaze request, a few seconds).
    try {
      await refreshPremieres();
      rows = await db.select().from(premieres).orderBy(asc(premieres.premiereAt));
    } catch {
      // offline — page renders its empty state
    }
  }
  return rows;
}

function options(rows: Premiere[], pick: (p: Premiere) => string[]): FilterOption[] {
  const counts = new Map<string, number>();
  for (const p of rows) {
    for (const v of pick(p)) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

function parseGenres(p: Premiere): string[] {
  return p.genres ? JSON.parse(p.genres) : [];
}

export default async function PremieresPage({ searchParams }: PageProps<"/premieres">) {
  const sp = await searchParams;
  const current = {
    sort: typeof sp.sort === "string" ? sp.sort : "",
    type: typeof sp.type === "string" ? sp.type : "",
    platform: typeof sp.platform === "string" ? sp.platform : "",
    genre: typeof sp.genre === "string" ? sp.genre : "",
    country: typeof sp.country === "string" ? sp.country : "",
  };

  const rows = await loadPremieres();
  const upcoming = rows.filter((p) => Date.parse(p.premiereAt) > Date.now() - 86400_000);

  let filtered = upcoming;
  if (current.platform) filtered = filtered.filter((p) => p.network === current.platform);
  if (current.type) filtered = filtered.filter((p) => p.showType === current.type);
  if (current.genre) filtered = filtered.filter((p) => parseGenres(p).includes(current.genre));
  if (current.country)
    filtered = filtered.filter((p) => (p.country ?? "Global") === current.country);
  if (current.sort === "buzz") filtered = [...filtered].sort((a, b) => b.weight - a.weight);

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
  const groups = new Map<string | null, Premiere[]>();
  if (current.sort === "buzz") {
    groups.set(null, filtered);
  } else {
    for (const p of filtered) {
      const key = new Date(p.premiereAt).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
    }
  }

  const fetchedAt = rows[0]?.fetchedAt;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">New show premieres</h1>
          <p className="text-sm text-zinc-500">
            English-language series premiering in the next 90 days
            {fetchedAt && ` · updated ${relativeAge(fetchedAt)}`}
          </p>
        </div>
        <RefreshPremieresButton />
      </div>

      <PremiereFilters
        types={options(upcoming, (p) => (p.showType ? [p.showType] : []))}
        platforms={options(upcoming, (p) => (p.network ? [p.network] : []))}
        genres={options(upcoming, parseGenres)}
        countries={options(upcoming, (p) => [p.country ?? "Global"])}
        current={current}
      />

      {filtered.length === 0 && (
        <p className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 text-zinc-400">
          {upcoming.length === 0
            ? "No premiere data yet — hit “Refresh premieres”."
            : "No premieres match these filters."}
        </p>
      )}

      {[...groups.entries()].map(([date, items]) => (
        <section key={date ?? "buzz"}>
          {date && (
            <h2 className="mb-2 flex items-baseline gap-2 text-sm font-semibold text-zinc-300">
              {date}
              <span className="font-normal text-zinc-600">
                {relativeDays(items[0].premiereAt)}
              </span>
            </h2>
          )}
          <ul className="grid gap-3 sm:grid-cols-2">
            {items.map((p) => (
              <PremiereCard
                key={p.showId}
                premiere={p}
                following={followedIds.has(p.showId)}
                showBuzz={current.sort === "buzz"}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function PremiereCard({
  premiere: p,
  following,
  showBuzz,
}: {
  premiere: Premiere;
  following: boolean;
  showBuzz: boolean;
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
          <p className="truncate font-medium">{p.name}</p>
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
        <p className="pt-1 text-xs text-zinc-600">
          {formatDateTime(p.premiereAt)}
          {showBuzz && ` · buzz ${p.weight}`}
        </p>
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
