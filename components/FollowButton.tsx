"use client";

import { useState, useTransition } from "react";
import { followShow } from "@/app/actions";

/** Follow a TVmaze show with immediate visual feedback. */
export function FollowButton({ tvmazeId }: { tvmazeId: number }) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<"idle" | "done" | "error">("idle");

  if (state === "done") {
    return (
      <span className="shrink-0 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-sm text-emerald-400">
        ✓ Following
      </span>
    );
  }

  return (
    <button
      onClick={() =>
        startTransition(async () => {
          try {
            await followShow(tvmazeId);
            setState("done");
          } catch {
            setState("error");
          }
        })
      }
      disabled={pending}
      className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-70 ${
        state === "error"
          ? "bg-red-900/50 text-red-300 hover:bg-red-900/70"
          : "bg-violet-600 text-white hover:bg-violet-500"
      }`}
    >
      {pending ? "Adding…" : state === "error" ? "Failed — retry" : "+ Follow"}
    </button>
  );
}
