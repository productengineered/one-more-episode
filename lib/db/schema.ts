import { index, integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

// id is the TVmaze show id
export const shows = sqliteTable("shows", {
  id: integer("id").primaryKey(),
  tvdbId: integer("tvdb_id"),
  imdbId: text("imdb_id"),
  tmdbId: integer("tmdb_id"),
  name: text("name").notNull(),
  status: text("status").notNull().default("Unknown"),
  premiered: text("premiered"),
  ended: text("ended"),
  network: text("network"),
  scheduleTime: text("schedule_time"),
  scheduleDays: text("schedule_days"),
  runtime: integer("runtime"),
  genres: text("genres"), // JSON array
  summary: text("summary"), // HTML from TVmaze
  imageMedium: text("image_medium"),
  imageOriginal: text("image_original"),
  url: text("url"),
  followedAt: text("followed_at"),
  archived: integer("archived").notNull().default(0),
  lastSyncedAt: text("last_synced_at"),
});

// id is the TVmaze episode id
export const episodes = sqliteTable(
  "episodes",
  {
    id: integer("id").primaryKey(),
    showId: integer("show_id")
      .notNull()
      .references(() => shows.id, { onDelete: "cascade" }),
    season: integer("season").notNull(),
    number: integer("number"), // null for specials
    type: text("type").notNull().default("regular"),
    name: text("name"),
    airdate: text("airdate"),
    airstamp: text("airstamp"),
    runtime: integer("runtime"),
    imageMedium: text("image_medium"),
    summary: text("summary"),
  },
  (t) => [index("episodes_show_idx").on(t.showId), index("episodes_air_idx").on(t.airstamp)]
);

// App configuration set from the Settings page (e.g. TMDB credentials).
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

// Every English-language show with an upcoming episode (from TVmaze's full
// schedule feed) — powers the Discover tab. isPremiere marks S1E1s.
export const airing = sqliteTable("airing", {
  showId: integer("show_id").primaryKey(), // TVmaze show id
  name: text("name").notNull(),
  imdbId: text("imdb_id"), // for TMDB resolution (trailers)
  tvdbId: integer("tvdb_id"),
  nextAirAt: text("next_air_at").notNull(),
  season: integer("season"),
  number: integer("number"),
  isPremiere: integer("is_premiere").notNull().default(0),
  network: text("network"),
  showType: text("show_type"),
  genres: text("genres"), // JSON array
  country: text("country"), // network country code; null for global streamers
  weight: integer("weight").notNull().default(0), // TVmaze popularity score 0-100
  summary: text("summary"),
  imageMedium: text("image_medium"),
  url: text("url"),
  fetchedAt: text("fetched_at").notNull(),
});

// Cached TMDB "shows like this" results per followed show.
export const similar = sqliteTable(
  "similar",
  {
    sourceShowId: integer("source_show_id").notNull(), // TVmaze id of the show these relate to
    tmdbId: integer("tmdb_id").notNull(),
    name: text("name").notNull(),
    year: text("year"),
    overview: text("overview"),
    posterPath: text("poster_path"),
    voteAverage: real("vote_average"),
    fetchedAt: text("fetched_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.sourceShowId, t.tmdbId] })]
);

// ── Movies ──────────────────────────────────────────────────────────────
// Popular US releases from TMDB (weekly cron + manual refresh). A movie shows
// on the timeline at digitalAt when known, else theatricalAt.
export const moviesFeed = sqliteTable("movies_feed", {
  tmdbId: integer("tmdb_id").primaryKey(),
  title: text("title").notNull(),
  year: integer("year"),
  posterPath: text("poster_path"),
  overview: text("overview"),
  popularity: real("popularity").notNull().default(0),
  theatricalAt: text("theatrical_at"), // US theatrical release (ISO date)
  digitalAt: text("digital_at"), // US digital/streaming release (ISO date)
  fetchedAt: text("fetched_at").notNull(),
});

// User-tracked movies: survive feed rebuilds; release dates refreshed by cron
// so "waiting for digital" flips to a date the moment TMDB learns it.
export const trackedMovies = sqliteTable("tracked_movies", {
  tmdbId: integer("tmdb_id").primaryKey(),
  title: text("title").notNull(),
  year: integer("year"),
  posterPath: text("poster_path"),
  theatricalAt: text("theatrical_at"),
  digitalAt: text("digital_at"),
  trackedAt: text("tracked_at").notNull(),
});

// ── Plex library mirror ─────────────────────────────────────────────────
// Backfilled from a Plex database export, kept current by the Plex webhook
// (library.new). tvmazeShowId links a Plex show to our shows table when a
// match is found; presence icons join through it.
export const plexShows = sqliteTable("plex_shows", {
  ratingKey: text("rating_key").primaryKey(), // Plex's stable id
  title: text("title").notNull(),
  year: integer("year"),
  guid: text("guid"),
  tvdbId: integer("tvdb_id"),
  tmdbId: integer("tmdb_id"),
  imdbId: text("imdb_id"),
  tvmazeShowId: integer("tvmaze_show_id"),
  addedAt: text("added_at"),
});

export const plexEpisodes = sqliteTable(
  "plex_episodes",
  {
    ratingKey: text("rating_key").primaryKey(),
    showRatingKey: text("show_rating_key"),
    showTitle: text("show_title"),
    season: integer("season"),
    number: integer("number"),
    title: text("title"),
    addedAt: text("added_at"),
  },
  (t) => [index("plex_episodes_show_idx").on(t.showRatingKey)]
);

// Stored now, surfaced later — a movie feature is planned.
export const plexMovies = sqliteTable("plex_movies", {
  ratingKey: text("rating_key").primaryKey(),
  title: text("title").notNull(),
  year: integer("year"),
  guid: text("guid"),
  tmdbId: integer("tmdb_id"),
  imdbId: text("imdb_id"),
  addedAt: text("added_at"),
});

export const watched = sqliteTable(
  "watched",
  {
    episodeId: integer("episode_id")
      .primaryKey()
      .references(() => episodes.id, { onDelete: "cascade" }),
    showId: integer("show_id")
      .notNull()
      .references(() => shows.id, { onDelete: "cascade" }),
    watchedAt: text("watched_at").notNull(),
  },
  (t) => [index("watched_show_idx").on(t.showId)]
);

export type Show = typeof shows.$inferSelect;
export type Episode = typeof episodes.$inferSelect;
export type Watched = typeof watched.$inferSelect;
export type AiringShow = typeof airing.$inferSelect;
export type MovieFeedItem = typeof moviesFeed.$inferSelect;
export type SimilarShow = typeof similar.$inferSelect;
