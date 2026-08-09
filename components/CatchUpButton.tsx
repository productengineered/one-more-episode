"use client";

import { useTransition } from "react";
import { markWatchedUpTo } from "@/app/actions";

/** Marks this episode and everything before it as watched. */
export function CatchUpButton({ episodeId }: { episodeId: number }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      onClick={() => startTransition(() => markWatchedUpTo(episodeId))}
      disabled={pending}
      title="Mark this and all previous episodes watched"
      className="h-9 rounded-full border border-zinc-700 bg-zinc-800/60 px-2.5 text-xs text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-50 sm:h-7 sm:px-2"
    >
      {pending ? "…" : "⇤ here"}
    </button>
  );
}
