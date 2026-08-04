import Image from "next/image";
import Link from "next/link";
import { inArray } from "drizzle-orm";
import { followShow } from "@/app/actions";
import { db } from "@/lib/db";
import { shows } from "@/lib/db/schema";
import { stripHtml } from "@/lib/format";
import { searchShows } from "@/lib/tvmaze";

export const dynamic = "force-dynamic";

export default async function AddPage({ searchParams }: PageProps<"/add">) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  const results = query ? await searchShows(query) : [];
  const followedIds = new Set<number>(
    results.length
      ? (
          await db
            .select({ id: shows.id })
            .from(shows)
            .where(inArray(shows.id, results.map((r) => r.show.id)))
        ).map((r) => r.id)
      : []
  );

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold tracking-tight">Add a show</h1>
      <form action="/add" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search TVmaze — e.g. Severance"
          autoFocus
          className="w-full max-w-md rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none placeholder:text-zinc-600 focus:border-violet-500"
        />
        <button className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500">
          Search
        </button>
      </form>

      {query && results.length === 0 && (
        <p className="text-zinc-500">No results for “{query}”.</p>
      )}

      <ul className="space-y-3">
        {results.map(({ show }) => {
          const year = show.premiered?.slice(0, 4);
          const following = followedIds.has(show.id);
          return (
            <li
              key={show.id}
              className="flex gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3"
            >
              {show.image?.medium ? (
                <Image
                  src={show.image.medium}
                  alt=""
                  width={56}
                  height={78}
                  className="h-[78px] w-14 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="h-[78px] w-14 shrink-0 rounded-lg bg-zinc-800" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {show.name}
                  {year && <span className="ml-2 text-sm text-zinc-500">{year}</span>}
                </p>
                <p className="text-xs text-zinc-500">
                  {[show.network?.name ?? show.webChannel?.name, show.status]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <p className="line-clamp-2 pt-1 text-sm text-zinc-400">
                  {stripHtml(show.summary)}
                </p>
                <Link
                  href={`/similar?name=${encodeURIComponent(show.name)}&imdb=${
                    show.externals?.imdb ?? ""
                  }&tvdb=${show.externals?.thetvdb ?? ""}`}
                  className="inline-block pt-1 text-xs text-violet-400 hover:underline"
                >
                  Shows like this →
                </Link>
              </div>
              <div className="shrink-0 self-center">
                {following ? (
                  <span className="rounded-lg bg-emerald-500/15 px-3 py-1.5 text-sm text-emerald-400">
                    ✓ Following
                  </span>
                ) : (
                  <form
                    action={async () => {
                      "use server";
                      await followShow(show.id);
                    }}
                  >
                    <button className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500">
                      + Follow
                    </button>
                  </form>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
