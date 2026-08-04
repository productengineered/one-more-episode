import Image from "next/image";
import { FollowTmdbButton } from "./FollowTmdbButton";
import { tmdbPosterUrl } from "@/lib/tmdb";

export interface SimilarItem {
  tmdbId: number;
  name: string;
  year: string | null;
  overview: string | null;
  posterPath: string | null;
  voteAverage: number | null;
}

export function SimilarGrid({
  items,
  followedNames,
}: {
  items: SimilarItem[];
  followedNames: Set<string>;
}) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {items.map((s) => {
        const poster = tmdbPosterUrl(s.posterPath);
        const following = followedNames.has(s.name.toLowerCase());
        return (
          <li
            key={s.tmdbId}
            className="flex gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-2.5"
          >
            {poster ? (
              <Image
                src={poster}
                alt=""
                width={56}
                height={84}
                className="h-[84px] w-14 shrink-0 rounded-md object-cover"
              />
            ) : (
              <div className="h-[84px] w-14 shrink-0 rounded-md bg-zinc-800" />
            )}
            <div className="flex min-w-0 flex-1 flex-col">
              <p className="truncate text-sm font-medium">{s.name}</p>
              <p className="text-xs text-zinc-500">
                {[s.year, s.voteAverage ? `★ ${s.voteAverage.toFixed(1)}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <div className="mt-auto pt-1.5">
                {following ? (
                  <span className="rounded-md bg-emerald-500/15 px-2 py-1 text-xs text-emerald-400">
                    ✓ Following
                  </span>
                ) : (
                  <FollowTmdbButton tmdbId={s.tmdbId} />
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
