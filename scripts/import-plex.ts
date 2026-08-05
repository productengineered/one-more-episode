/**
 * Backfill the Plex library mirror (plex_shows / plex_episodes / plex_movies)
 * from a copy of Plex's own database (com.plexapp.plugins.library.db).
 *
 * Shows are matched to the app's library by TVDB/IMDB/TMDB id (Plex stores
 * these as tag_type=314 tags), with normalized-name fallback. Replaces the
 * mirror tables wholesale — the webhook keeps them current afterwards.
 *
 * Usage:
 *   npm run import:plex -- /path/to/com.plexapp.plugins.library.db
 * Target database follows DATABASE_URL/DATABASE_AUTH_TOKEN (local file by default).
 */
import { createClient } from "@libsql/client";
import { db } from "../lib/db";
import { plexEpisodes, plexMovies, plexShows, shows } from "../lib/db/schema";

const PLEX_DB = process.argv[2] ?? "planning/com.plexapp.plugins.library.db";
const plex = createClient({ url: `file:${PLEX_DB}` });

function iso(ts: unknown): string | null {
  const n = Number(ts);
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000).toISOString() : null;
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s*\(\d{4}\)$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function main() {
  // External-id tags: metadata_item_id -> { tvdb, tmdb, imdb }
  const tagRows = await plex.execute(
    `SELECT tg.metadata_item_id AS mid, t.tag AS tag
     FROM taggings tg JOIN tags t ON t.id = tg.tag_id WHERE t.tag_type = 314`
  );
  const ext = new Map<number, { tvdb?: number; tmdb?: number; imdb?: string }>();
  for (const r of tagRows.rows) {
    const mid = Number(r.mid);
    const tag = String(r.tag);
    const e = ext.get(mid) ?? {};
    if (tag.startsWith("tvdb://")) e.tvdb = Number(tag.slice(7));
    else if (tag.startsWith("tmdb://")) e.tmdb = Number(tag.slice(7));
    else if (tag.startsWith("imdb://")) e.imdb = tag.slice(7);
    ext.set(mid, e);
  }

  const [plexShowRows, plexEpisodeRows, plexMovieRows, ourShows] = await Promise.all([
    plex.execute(
      `SELECT id, title, year, guid, added_at FROM metadata_items
       WHERE metadata_type = 2 AND deleted_at IS NULL`
    ),
    plex.execute(
      `SELECT e.id AS id, e.title AS title, e."index" AS number, e.added_at AS added_at,
              s."index" AS season, sh.id AS showId, sh.title AS showTitle
       FROM metadata_items e
       JOIN metadata_items s ON s.id = e.parent_id
       JOIN metadata_items sh ON sh.id = s.parent_id
       WHERE e.metadata_type = 4 AND e.deleted_at IS NULL AND sh.metadata_type = 2`
    ),
    plex.execute(
      `SELECT id, title, year, guid, added_at FROM metadata_items
       WHERE metadata_type = 1 AND deleted_at IS NULL`
    ),
    db.select().from(shows),
  ]);

  // Match maps for our library: by external id first, normalized name second.
  const byTvdb = new Map(ourShows.filter((s) => s.tvdbId).map((s) => [s.tvdbId!, s.id]));
  const byImdb = new Map(ourShows.filter((s) => s.imdbId).map((s) => [s.imdbId!, s.id]));
  const byTmdb = new Map(ourShows.filter((s) => s.tmdbId).map((s) => [s.tmdbId!, s.id]));
  const byName = new Map(ourShows.map((s) => [norm(s.name), s.id]));

  let matched = 0;
  const showRows = plexShowRows.rows.map((r) => {
    const id = Number(r.id);
    const e = ext.get(id) ?? {};
    const tvmazeShowId =
      (e.tvdb && byTvdb.get(e.tvdb)) ||
      (e.imdb && byImdb.get(e.imdb)) ||
      (e.tmdb && byTmdb.get(e.tmdb)) ||
      byName.get(norm(String(r.title))) ||
      null;
    if (tvmazeShowId) matched++;
    return {
      ratingKey: String(id),
      title: String(r.title),
      year: r.year === null ? null : Number(r.year),
      guid: r.guid === null ? null : String(r.guid),
      tvdbId: e.tvdb ?? null,
      tmdbId: e.tmdb ?? null,
      imdbId: e.imdb ?? null,
      tvmazeShowId,
      addedAt: iso(r.added_at),
    };
  });

  const episodeRows = plexEpisodeRows.rows.map((r) => ({
    ratingKey: String(r.id),
    showRatingKey: String(r.showId),
    showTitle: String(r.showTitle),
    season: r.season === null ? null : Number(r.season),
    number: r.number === null ? null : Number(r.number),
    title: r.title === null ? null : String(r.title),
    addedAt: iso(r.added_at),
  }));

  const movieRows = plexMovieRows.rows.map((r) => {
    const e = ext.get(Number(r.id)) ?? {};
    return {
      ratingKey: String(r.id),
      title: String(r.title),
      year: r.year === null ? null : Number(r.year),
      guid: r.guid === null ? null : String(r.guid),
      tmdbId: e.tmdb ?? null,
      imdbId: e.imdb ?? null,
      addedAt: iso(r.added_at),
    };
  });

  // Wholesale replace, chunked.
  await db.delete(plexEpisodes);
  await db.delete(plexShows);
  await db.delete(plexMovies);
  for (let i = 0; i < showRows.length; i += 100)
    await db.insert(plexShows).values(showRows.slice(i, i + 100));
  for (let i = 0; i < episodeRows.length; i += 100)
    await db.insert(plexEpisodes).values(episodeRows.slice(i, i + 100));
  for (let i = 0; i < movieRows.length; i += 100)
    await db.insert(plexMovies).values(movieRows.slice(i, i + 100));

  console.log(`plex shows:    ${showRows.length} (${matched} matched to your library)`);
  console.log(`plex episodes: ${episodeRows.length}`);
  console.log(`plex movies:   ${movieRows.length}`);

  const unmatchedFollowed = ourShows.filter(
    (s) => s.archived === 0 && !showRows.some((p) => p.tvmazeShowId === s.id)
  );
  console.log(
    `\nFollowed shows NOT on Plex: ${unmatchedFollowed.length}` +
      (unmatchedFollowed.length ? ` (expected — e.g. streaming-only)` : "")
  );
  const unmatchedPlex = showRows.filter((p) => !p.tvmazeShowId);
  if (unmatchedPlex.length) {
    console.log(`Plex shows not in your library (${unmatchedPlex.length}):`);
    for (const p of unmatchedPlex.slice(0, 15)) console.log(`  ${p.title}`);
    if (unmatchedPlex.length > 15) console.log(`  … and ${unmatchedPlex.length - 15} more`);
  }
  process.exit(0);
}

main();
