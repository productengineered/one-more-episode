import { refreshAiring, refreshStaleShows } from "@/app/actions";

// Nightly reconciliation (vercel.json crons): rebuilds the Discover table from
// the full TVmaze feed (catches premiere-date changes and cancellations) and
// re-syncs every stale, still-running library show.
export const maxDuration = 300;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const started = Date.now();
  const airing = await refreshAiring();
  const library = await refreshStaleShows();
  return Response.json({
    ok: true,
    airingShows: airing.count,
    libraryChecked: library.checked,
    librarySynced: library.synced,
    seconds: Math.round((Date.now() - started) / 1000),
  });
}
