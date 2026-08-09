"use client";

import { useState, useTransition } from "react";
import { followFromTmdb } from "@/app/actions";

export function FollowTmdbButton({ tmdbId }: { tmdbId: number }) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");

  if (state === "done")
    return (
      <span className="block rounded-md bg-emerald-500/15 px-2 py-1.5 text-center text-xs text-emerald-400 sm:inline-block sm:py-1 sm:text-left">
        ✓ Added
      </span>
    );
  if (state === "failed")
    return (
      <span className="block px-2 py-1.5 text-center text-xs text-zinc-600 sm:inline-block sm:py-1 sm:text-left">
        Not on TVmaze
      </span>
    );

  return (
    <button
      onClick={() =>
        startTransition(async () => {
          const r = await followFromTmdb(tmdbId);
          setState(r.ok ? "done" : "failed");
        })
      }
      disabled={pending}
      className="w-full rounded-md bg-violet-600 px-2 py-1.5 text-xs font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-60 sm:w-auto sm:py-1"
    >
      {pending ? "Adding…" : "+ Follow"}
    </button>
  );
}
