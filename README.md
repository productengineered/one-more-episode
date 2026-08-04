# Showtime

Personal TV show tracker — a self-hosted replacement for TV Time. Follows shows,
tracks watched episodes, and shows upcoming air dates.

- **Stack**: Next.js (App Router) · Drizzle ORM · libSQL/SQLite · Tailwind
- **Data source**: [TVmaze API](https://www.tvmaze.com/api) (free, no API key)
- **Database**: local file at `data/tv.db`. For Vercel, point `DATABASE_URL`
  (+ `DATABASE_AUTH_TOKEN`) at a [Turso](https://turso.tech) database — no code
  changes needed.

## Commands

```bash
npm run dev        # start the app at http://localhost:3000
npm run db:push    # create/update database schema
npm run import     # one-time import of a TV Time GDPR export from ./gdpr-data
npm run build      # production build
```

## Pages

- **/** — Watch Next: the next unwatched episode of every show you're behind on
- **/upcoming** — future air dates, grouped by day, plus shows waiting on a schedule
- **/premieres** — new series premiering in the next 90 days (from TVmaze's full
  schedule feed), with platform/type/genre/country filters and a popularity sort
- **/shows** — poster grid of everything you follow, with progress
- **/shows/[id]** — seasons and episodes, watched toggles, refresh, unfollow
- **/add** — search TVmaze and follow new shows

Show data refreshes automatically when you open a show that hasn't synced in
24h (ended shows are skipped), or in bulk via "Refresh air dates" on Upcoming.
