"use client";

import { useState, useTransition } from "react";
import { refreshStaleShows } from "@/app/actions";

export function RefreshAllButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  return (
    <button
      onClick={() =>
        startTransition(async () => {
          const r = await refreshStaleShows();
          setResult(r.checked === 0 ? "Already fresh" : `Refreshed ${r.synced} shows`);
          setTimeout(() => setResult(null), 4000);
        })
      }
      disabled={pending}
      className="rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:border-zinc-500 disabled:opacity-60"
    >
      {pending ? "Refreshing… (can take a minute)" : (result ?? "↻ Refresh air dates")}
    </button>
  );
}
