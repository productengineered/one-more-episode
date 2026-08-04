#!/usr/bin/env bash
# Guided Vercel deployment: creates a Turso database (optionally seeded from
# your local library), pushes the schema, sets env vars, and deploys.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "▶ Showtime → Vercel"
echo

missing=0
for cmd in turso vercel; do
  if ! command -v $cmd >/dev/null 2>&1; then
    echo "✗ '$cmd' CLI not found."
    missing=1
  fi
done
if [ "$missing" = 1 ]; then
  echo
  echo "  Install them first:"
  echo "    Turso:  https://docs.turso.tech/cli/installation"
  echo "    Vercel: npm i -g vercel"
  exit 1
fi

DB_NAME="${1:-showtime}"

if turso db show "$DB_NAME" >/dev/null 2>&1; then
  echo "→ Using existing Turso database '$DB_NAME'"
else
  seed=""
  if [ -f "data/tv.db" ]; then
    read -r -p "→ Seed the new Turso database from your local library (data/tv.db)? [Y/n] " reply
    if [[ ! "$reply" =~ ^[Nn]$ ]]; then
      seed="--from-file data/tv.db"
    fi
  fi
  echo "→ Creating Turso database '$DB_NAME'…"
  # shellcheck disable=SC2086
  turso db create "$DB_NAME" $seed
fi

DB_URL="$(turso db show "$DB_NAME" --url)"
DB_TOKEN="$(turso db tokens create "$DB_NAME")"

echo "→ Making sure the schema is up to date…"
DATABASE_URL="$DB_URL" DATABASE_AUTH_TOKEN="$DB_TOKEN" npx drizzle-kit push --force >/dev/null
echo "  done"

echo "→ Setting Vercel environment variables…"
vercel link
printf '%s' "$DB_URL" | vercel env add DATABASE_URL production
printf '%s' "$DB_TOKEN" | vercel env add DATABASE_AUTH_TOKEN production

echo "→ Deploying…"
vercel --prod

echo
echo "✔ Deployed. Two follow-ups worth doing:"
echo "  1. This app has no login. In the Vercel dashboard, enable"
echo "     Settings → Deployment Protection → Vercel Authentication"
echo "     so only you can open it."
echo "  2. Add your TMDB key on the deployed app's Settings page (it's stored"
echo "     in the database, so it survives redeploys)."
