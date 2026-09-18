"use client";

import Image from "next/image";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { fetchMovieInfo, type MovieInfo, type WatchProvider } from "@/app/actions";
import { TrackMovieButton } from "@/components/TrackMovieButton";
import { formatDate } from "@/lib/format";

// lib/tmdb pulls in server-only settings code, so build image URLs here.
const img = (path: string, size: string) => `https://image.tmdb.org/t/p/${size}${path}`;

const TYPE_BADGE: Record<string, string> = {
  Trailer: "bg-rose-600/20 text-rose-300",
  Teaser: "bg-sky-500/15 text-sky-300",
  Featurette: "bg-amber-500/15 text-amber-300",
  Clip: "bg-zinc-700/40 text-zinc-300",
};

interface MovieBasics {
  tmdbId: number;
  title: string;
  year: number | null;
  posterPath: string | null;
  tracked: boolean;
  inPlex: boolean;
}

/**
 * Makes a movie row's poster + text clickable. The first click fetches full
 * TMDB details (credits, rating, where to watch, videos); later clicks reuse
 * them. Children are the row's server-rendered content — style them with
 * `group-hover:` / `group-aria-busy:` for hover and loading states.
 */
export function MovieInfoButton({ children, ...movie }: MovieBasics & { children: ReactNode }) {
  const [pending, startTransition] = useTransition();
  const [info, setInfo] = useState<MovieInfo | null>(null);
  const [open, setOpen] = useState(false);

  const openModal = () => {
    if (info) {
      setOpen(true);
      return;
    }
    startTransition(async () => {
      // null = TMDB failed: the modal says so, and the next click retries.
      setInfo(await fetchMovieInfo(movie.tmdbId));
      setOpen(true);
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        disabled={pending}
        aria-busy={pending}
        title="More about this movie"
        className="group flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-wait disabled:opacity-60"
      >
        {children}
      </button>
      {open && <MovieInfoModal {...movie} info={info} onClose={() => setOpen(false)} />}
    </>
  );
}

function runtimeLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  return h ? `${h}h ${minutes % 60}m` : `${minutes}m`;
}

function MovieInfoModal({
  tmdbId,
  title,
  year,
  posterPath,
  tracked,
  inPlex,
  info,
  onClose,
}: MovieBasics & { info: MovieInfo | null; onClose: () => void }) {
  const [playing, setPlaying] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const meta = info
    ? [
        info.certification,
        info.runtime && runtimeLabel(info.runtime),
        info.genres.slice(0, 3).join(", "),
      ]
        .filter(Boolean)
        .join("  ·  ")
    : null;
  const { stream = [], rent = [], buy = [], link = null } = info?.providers ?? {};
  const linkCls =
    "rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`About ${title}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold leading-snug">
            {title}
            {year && <span className="ml-2 font-normal text-zinc-500">{year}</span>}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            ✕
          </button>
        </div>

        <div className="flex gap-4">
          {posterPath && (
            <Image
              src={img(posterPath, "w342")}
              alt=""
              width={128}
              height={192}
              className="h-36 w-24 shrink-0 rounded-lg object-cover sm:h-48 sm:w-32"
            />
          )}
          <div className="min-w-0 flex-1 space-y-1.5 text-sm">
            {info?.tagline && <p className="italic text-zinc-400">{info.tagline}</p>}
            {meta && <p className="text-zinc-500">{meta}</p>}
            {info?.rating ? (
              <p className="text-zinc-400">
                ★ {info.rating.toFixed(1)}
                <span className="text-zinc-600">
                  {" "}
                  on TMDB · {info.voteCount.toLocaleString("en-US")} votes
                </span>
              </p>
            ) : null}
            {info && (
              <p className="text-zinc-400">
                {info.theatricalAt && `Theaters ${formatDate(info.theatricalAt)} · `}
                Digital {info.digitalAt ? formatDate(info.digitalAt) : "not announced"}
              </p>
            )}
            {inPlex && <p className="font-semibold text-amber-400">» On Plex</p>}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <TrackMovieButton tmdbId={tmdbId} tracked={tracked} size="sm" />
              {info?.imdbId && (
                <a
                  href={`https://www.imdb.com/title/${info.imdbId}/`}
                  target="_blank"
                  rel="noreferrer"
                  className={linkCls}
                >
                  IMDb ↗
                </a>
              )}
              <a
                href={`https://www.themoviedb.org/movie/${tmdbId}`}
                target="_blank"
                rel="noreferrer"
                className={linkCls}
              >
                TMDB ↗
              </a>
            </div>
          </div>
        </div>

        {!info ? (
          <p className="mt-4 text-sm text-zinc-400">
            Couldn’t load details from TMDB — close this and try again.
          </p>
        ) : (
          <>
            <p className="mt-4 text-sm leading-relaxed text-zinc-300">
              {info.overview ?? "No synopsis available."}
            </p>

            {(info.directors.length > 0 || info.writers.length > 0) && (
              <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                {info.directors.length > 0 && (
                  <>
                    <dt className="text-zinc-500">
                      {info.directors.length > 1 ? "Directors" : "Director"}
                    </dt>
                    <dd className="text-zinc-200">{info.directors.join(", ")}</dd>
                  </>
                )}
                {info.writers.length > 0 && (
                  <>
                    <dt className="text-zinc-500">Writers</dt>
                    <dd className="text-zinc-200">{info.writers.join(", ")}</dd>
                  </>
                )}
              </dl>
            )}

            {info.cast.length > 0 && (
              <section className="mt-5">
                <h3 className="mb-2 text-sm font-semibold text-zinc-300">Cast</h3>
                <ul className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
                  {info.cast.map((c) => (
                    <li key={`${c.name}-${c.character}`} className="flex items-center gap-2.5">
                      {c.profilePath ? (
                        <Image
                          src={img(c.profilePath, "w185")}
                          alt=""
                          width={40}
                          height={40}
                          className="h-10 w-10 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-zinc-800 text-xs text-zinc-500">
                          {c.name.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm text-zinc-200">{c.name}</p>
                        {c.character && (
                          <p className="truncate text-xs text-zinc-500">{c.character}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="mt-5">
              <h3 className="mb-2 text-sm font-semibold text-zinc-300">Where to watch (US)</h3>
              {stream.length + rent.length + buy.length === 0 ? (
                <p className="text-sm text-zinc-500">Not streaming, renting, or selling in the US yet.</p>
              ) : (
                <div className="space-y-2">
                  <ProviderRow label="Stream" list={stream} />
                  <ProviderRow label="Rent" list={rent} />
                  <ProviderRow label="Buy" list={buy} />
                </div>
              )}
              <p className="mt-2 text-xs text-zinc-600">
                Availability data from JustWatch
                {link && (
                  <>
                    {" · "}
                    <a href={link} target="_blank" rel="noreferrer" className="hover:text-zinc-400">
                      all options ↗
                    </a>
                  </>
                )}
              </p>
            </section>

            {info.videos.length > 0 && (
              <section className="mt-5">
                <h3 className="mb-2 text-sm font-semibold text-zinc-300">Videos</h3>
                {playing && (
                  <div className="mb-2 aspect-video w-full overflow-hidden rounded-xl bg-zinc-900">
                    <iframe
                      key={playing}
                      src={`https://www.youtube-nocookie.com/embed/${playing}?autoplay=1`}
                      title="Video player"
                      allow="autoplay; encrypted-media; picture-in-picture"
                      allowFullScreen
                      className="h-full w-full"
                    />
                  </div>
                )}
                <ul className="max-h-48 space-y-1 overflow-y-auto">
                  {info.videos.map((v) => (
                    <li key={v.key}>
                      <button
                        onClick={() => setPlaying(v.key)}
                        className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
                          playing === v.key
                            ? "bg-rose-600/15 text-rose-200"
                            : "text-zinc-300 hover:bg-zinc-900"
                        }`}
                      >
                        <span
                          className={`shrink-0 rounded-full px-2 py-px text-[10px] font-medium ${
                            TYPE_BADGE[v.type] ?? "bg-zinc-700/40 text-zinc-300"
                          }`}
                        >
                          {v.type}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{v.name}</span>
                        <span className="shrink-0 text-zinc-600">{playing === v.key ? "▶" : ""}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ProviderRow({ label, list }: { label: string; list: WatchProvider[] }) {
  if (!list.length) return null;
  return (
    <div className="flex items-start gap-3">
      <span className="w-12 shrink-0 pt-1 text-xs text-zinc-500">{label}</span>
      <ul className="flex flex-wrap gap-1.5">
        {list.map((p) => (
          <li
            key={p.name}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 py-0.5 pl-0.5 pr-2 text-xs text-zinc-300"
          >
            {p.logoPath && (
              <Image
                src={img(p.logoPath, "w92")}
                alt=""
                width={20}
                height={20}
                className="h-5 w-5 rounded-md"
              />
            )}
            {p.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
