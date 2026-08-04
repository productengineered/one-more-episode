"use client";

import { useState, useTransition } from "react";
import { refreshAiring } from "@/app/actions";

export function RefreshAiringButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  return (
    <button
      onClick={() =>
        startTransition(async () => {
          const r = await refreshAiring();
          setResult(`Found ${r.count} shows`);
          setTimeout(() => setResult(null), 4000);
        })
      }
      disabled={pending}
      className="rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:border-zinc-500 disabled:opacity-60"
    >
      {pending ? "Fetching schedule…" : (result ?? "↻ Refresh")}
    </button>
  );
}
