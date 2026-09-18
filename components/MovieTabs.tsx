"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { MovieSearch } from "@/components/MovieSearch";

export interface MovieTab {
  key: string;
  label: string;
  count: number;
}

/**
 * Search box + tab bar for /movies, pinned under the site header. Every panel
 * arrives server-rendered so switching tabs is instant; the choice is mirrored
 * into ?tab= with replaceState so refresh and back land on it. While search
 * results are showing, a tab click navigates out of the search instead.
 */
export function MovieTabs({
  tabs,
  initial,
  query,
  panels,
  results,
}: {
  tabs: MovieTab[]; // first tab is the default (no ?tab=)
  initial: string;
  query: string;
  panels: Record<string, ReactNode>;
  results?: ReactNode;
}) {
  const router = useRouter();
  const searching = results !== undefined;
  const [active, setActive] = useState<string | null>(searching ? null : initial);
  const [pending, startTransition] = useTransition();
  // Navigations that change ?tab= without a remount (nav links, back/forward)
  // should move the tab too. Tab clicks already match, so they're a no-op.
  const [seenInitial, setSeenInitial] = useState(initial);
  if (initial !== seenInitial) {
    setSeenInitial(initial);
    if (!searching) setActive(initial);
  }
  const barRef = useRef<HTMLDivElement>(null);
  const tablistRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // On phones the tab strip scrolls sideways — keep the active tab in view.
  useEffect(() => {
    const strip = tablistRef.current;
    const tab = strip?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!strip || !tab) return;
    const s = strip.getBoundingClientRect();
    const t = tab.getBoundingClientRect();
    if (t.left < s.left || t.right > s.right) {
      strip.scrollLeft += t.left - s.left - (s.width - t.width) / 2;
    }
  }, [active]);

  const hrefFor = (tab: string, q = "") => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (tab !== tabs[0].key) p.set("tab", tab);
    return `/movies${p.size ? `?${p}` : ""}`;
  };

  function select(key: string) {
    setActive(key);
    if (searching) {
      startTransition(() => router.push(hrefFor(key)));
      return;
    }
    window.history.replaceState(null, "", hrefFor(key));
    // Scrolled into a long list? Start the new tab at its first item.
    const barBottom = barRef.current?.getBoundingClientRect().bottom ?? 0;
    const panelTop = panelRef.current?.getBoundingClientRect().top ?? 0;
    if (panelTop < barBottom) window.scrollBy({ top: panelTop - barBottom - 16 });
  }

  return (
    <>
      <div
        ref={barRef}
        className="sticky top-14 z-10 -mx-4 border-b border-zinc-800 bg-zinc-950/90 px-4 pt-3 backdrop-blur"
      >
        <MovieSearch initial={query} href={(q) => hrefFor(active ?? initial, q)} />
        <div
          ref={tablistRef}
          role="tablist"
          aria-label="Movie lists"
          className="mt-1 flex overflow-x-auto [scrollbar-width:none]"
        >
          {tabs.map((t) => {
            const on = t.key === active;
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={on}
                onClick={() => select(t.key)}
                className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                  on
                    ? "border-rose-500 text-zinc-100"
                    : "border-transparent text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {t.label}
                <span className={`ml-1.5 text-xs ${on ? "text-rose-300" : "text-zinc-600"}`}>
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div
        ref={panelRef}
        role="tabpanel"
        className={`transition-opacity ${pending ? "opacity-60" : ""}`}
      >
        {searching ? results : active && panels[active]}
      </div>
    </>
  );
}
