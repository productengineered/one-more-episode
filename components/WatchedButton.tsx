"use client";

import { useTransition } from "react";
import { setEpisodeWatched } from "@/app/actions";

export function WatchedButton({
  episodeId,
  isWatched,
  size = "md",
}: {
  episodeId: number;
  isWatched: boolean;
  size?: "sm" | "md";
}) {
  const [pending, startTransition] = useTransition();
  const base =
    size === "sm"
      ? "h-9 w-9 rounded-full text-xs sm:h-7 sm:w-7"
      : "h-9 rounded-lg px-3 text-sm font-medium";
  return (
    <button
      onClick={() => startTransition(() => setEpisodeWatched(episodeId, !isWatched))}
      disabled={pending}
      title={isWatched ? "Mark unwatched" : "Mark watched"}
      className={`${base} shrink-0 border transition-colors disabled:opacity-50 ${
        isWatched
          ? "border-violet-500/40 bg-violet-600/20 text-violet-300 hover:bg-violet-600/30"
          : "border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
      }`}
    >
      {pending ? "…" : size === "sm" ? "✓" : isWatched ? "✓ Watched" : "✓ Watched?"}
    </button>
  );
}
