"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { markShowWatched } from "@/app/actions";

/** Marks every aired episode of a show watched, with a two-step confirm. */
export function MarkAllButton({
  showId,
  remaining,
  size = "sm",
}: {
  showId: number;
  remaining: number;
  size?: "sm" | "md";
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const sizing =
    size === "sm"
      ? "w-full rounded-md px-2 py-1 text-[11px]"
      : "rounded-lg px-3 py-1.5 text-sm";
  return (
    <button
      onClick={() => {
        if (!confirming) {
          setConfirming(true);
          timer.current = setTimeout(() => setConfirming(false), 4000);
          return;
        }
        if (timer.current) clearTimeout(timer.current);
        setConfirming(false);
        startTransition(() => markShowWatched(showId));
      }}
      disabled={pending}
      className={`${sizing} border transition-colors disabled:opacity-50 ${
        confirming
          ? "border-violet-500/60 bg-violet-600/20 text-violet-300"
          : size === "sm"
            ? "border-zinc-800 bg-zinc-900 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
            : "border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:border-zinc-500"
      }`}
    >
      {pending ? "Marking…" : confirming ? `Confirm ${remaining} eps?` : "✓ Mark all watched"}
    </button>
  );
}
