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

// Upcoming series premieres (S1E1s from TVmaze's full schedule feed), refreshed on demand.
export const premieres = sqliteTable("premieres", {
  showId: integer("show_id").primaryKey(), // TVmaze show id
  name: text("name").notNull(),
  premiereAt: text("premiere_at").notNull(),
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
export type Premiere = typeof premieres.$inferSelect;
export type SimilarShow = typeof similar.$inferSelect;
