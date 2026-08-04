export function epCode(season: number, number: number | null): string {
  if (number === null) return `S${season} Special`;
  return `S${season}E${String(number).padStart(2, "0")}`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return "TBA";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "TBA";
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function relativeDays(iso: string): string {
  const days = Math.ceil((Date.parse(iso) - Date.now()) / 86400_000);
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  if (days < 7) return `in ${days} days`;
  if (days < 30) return `in ${Math.round(days / 7)} wk`;
  return `in ${Math.round(days / 30)} mo`;
}

export function stripHtml(html: string | null): string {
  return html ? html.replace(/<[^>]+>/g, "") : "";
}
