"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function ShowsSearch({ initial }: { initial: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(initial);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (debounce.current) clearTimeout(debounce.current);
  }, []);

  return (
    <input
      type="search"
      value={q}
      autoComplete="off"
      onChange={(e) => {
        const value = e.target.value;
        setQ(value);
        if (debounce.current) clearTimeout(debounce.current);
        debounce.current = setTimeout(() => {
          const p = new URLSearchParams(searchParams);
          if (value.trim()) p.set("q", value.trim());
          else p.delete("q");
          router.replace(`/shows${p.size ? `?${p.toString()}` : ""}`, { scroll: false });
        }, 300);
      }}
      placeholder="Filter your shows…"
      className="w-56 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm outline-none placeholder:text-zinc-600 focus:border-violet-500"
    />
  );
}
