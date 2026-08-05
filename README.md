# One More Episode 📺

*The lie we all tell at 1am.*

A self-hosted TV show tracker — a replacement for the dearly departed **TV Time**.
Follow shows, mark episodes watched, see what to watch next and when new
episodes (and brand-new series) are coming.

- **No accounts, no ads, your data stays yours** — runs locally or on your own
  free Vercel + Turso stack
- **Works with zero API keys** — show data comes from the free
  [TVmaze API](https://www.tvmaze.com/api)
- **Import your TV Time history** — point it at your TV Time GDPR export and
  your followed shows and full watch history come along
- Optional: add a free [TMDB](https://www.themoviedb.org) key on the Settings
  page to unlock "shows like this" recommendations

## Features

- **Watch Next** — the next unwatched episode of every show you're behind on,
  with progress bars and one-tap "watched"
- **Upcoming** — future air dates for your shows, grouped by day
- **Discover** — every English-language show airing in the next 180 days,
  filterable by platform (all of Apple TV+, HBO, Netflix… at a glance), name,
  type, genre, and country, with premieres/returning toggles and a popularity
  sort
- **Shows** — your library with per-show progress, season-level and
  mark-all-watched actions, episode lists, auto-refreshing air dates
- **Add** — search and follow any show
- **Similar** *(with TMDB key)* — "more like this" on every show page and
  from search results, followable in one click
- **Trailers** *(with TMDB key)* — in-app trailer/teaser playback in a modal,
  on show pages and Discover cards
- **Movies** *(with TMDB key)* — popular US releases on a timeline: digital
  date when known, theatrical until then; track a movie to catch the moment
  it becomes streamable
- Installable as a PWA; dark UI

## Quick start (local)

```bash
git clone https://github.com/productengineered/one-more-episode.git
cd one-more-episode
npm run setup     # installs deps, creates the database, offers to import TV Time data
npm run dev       # → http://localhost:3000
```

That's it. No configuration required.

### Importing your TV Time history

Request your data export from TV Time (GDPR request), then:

```bash
npm run import -- /path/to/your/tvtime-export
```

(or drop the folder in the project as `gdpr-data/` and just `npm run import`).
Shows are matched to TVmaze by TheTVDB id with a name-search fallback; your
per-episode watch history is matched by season/episode number. The script
prints a summary of anything it couldn't match.

### Recommendations (optional)

Everything works without any key. To also get "shows like this":
open **Settings (⚙)** in the app and paste a free TMDB API key
([get one here](https://www.themoviedb.org/settings/api)). Either the
"API Read Access Token" or the shorter "API Key" works. The key is stored in
your database — never committed, never sent anywhere except TMDB.

## Deploy to Vercel

The database driver speaks both local SQLite files and
[Turso](https://turso.tech) (free tier is plenty), so deploying is just an
env-var change. With the [Turso CLI](https://docs.turso.tech/cli/installation)
and [Vercel CLI](https://vercel.com/docs/cli) installed:

```bash
npm run deploy    # guided: creates the Turso DB (seeded from your local
                  # library if you want), pushes schema, sets env vars, deploys
```

Or manually: create a Turso database, set `DATABASE_URL` and
`DATABASE_AUTH_TOKEN` on your Vercel project, run
`DATABASE_URL=... DATABASE_AUTH_TOKEN=... npm run db:push`, and `vercel --prod`.

**Weekly data refresh:** set a `CRON_SECRET` env var (any random string) and
the included cron (`vercel.json` → `/api/cron`, Monday mornings) rebuilds
Discover and re-syncs stale running shows — premiere-date changes and
cancellations reconcile even if you never open the app. Data also refreshes
on use: opening a show re-syncs it if stale, and the Upcoming and Discover
pages have manual refresh buttons.

> **Important:** One More Episode is a single-user app with no login. On a
> public deployment, enable **Settings → Deployment Protection → Vercel
> Authentication** in the Vercel dashboard so only you can reach it.

## Commands

```bash
npm run setup      # one-shot local setup
npm run dev        # start the app
npm run import     # import a TV Time GDPR export (optionally pass a path)
npm run db:push    # create/update the database schema
npm run deploy     # guided Vercel + Turso deployment
npm run build      # production build
```

## Data sources & attribution

- Show, episode, and schedule data: [TVmaze](https://www.tvmaze.com)
  (free for non-commercial use, [CC BY-SA](https://www.tvmaze.com/api#licensing))
- Recommendations and some artwork: [TMDB](https://www.themoviedb.org).
  This product uses the TMDB API but is not endorsed or certified by TMDB.

## License

[MIT](LICENSE)
