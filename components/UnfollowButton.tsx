"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { unfollowShow } from "@/app/actions";

export function UnfollowButton({ showId, showName }: { showId: number; showName: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <button
      onClick={() => {
        if (!window.confirm(`Unfollow "${showName}"? This removes its watch history too.`))
          return;
        startTransition(async () => {
          await unfollowShow(showId);
          router.push("/shows");
        });
      }}
      disabled={pending}
      className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-1.5 text-sm text-red-400 transition-colors hover:border-red-700 disabled:opacity-60"
    >
      {pending ? "Removing…" : "Unfollow"}
    </button>
  );
}
