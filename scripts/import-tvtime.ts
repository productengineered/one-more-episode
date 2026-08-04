/**
 * One-time import of a TV Time GDPR export into the app database.
 *
 * Reads:
 *  - gdpr-data/followed_tv_show.csv        -> followed shows (TheTVDB ids)
 *  - gdpr-data/tracking-prod-records-v2.csv -> per-episode watch history
 *
 * Resolves each show against TVmaze (lookup by TVDB id, name search as
 * fallback), pulls its full episode list, then matches watch history rows by
 * (season, episode number).
 *
 * Usage: npm run import [-- /path/to/your/tvtime-export]   (default: ./gdpr-data)
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { and, eq } from "drizzle-orm";
import { db } from "../lib/db";
import { episodes, watched } from "../lib/db/schema";
import { lookupByTvdb, searchShows } from "../lib/tvmaze";
import { syncShow } from "../lib/sync";

const EXPORT_DIR = resolve(process.argv[2] ?? "gdpr-data");

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows;
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

function toIso(tvTimeDate: string): string {
  // "2018-05-24 12:30:07" (UTC) -> ISO
  return tvTimeDate ? tvTimeDate.replace(" ", "T") + "Z" : new Date().toISOString();
}

async function main() {
  if (!existsSync(join(EXPORT_DIR, "followed_tv_show.csv"))) {
    console.error(
      `No TV Time export found at ${EXPORT_DIR}\n` +
        `Pass the folder containing followed_tv_show.csv:  npm run import -- /path/to/export`
    );
    process.exit(1);
  }
  const follows = parseCsv(readFileSync(join(EXPORT_DIR, "followed_tv_show.csv"), "utf8"));
  const records = parseCsv(
    readFileSync(join(EXPORT_DIR, "tracking-prod-records-v2.csv"), "utf8")
  );

  const watchRows = records.filter((r) => r.key?.startsWith("watch-episode"));
  console.log(`Export: ${follows.length} followed shows, ${watchRows.length} watch records\n`);

  const tvdbToTvmaze = new Map<number, number>();
  const failedShows: string[] = [];

  for (const [i, f] of follows.entries()) {
    const tvdbId = Number(f.tv_show_id);
    const name = f.tv_show_name;
    const label = `[${i + 1}/${follows.length}] ${name}`;
    try {
      let show = await lookupByTvdb(tvdbId);
      if (!show) {
        const results = await searchShows(name);
        show = results[0]?.show ?? null;
        if (show) console.log(`${label}: no TVDB match, using name search -> ${show.name}`);
      }
      if (!show) {
        failedShows.push(name);
        console.log(`${label}: NOT FOUND on TVmaze`);
        continue;
      }
      const { episodeCount } = await syncShow(show.id, { followedAt: toIso(f.created_at) });
      tvdbToTvmaze.set(tvdbId, show.id);
      console.log(`${label}: ok (tvmaze ${show.id}, ${episodeCount} episodes)`);
    } catch (err) {
      failedShows.push(name);
      console.log(`${label}: ERROR ${err}`);
    }
  }

  console.log("\nImporting watch history...");
  let matched = 0;
  let unmatched = 0;
  const unmatchedByShow = new Map<string, number>();

  // Earliest watch date wins per episode (dedupes rewatches).
  const seen = new Map<number, string>(); // episodeId -> watchedAt
  const epShow = new Map<number, number>(); // episodeId -> tvmaze showId

  for (const r of watchRows) {
    const tvdbId = Number(r.s_id);
    const season = Number(r.season_number || r.s_no);
    const number = Number(r.episode_number || r.ep_no);
    const showId = tvdbToTvmaze.get(tvdbId);
    const name = r.series_name || String(tvdbId);
    if (!showId || !Number.isFinite(season) || !Number.isFinite(number)) {
      unmatched++;
      unmatchedByShow.set(name, (unmatchedByShow.get(name) ?? 0) + 1);
      continue;
    }
    const ep = await db
      .select({ id: episodes.id })
      .from(episodes)
      .where(
        and(eq(episodes.showId, showId), eq(episodes.season, season), eq(episodes.number, number))
      )
      .limit(1);
    if (!ep.length) {
      unmatched++;
      unmatchedByShow.set(name, (unmatchedByShow.get(name) ?? 0) + 1);
      continue;
    }
    const watchedAt = toIso(r.created_at || r.updated_at);
    const prev = seen.get(ep[0].id);
    if (!prev || watchedAt < prev) seen.set(ep[0].id, watchedAt);
    epShow.set(ep[0].id, showId);
    matched++;
  }

  for (const [episodeId, watchedAt] of seen) {
    await db
      .insert(watched)
      .values({ episodeId, showId: epShow.get(episodeId)!, watchedAt })
      .onConflictDoNothing();
  }

  console.log(`\n=== Import summary ===`);
  console.log(`Shows resolved: ${tvdbToTvmaze.size}/${follows.length}`);
  if (failedShows.length) console.log(`Failed shows: ${failedShows.join(", ")}`);
  console.log(`Watch records: ${matched} matched, ${unmatched} unmatched (${seen.size} unique episodes marked watched)`);
  if (unmatchedByShow.size) {
    console.log("Unmatched by show:");
    for (const [name, n] of [...unmatchedByShow].sort((a, b) => b[1] - a[1]))
      console.log(`  ${name}: ${n}`);
  }
}

main().then(() => process.exit(0));
