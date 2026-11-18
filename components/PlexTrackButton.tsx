"use client";

import { useState, useTransition } from "react";
import { setPlexTracked } from "@/app/actions";

/** "Track for Plex" checkbox toggle — flips instantly, saves in the background. */
export function PlexTrackButton({ showId, initial }: { showId: number; initial: boolean }) {
  const [tracked, setTracked] = useState(initial);
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={tracked}
      onClick={() => {
        const next = !tracked;
        setTracked(next);
        startTransition(async () => {
          try {
            await setPlexTracked(showId, next);
          } catch {
            setTracked(!next);
          }
        });
      }}
      disabled={pending}
      title="Show On Plex / Not on Plex for this show's episodes on Upcoming"
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors disabled:opacity-70 ${
        tracked
          ? "border-amber-500/60 bg-amber-500/10 text-amber-300"
          : "border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:border-zinc-500"
      }`}
    >
      <span
        aria-hidden
        className={`grid h-4 w-4 place-items-center rounded border text-[11px] leading-none ${
          tracked ? "border-amber-400 bg-amber-400 text-zinc-950" : "border-zinc-500"
        }`}
      >
        {tracked && "✓"}
      </span>
      {pending ? "Saving…" : "Track for Plex"}
    </button>
  );
}
