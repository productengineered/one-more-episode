import Link from "next/link";
import { SimilarGrid } from "@/components/SimilarGrid";
import { db } from "@/lib/db";
import { shows } from "@/lib/db/schema";
import { fetchSimilarByExternal } from "@/lib/similar";
import { isTmdbConfigured } from "@/lib/tmdb";

export const dynamic = "force-dynamic";

export default async function SimilarPage({ searchParams }: PageProps<"/similar">) {
  const sp = await searchParams;
  const name = typeof sp.name === "string" ? sp.name : "";
  const imdbId = typeof sp.imdb === "string" && sp.imdb ? sp.imdb : null;
  const tvdbId = typeof sp.tvdb === "string" && sp.tvdb ? Number(sp.tvdb) : null;

  if (!(await isTmdbConfigured())) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold tracking-tight">
          Shows like {name || "that"}
        </h1>
        <p className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 text-zinc-400">
          Recommendations need a free TMDB API key —{" "}
          <Link href="/settings" className="text-violet-400 hover:underline">
            add one in Settings
          </Link>{" "}
          to unlock this.
        </p>
      </div>
    );
  }

  const items =
    imdbId || tvdbId ? await fetchSimilarByExternal({ imdbId, tvdbId }).catch(() => []) : [];
  const followedNames = new Set(
    (await db.select({ name: shows.name }).from(shows)).map((s) => s.name.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Shows like {name || "that"}
        </h1>
        <p className="text-sm text-zinc-500">
          Recommendations from TMDB ·{" "}
          <Link href="/add" className="text-violet-400 hover:underline">
            back to search
          </Link>
        </p>
      </div>
      {items.length === 0 ? (
        <p className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 text-zinc-400">
          No recommendations found for this one.
        </p>
      ) : (
        <SimilarGrid
          items={items.map((r) => ({
            tmdbId: r.id,
            name: r.name,
            year: r.first_air_date?.slice(0, 4) ?? null,
            overview: r.overview,
            posterPath: r.poster_path,
            voteAverage: r.vote_average,
          }))}
          followedNames={followedNames}
        />
      )}
    </div>
  );
}
