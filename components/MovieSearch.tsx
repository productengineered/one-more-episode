"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/** `href` builds the destination URL for a query ("" = back to the list). */
export function MovieSearch({
  initial,
  href,
}: {
  initial: string;
  href: (q: string) => string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  const [pending, startTransition] = useTransition();

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(() => router.push(href(q.trim())));
      }}
      className="flex w-full gap-2 sm:max-w-md"
    >
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search any movie — e.g. Dune"
        autoComplete="off"
        enterKeyHint="search"
        className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none placeholder:text-zinc-600 focus:border-rose-500"
      />
      <button
        disabled={pending}
        className="shrink-0 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-60"
      >
        {pending ? "Searching…" : "Search"}
      </button>
    </form>
  );
}
