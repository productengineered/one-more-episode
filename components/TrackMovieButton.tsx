"use client";

import { useTransition } from "react";
import { trackMovie, untrackMovie } from "@/app/actions";

export function TrackMovieButton({
  tmdbId,
  tracked,
  size = "md",
}: {
  tmdbId: number;
  tracked: boolean;
  size?: "sm" | "md";
}) {
  const [pending, startTransition] = useTransition();
  const cls =
    size === "md" ? "rounded-lg px-3 py-1.5 text-sm" : "rounded-md px-2 py-1 text-xs";
  return (
    <button
      onClick={() =>
        startTransition(() => (tracked ? untrackMovie(tmdbId) : trackMovie(tmdbId)))
      }
      disabled={pending}
      className={`${cls} shrink-0 font-medium transition-colors disabled:opacity-60 ${
        tracked
          ? "bg-rose-500/15 text-rose-300 hover:bg-rose-500/25"
          : "border border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:border-zinc-500"
      }`}
    >
      {pending ? "…" : tracked ? "★ Tracking" : "☆ Track"}
    </button>
  );
}
