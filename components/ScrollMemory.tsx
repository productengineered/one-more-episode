"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

const HEADER_OFFSET = 80; // sticky header height + breathing room

function pageKey(pathname: string, search: string) {
  return search ? `${pathname}?${search}` : pathname;
}

/**
 * Restores scroll position on back/forward navigation.
 *
 * Saves the scroll position of every page continuously, and the card the user
 * clicked to navigate away (any [data-scroll-anchor] containing the link). On
 * popstate the pixel position is restored first; if the clicked card is no
 * longer in the viewport — the layout shifted because content above it grew or
 * shrank — it scrolls to the card instead, wherever it moved to.
 */
export function ScrollMemory() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const key = pageKey(pathname, searchParams.toString());
  const keyRef = useRef(key);
  keyRef.current = key;

  // Continuously record the current page's scroll position. Written
  // synchronously: rAF throttling stalls in hidden/occluded windows and a
  // single sessionStorage write per scroll event is cheap.
  useEffect(() => {
    const onScroll = () => {
      sessionStorage.setItem(`scroll:${keyRef.current}`, String(window.scrollY));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Record which card a navigation started from.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!target?.closest("a[href]")) return;
      const anchor = target.closest("[data-scroll-anchor]");
      if (anchor) {
        sessionStorage.setItem(
          `anchor:${keyRef.current}`,
          anchor.getAttribute("data-scroll-anchor")!
        );
      } else {
        sessionStorage.removeItem(`anchor:${keyRef.current}`);
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // Snapshot the restore target at popstate time, before anything else scrolls.
  useEffect(() => {
    const onPop = () => {
      const k = pageKey(location.pathname, location.search.replace(/^\?/, ""));
      sessionStorage.setItem(
        "pending-restore",
        JSON.stringify({
          key: k,
          y: sessionStorage.getItem(`scroll:${k}`),
          anchor: sessionStorage.getItem(`anchor:${k}`),
        })
      );
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // After a back/forward render, restore.
  useEffect(() => {
    const raw = sessionStorage.getItem("pending-restore");
    if (!raw) return;
    let pending: { key: string; y: string | null; anchor: string | null };
    try {
      pending = JSON.parse(raw);
    } catch {
      sessionStorage.removeItem("pending-restore");
      return;
    }
    if (pending.key !== key) return;
    sessionStorage.removeItem("pending-restore");

    let cancelled = false;
    const cancel = () => {
      cancelled = true;
    };
    window.addEventListener("wheel", cancel, { passive: true, once: true });
    window.addEventListener("touchstart", cancel, { passive: true, once: true });

    const restore = () => {
      if (cancelled) return;
      const y = pending.y === null ? NaN : Number(pending.y);
      if (Number.isFinite(y)) window.scrollTo(0, y);
      if (!pending.anchor) return;
      const el = document.querySelector(
        `[data-scroll-anchor="${CSS.escape(pending.anchor)}"]`
      );
      if (!el) return;
      const rect = el.getBoundingClientRect();
      // Only correct when the clicked card is entirely off-screen — that means
      // the layout shifted underneath us (e.g. sections above grew). A card
      // that's partially visible is exactly where the user left it.
      const fullyOffscreen = rect.bottom < 0 || rect.top > window.innerHeight;
      if (fullyOffscreen) window.scrollTo(0, rect.top + window.scrollY - HEADER_OFFSET);
    };

    // Retry a few times: dynamic pages render in stages and the document may
    // not be tall enough on the first attempt.
    const timers = [0, 150, 450].map((ms) => setTimeout(restore, ms));
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener("wheel", cancel);
      window.removeEventListener("touchstart", cancel);
    };
  }, [key]);

  return null;
}
