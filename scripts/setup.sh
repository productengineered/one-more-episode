#!/usr/bin/env bash
# One-shot local setup: installs dependencies, creates the database, and
# optionally imports a TV Time export.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "▶ Showtime setup"
echo

if ! command -v node >/dev/null 2>&1; then
  echo "✗ Node.js is required (v20+). Install it from https://nodejs.org and re-run."
  exit 1
fi

echo "→ Installing dependencies…"
npm install --no-fund --no-audit

echo "→ Creating database (data/tv.db)…"
mkdir -p data
npx drizzle-kit push --force >/dev/null
echo "  done"

if [ -d "gdpr-data" ] && [ -f "gdpr-data/followed_tv_show.csv" ]; then
  echo
  read -r -p "→ Found a TV Time export in gdpr-data/. Import it now? (takes a few minutes) [y/N] " reply
  if [[ "$reply" =~ ^[Yy]$ ]]; then
    npm run import
  fi
else
  echo
  echo "  Migrating from TV Time? Drop your GDPR export folder here as gdpr-data/"
  echo "  and run:  npm run import"
fi

echo
echo "✔ All set. Start the app with:  npm run dev"
echo "  Then open http://localhost:3000"
echo "  Optional: add a free TMDB key on the Settings page (⚙) to unlock"
echo "  \"shows like this\" recommendations."
