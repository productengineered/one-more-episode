"use client";

import { useRouter, useSearchParams } from "next/navigation";

export interface FilterOption {
  value: string;
  count: number;
}

export interface PremiereFilterState {
  sort: string;
  type: string;
  platform: string;
  genre: string;
  country: string;
}

export function PremiereFilters({
  types,
  platforms,
  genres,
  countries,
  current,
}: {
  types: FilterOption[];
  platforms: FilterOption[];
  genres: FilterOption[];
  countries: FilterOption[];
  current: PremiereFilterState;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string) {
    const p = new URLSearchParams(searchParams);
    if (value) p.set(key, value);
    else p.delete(key);
    router.push(`/premieres${p.size ? `?${p.toString()}` : ""}`, { scroll: false });
  }

  const hasFilters = current.type || current.platform || current.genre || current.country;

  const chip = (active: boolean) =>
    `rounded-full px-3 py-1 text-xs transition-colors ${
      active
        ? "bg-violet-600 text-white"
        : "bg-zinc-900 text-zinc-400 border border-zinc-800 hover:border-zinc-600 hover:text-zinc-200"
    }`;
  const select =
    "rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-300 outline-none focus:border-violet-500";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-zinc-600">Sort</span>
        <button className={chip(current.sort !== "buzz")} onClick={() => setParam("sort", "")}>
          By date
        </button>
        <button className={chip(current.sort === "buzz")} onClick={() => setParam("sort", "buzz")}>
          By buzz
        </button>
        <span className="mx-1 h-4 w-px bg-zinc-800" />
        <select
          className={select}
          value={current.platform}
          onChange={(e) => setParam("platform", e.target.value)}
        >
          <option value="">All platforms</option>
          {platforms.map((o) => (
            <option key={o.value} value={o.value}>
              {o.value} ({o.count})
            </option>
          ))}
        </select>
        <select
          className={select}
          value={current.genre}
          onChange={(e) => setParam("genre", e.target.value)}
        >
          <option value="">All genres</option>
          {genres.map((o) => (
            <option key={o.value} value={o.value}>
              {o.value} ({o.count})
            </option>
          ))}
        </select>
        <select
          className={select}
          value={current.country}
          onChange={(e) => setParam("country", e.target.value)}
        >
          <option value="">All countries</option>
          {countries.map((o) => (
            <option key={o.value} value={o.value}>
              {o.value} ({o.count})
            </option>
          ))}
        </select>
        {hasFilters && (
          <button
            onClick={() => router.push("/premieres", { scroll: false })}
            className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
          >
            Clear
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-zinc-600">Type</span>
        <button className={chip(!current.type)} onClick={() => setParam("type", "")}>
          All
        </button>
        {types.map((o) => (
          <button
            key={o.value}
            className={chip(current.type === o.value)}
            onClick={() => setParam("type", current.type === o.value ? "" : o.value)}
          >
            {o.value} <span className="opacity-60">{o.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
