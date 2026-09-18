export function epCode(season: number, number: number | null): string {
  if (number === null) return `S${season} Special`;
  return `S${season}E${String(number).padStart(2, "0")}`;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * `tz` is the user's IANA timezone from Settings; undefined falls back to the
 * server's local zone (fine locally, UTC on most hosts).
 *
 * Date-only strings ("2026-08-05") are rendered verbatim — parsing them as
 * UTC midnight and then formatting in a western timezone would shift them
 * back a day.
 */
export function formatDate(iso: string | null, tz?: string): string {
  if (!iso) return "TBA";
  const dateOnly = DATE_ONLY.test(iso);
  return new Date(dateOnly ? `${iso}T00:00:00Z` : iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: dateOnly ? "UTC" : tz,
  });
}

export function formatDateTime(iso: string | null, tz?: string): string {
  if (!iso) return "TBA";
  if (DATE_ONLY.test(iso)) return formatDate(iso);
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
  });
}

/** Time-only ("8:00 PM"), for rows already grouped under a day heading. */
export function formatTime(iso: string | null, tz?: string): string {
  if (!iso || DATE_ONLY.test(iso)) return "";
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
  });
}

/** Grouping label like "Wednesday, August 5" in the user's timezone. */
export function dayLabel(iso: string, tz?: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: tz,
  });
}

/** Today as "2026-09-18" in the user's timezone — compares directly with date-only strings. */
export function todayIso(tz?: string): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: tz });
}

/** "October 2026" for a date-only string (rendered verbatim, never shifted). */
export function monthLabel(isoDate: string): string {
  return new Date(`${isoDate.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function relativeDays(iso: string): string {
  const days = Math.ceil((Date.parse(iso) - Date.now()) / 86400_000);
  if (days === -1) return "yesterday";
  if (days < -1) return `${-days} days ago`;
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  if (days < 7) return `in ${days} days`;
  if (days < 30) return `in ${Math.round(days / 7)} wk`;
  return `in ${Math.round(days / 30)} mo`;
}

export function stripHtml(html: string | null): string {
  return html ? html.replace(/<[^>]+>/g, "") : "";
}
