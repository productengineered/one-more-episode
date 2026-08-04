import Image from "next/image";
import { asc, inArray } from "drizzle-orm";
import { followShow, refreshPremieres } from "@/app/actions";
import { RefreshPremieresButton } from "@/components/RefreshPremieresButton";
import { db } from "@/lib/db";
import { premieres, shows } from "@/lib/db/schema";
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

export default async function PremieresPage() {
  const rows = await loadPremieres();
  const upcoming = rows.filter((p) => Date.parse(p.premiereAt) > Date.now() - 86400_000);
  const followedIds = new Set<number>(
    upcoming.length
      ? (
          await db
            .select({ id: shows.id })
            .from(shows)
            .where(inArray(shows.id, upcoming.map((p) => p.showId)))
        ).map((r) => r.id)
      : []
  );

  const byDate = new Map<string, typeof upcoming>();
  for (const p of upcoming) {
    const key = new Date(p.premiereAt).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(p);
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

      {upcoming.length === 0 && (
        <p className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 text-zinc-400">
          No premiere data yet — hit “Refresh premieres”.
        </p>
      )}

      {[...byDate.entries()].map(([date, items]) => (
        <section key={date}>
          <h2 className="mb-2 flex items-baseline gap-2 text-sm font-semibold text-zinc-300">
            {date}
            <span className="font-normal text-zinc-600">
              {relativeDays(items[0].premiereAt)}
            </span>
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {items.map((p) => {
              const genres: string[] = p.genres ? JSON.parse(p.genres) : [];
              const following = followedIds.has(p.showId);
              return (
                <li
                  key={p.showId}
                  className="flex gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3"
                >
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
                        <form
                          action={async () => {
                            "use server";
                            await followShow(p.showId);
                          }}
                        >
                          <button className="shrink-0 rounded-lg bg-violet-600 px-2 py-1 text-xs font-medium text-white hover:bg-violet-500">
                            + Follow
                          </button>
                        </form>
                      )}
                    </div>
                    <p className="truncate text-xs text-zinc-500">
                      {[p.network, p.showType, genres.slice(0, 3).join(" · ")]
                        .filter(Boolean)
                        .join("  ·  ")}
                    </p>
                    <p className="line-clamp-2 pt-1 text-sm text-zinc-400">
                      {stripHtml(p.summary)}
                    </p>
                    <p className="pt-1 text-xs text-zinc-600">{formatDateTime(p.premiereAt)}</p>
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

function relativeAge(iso: string): string {
  const hours = Math.round((Date.now() - Date.parse(iso)) / 3600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
