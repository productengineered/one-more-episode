import { SimilarCard } from "./SimilarCard";
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
      {items.map((s) => (
        <SimilarCard
          key={s.tmdbId}
          tmdbId={s.tmdbId}
          name={s.name}
          year={s.year}
          posterUrl={tmdbPosterUrl(s.posterPath)}
          voteAverage={s.voteAverage}
          following={followedNames.has(s.name.toLowerCase())}
        />
      ))}
    </ul>
  );
}
