import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { SignOutButton } from "@/components/SignOutButton";
import { TimezoneForm } from "@/components/TimezoneForm";
import { authEnabled } from "@/lib/auth";
import { TmdbKeyForm } from "@/components/TmdbKeyForm";
import { db } from "@/lib/db";
import { episodes, shows, watched } from "@/lib/db/schema";
import { getSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const storedKey = await getSetting("tmdb_key");
  const storedTz = await getSetting("timezone");
  const envKey = process.env.TMDB_READ_ACCESS_TOKEN ?? process.env.TMDB_API_KEY;
  const savedHint = storedKey ? storedKey.slice(-4) : null;

  const [showCount, episodeCount, watchedCount] = await Promise.all([
    db.$count(shows),
    db.$count(episodes),
    db.$count(watched),
  ]);

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-xl font-semibold tracking-tight">Settings</h1>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-300">
          TMDB — “shows like this” recommendations
        </h2>
        <p className="text-sm text-zinc-500">
          Show and episode tracking works out of the box with no key (data comes from{" "}
          <a
            href="https://www.tvmaze.com"
            className="text-violet-400 hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            TVmaze
          </a>
          ). Adding a free{" "}
          <a
            href="https://www.themoviedb.org/settings/api"
            className="text-violet-400 hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            TMDB API key
          </a>{" "}
          unlocks recommendations on show pages and search results. Either credential
          works: the “API Read Access Token” (starts with <code>eyJ</code>) or the
          shorter “API Key”.
        </p>
        <TmdbKeyForm savedHint={savedHint} />
        {!storedKey && envKey && (
          <p className="text-xs text-zinc-600">
            Currently using the TMDB key from your environment variables. A key saved
            here would take precedence.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-300">Time zone</h2>
        <p className="text-sm text-zinc-500">
          Air dates and times are shown in this timezone. Running locally, the server
          default is usually already yours — but on a hosted deployment (Vercel) the
          server runs in UTC, so set it explicitly there.
        </p>
        <TimezoneForm
          current={storedTz}
          serverDefault={Intl.DateTimeFormat().resolvedOptions().timeZone}
        />
      </section>

      {authEnabled() && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-300">Account</h2>
          <p className="text-sm text-zinc-500">
            Login is enabled. Devices that are already signed in stay signed in until
            their session expires or they sign out.
          </p>
          <ChangePasswordForm />
          <SignOutButton />
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-zinc-300">Library</h2>
        <p className="text-sm text-zinc-500">
          {showCount} shows · {episodeCount.toLocaleString()} episodes ·{" "}
          {watchedCount.toLocaleString()} watched
        </p>
        <p className="text-xs text-zinc-600">
          Migrating from TV Time? Put your GDPR export folder at{" "}
          <code className="rounded bg-zinc-900 px-1">gdpr-data/</code> in the project and
          run <code className="rounded bg-zinc-900 px-1">npm run import</code>.
        </p>
      </section>
    </div>
  );
}
