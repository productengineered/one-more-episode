import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { episodes, plexEpisodes, plexMovies, plexShows, shows, watched } from "@/lib/db/schema";

// Plex webhook receiver. Plex can't send custom headers, so auth rides in the
// URL: /api/plex?secret=PLEX_WEBHOOK_SECRET. Payload arrives as
// multipart/form-data with a JSON `payload` field. We only act on
// library.new; playback events are acknowledged and ignored.

interface PlexMetadata {
  type?: string;
  ratingKey?: string;
  title?: string;
  year?: number;
  guid?: string;
  index?: number; // episode number
  parentIndex?: number; // season number
  grandparentRatingKey?: string;
  grandparentTitle?: string;
  grandparentGuid?: string;
  addedAt?: number;
}

function iso(ts?: number): string {
  return ts ? new Date(ts * 1000).toISOString() : new Date().toISOString();
}

/** Best-effort link of a Plex show to our library, by exact name. The DB
 * backfill does stronger GUID-based matching; this covers shows added later. */
async function matchShowByTitle(title: string): Promise<number | null> {
  const rows = await db
    .select({ id: shows.id })
    .from(shows)
    .where(sql`lower(${shows.name}) = ${title.toLowerCase()}`)
    .limit(1);
  return rows[0]?.id ?? null;
}

export async function POST(req: Request) {
  const secret = process.env.PLEX_WEBHOOK_SECRET;
  const given = new URL(req.url).searchParams.get("secret");
  if (!secret || given !== secret) return new Response("Unauthorized", { status: 401 });

  let payload: { event?: string; Metadata?: PlexMetadata };
  try {
    const form = await req.formData();
    payload = JSON.parse(String(form.get("payload")));
  } catch {
    return new Response("Bad payload", { status: 400 });
  }

  // Finished watching on Plex (~90% viewed) -> mark watched here too, so
  // Watch Next advances on its own. Manual "Mark Played" in Plex does not
  // fire a webhook — only real playback does.
  if (payload.event === "media.scrobble" && payload.Metadata?.type === "episode") {
    const m = payload.Metadata;
    if (m.parentIndex == null || m.index == null) {
      return Response.json({ ok: true, ignored: "scrobble-without-numbers" });
    }
    let tvmazeShowId: number | null = null;
    if (m.grandparentRatingKey) {
      const row = await db
        .select()
        .from(plexShows)
        .where(eq(plexShows.ratingKey, m.grandparentRatingKey))
        .limit(1);
      if (row.length) {
        tvmazeShowId = row[0].tvmazeShowId;
        if (!tvmazeShowId && m.grandparentTitle) {
          tvmazeShowId = await matchShowByTitle(m.grandparentTitle);
          if (tvmazeShowId) {
            await db
              .update(plexShows)
              .set({ tvmazeShowId })
              .where(eq(plexShows.ratingKey, m.grandparentRatingKey));
          }
        }
      }
    }
    if (!tvmazeShowId && m.grandparentTitle) {
      tvmazeShowId = await matchShowByTitle(m.grandparentTitle);
    }
    if (!tvmazeShowId) return Response.json({ ok: true, ignored: "unmatched-show" });

    const ep = await db
      .select({ id: episodes.id })
      .from(episodes)
      .where(
        and(
          eq(episodes.showId, tvmazeShowId),
          eq(episodes.season, m.parentIndex),
          eq(episodes.number, m.index)
        )
      )
      .limit(1);
    if (!ep.length) return Response.json({ ok: true, ignored: "unmatched-episode" });

    await db
      .insert(watched)
      .values({ episodeId: ep[0].id, showId: tvmazeShowId, watchedAt: new Date().toISOString() })
      .onConflictDoNothing();
    return Response.json({
      ok: true,
      watched: `${m.grandparentTitle} S${m.parentIndex}E${m.index}`,
    });
  }

  if (payload.event !== "library.new" || !payload.Metadata) {
    return Response.json({ ok: true, ignored: payload.event ?? "unknown" });
  }

  const m = payload.Metadata;
  if (m.type === "episode" && m.ratingKey) {
    if (m.grandparentRatingKey) {
      const existing = await db
        .select({ ratingKey: plexShows.ratingKey })
        .from(plexShows)
        .where(eq(plexShows.ratingKey, m.grandparentRatingKey))
        .limit(1);
      if (!existing.length) {
        await db.insert(plexShows).values({
          ratingKey: m.grandparentRatingKey,
          title: m.grandparentTitle ?? "Unknown",
          guid: m.grandparentGuid ?? null,
          tvmazeShowId: m.grandparentTitle ? await matchShowByTitle(m.grandparentTitle) : null,
          addedAt: iso(m.addedAt),
        });
      }
    }
    const row = {
      ratingKey: m.ratingKey,
      showRatingKey: m.grandparentRatingKey ?? null,
      showTitle: m.grandparentTitle ?? null,
      season: m.parentIndex ?? null,
      number: m.index ?? null,
      title: m.title ?? null,
      addedAt: iso(m.addedAt),
    };
    await db.insert(plexEpisodes).values(row).onConflictDoUpdate({
      target: plexEpisodes.ratingKey,
      set: row,
    });
    return Response.json({ ok: true, stored: "episode" });
  }

  if (m.type === "movie" && m.ratingKey) {
    const row = {
      ratingKey: m.ratingKey,
      title: m.title ?? "Unknown",
      year: m.year ?? null,
      guid: m.guid ?? null,
      addedAt: iso(m.addedAt),
    };
    await db.insert(plexMovies).values(row).onConflictDoUpdate({
      target: plexMovies.ratingKey,
      set: row,
    });
    return Response.json({ ok: true, stored: "movie" });
  }

  if (m.type === "show" && m.ratingKey) {
    const row = {
      ratingKey: m.ratingKey,
      title: m.title ?? "Unknown",
      year: m.year ?? null,
      guid: m.guid ?? null,
      tvmazeShowId: m.title ? await matchShowByTitle(m.title) : null,
      addedAt: iso(m.addedAt),
    };
    await db.insert(plexShows).values(row).onConflictDoUpdate({
      target: plexShows.ratingKey,
      set: row,
    });
    return Response.json({ ok: true, stored: "show" });
  }

  return Response.json({ ok: true, ignored: m.type ?? "unknown-type" });
}
