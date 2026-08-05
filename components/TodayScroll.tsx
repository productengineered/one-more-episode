"use client";

import { useEffect } from "react";

/**
 * On first paint, jump the Upcoming page to the "today" marker so past days
 * live above the fold. Skips back/forward navigations — ScrollMemory owns those.
 */
export function TodayScroll() {
  useEffect(() => {
    if (sessionStorage.getItem("pending-restore")) return;
    document.getElementById("today-anchor")?.scrollIntoView({ block: "start" });
  }, []);
  return null;
}
