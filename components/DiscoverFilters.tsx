"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export interface FilterOption {
  value: string;
  count: number;
}

// Pinned to the top of the platform dropdown, in this order (when present in
// the data — TVmaze's names, e.g. "Apple TV" for Apple TV+).
const MAJOR_STREAMERS = [
  "Netflix",
  "Apple TV",
  "Prime Video",
  "Hulu",
  "HBO",
  "HBO Max",
  "Max",
  "Disney+",
  "Peacock",
  "Paramount+",
];

export interface DiscoverFilterState {
  q: string;
  stage: string; // "" = all, "premieres", "returning"
  sort: string; // "" = by date, "buzz"
  type: string;
  platform: string;
  genre: string;
  country: string;
}

export function DiscoverFilters({
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
  current: DiscoverFilterState;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(current.q);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (debounce.current) clearTimeout(debounce.current);
  }, []);

  function withParam(key: string, value: string) {
    const p = new URLSearchParams(searchParams);
    if (value) p.set(key, value);
    else p.delete(key);
    return `/discover${p.size ? `?${p.toString()}` : ""}`;
  }

  function setParam(key: string, value: string) {
    router.push(withParam(key, value), { scroll: false });
  }

  function onSearch(value: string) {
    setQ(value);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(
      () => router.replace(withParam("q", value.trim()), { scroll: false }),
      300
    );
  }

  const hasFilters =
    current.q || current.stage || current.type || current.platform || current.genre || current.country;

  const chip = (active: boolean) =>
    `rounded-full px-3 py-1 text-xs transition-colors ${
      active
        ? "bg-violet-600 text-white"
        : "bg-zinc-900 text-zinc-400 border border-zinc-800 hover:border-zinc-600 hover:text-zinc-200"
    }`;
  const select =
    "min-w-0 flex-1 sm:flex-none sm:max-w-44 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-300 outline-none focus:border-violet-500";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Filter by name…"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm outline-none placeholder:text-zinc-600 focus:border-violet-500 sm:w-48"
        />
        <span className="mx-1 hidden h-4 w-px bg-zinc-800 sm:block" />
        <button className={chip(!current.stage)} onClick={() => setParam("stage", "")}>
          All shows
        </button>
        <button
          className={chip(current.stage === "premieres")}
          onClick={() => setParam("stage", current.stage === "premieres" ? "" : "premieres")}
        >
          ✦ Premieres
        </button>
        <button
          className={chip(current.stage === "returning")}
          onClick={() => setParam("stage", current.stage === "returning" ? "" : "returning")}
        >
          Returning
        </button>
        {hasFilters && (
          <button
            onClick={() => {
              setQ("");
              router.push("/discover", { scroll: false });
            }}
            className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
          >
            Clear
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-zinc-600">Sort</span>
        <button className={chip(current.sort !== "buzz")} onClick={() => setParam("sort", "")}>
          By date
        </button>
        <button className={chip(current.sort === "buzz")} onClick={() => setParam("sort", "buzz")}>
          By buzz
        </button>
        <span className="mx-1 hidden h-4 w-px bg-zinc-800 sm:block" />
        <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:flex-wrap">
        <select
          className={select}
          value={current.platform}
          onChange={(e) => setParam("platform", e.target.value)}
        >
          <option value="">All platforms</option>
          {(() => {
            const streamers = MAJOR_STREAMERS.map((name) =>
              platforms.find((p) => p.value === name)
            ).filter((p): p is FilterOption => !!p);
            const rest = platforms
              .filter((p) => !MAJOR_STREAMERS.includes(p.value))
              .sort((a, b) => a.value.localeCompare(b.value));
            return (
              <>
                <optgroup label="Streaming">
                  {streamers.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.value} ({o.count})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="─────── A–Z ───────">
                  {rest.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.value} ({o.count})
                    </option>
                  ))}
                </optgroup>
              </>
            );
          })()}
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
        </div>
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
