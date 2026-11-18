"use client";

import { useState, useTransition } from "react";
import { setPlexTracked } from "@/app/actions";

/** "Track for Plex" checkbox toggle — flips instantly, saves in the background. */
export function PlexTrackButton({
  showId,
  initial,
  size = "md",
}: {
  showId: number;
  initial: boolean;
  size?: "sm" | "md";
}) {
  const [tracked, setTracked] = useState(initial);
  const [pending, startTransition] = useTransition();
  const sm = size === "sm";
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
      className={`inline-flex items-center border transition-colors disabled:opacity-70 ${
        sm
          ? "w-full justify-center gap-1.5 rounded-md px-2 py-1 text-[11px]"
          : "gap-2 rounded-lg px-3 py-1.5 text-sm"
      } ${
        tracked
          ? "border-amber-500/60 bg-amber-500/10 text-amber-300"
          : sm
            ? "border-zinc-800 bg-zinc-900 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
            : "border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:border-zinc-500"
      }`}
    >
      <span
        aria-hidden
        className={`grid shrink-0 place-items-center rounded border leading-none ${
          sm ? "h-3 w-3 text-[9px]" : "h-4 w-4 text-[11px]"
        } ${tracked ? "border-amber-400 bg-amber-400 text-zinc-950" : "border-zinc-500"}`}
      >
        {tracked && "✓"}
      </span>
      {pending && !sm ? "Saving…" : "Track for Plex"}
    </button>
  );
}
