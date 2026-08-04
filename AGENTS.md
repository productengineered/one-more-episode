<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# One More Episode — project rules

Self-hosted TV show tracker (TV Time replacement). Next.js App Router +
Drizzle + libSQL/SQLite + Tailwind. Public repo:
https://github.com/productengineered/one-more-episode

## Git / GitHub — IMPORTANT

- Commits MUST be authored with the GitHub noreply email
  `540905+productengineered@users.noreply.github.com` — GitHub rejects pushes
  that expose the owner's real email ("push declined due to email privacy
  restrictions"). The repo-local `git config user.email` is already set to it;
  never change it to a real email.
- The owner's GitHub login is `productengineered` (older tooling labels may
  say "brdohman" — same account).
- NEVER commit: `gdpr-data/` (personal TV Time export), `data/` (database —
  its settings table contains the TMDB key), `.env*` files. All are
  gitignored — keep them that way.

## Commands

- `npm run dev` — dev server on :3000
- `npx tsc --noEmit` — typecheck; run before every commit
- `npm run db:push` — apply schema changes (needs `--force` non-interactively)
- `npm run import -- <path>` — TV Time GDPR export importer
- `npm run setup` / `npm run deploy` — local bootstrap / guided Vercel+Turso

## Architecture notes

- Data sources: TVmaze (no key; throttled ~1 req/600ms in `lib/tvmaze.ts` —
  keep the throttle) and TMDB (optional; credential resolved by
  `lib/settings.ts` from the DB `settings` table first, env vars second).
- Schema in `lib/db/schema.ts`. SQLite FK cascades are NOT relied on; delete
  child rows explicitly.
- Mutations are server actions in `app/actions.ts` calling
  `revalidatePath("/", "layout")`. Buttons that trigger them are small client
  components using `useTransition` with an immediate pending state — every
  action button must give instant visual feedback.
- The owner's real library lives in `data/tv.db`. When testing mutations
  against it, revert precisely afterwards (match on showId + exact
  timestamps), never by broad date-range deletes.
