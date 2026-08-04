"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { logout } from "@/app/actions";

export function SignOutButton() {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <button
      onClick={() =>
        startTransition(async () => {
          await logout();
          router.push("/login");
        })
      }
      disabled={pending}
      className="rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-1.5 text-sm text-zinc-300 hover:border-zinc-500 disabled:opacity-60"
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
