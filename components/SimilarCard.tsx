"use client";

import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import { fetchTvInfo, type ShowVideo, type TvInfo } from "@/app/actions";
import { FollowTmdbButton } from "./FollowTmdbButton";

const TYPE_BADGE: Record<string, string> = {
  Trailer: "bg-violet-600/20 text-violet-300",
  Teaser: "bg-sky-500/15 text-sky-300",
  Featurette: "bg-amber-500/15 text-amber-300",
  Clip: "bg-zinc-700/40 text-zinc-300",
};

export function SimilarCard({
  tmdbId,
  name,
  year,
  posterUrl,
  voteAverage,
  following,
}: {
  tmdbId: number;
  name: string;
  year: string | null;
  posterUrl: string | null;
  voteAverage: number | null;
  following: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [data, setData] = useState<{ info: TvInfo | null; videos: ShowVideo[] } | null>(null);
  const [open, setOpen] = useState(false);

  const openModal = () => {
    if (data) {
      setOpen(true);
      return;
    }
    startTransition(async () => {
      setData(await fetchTvInfo(tmdbId));
      setOpen(true);
    });
  };

  return (
    <li className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-2.5 transition-colors hover:border-zinc-600">
      <button
        onClick={openModal}
        disabled={pending}
        title="More about this show"
        className="group flex min-w-0 flex-1 items-center gap-3 text-left disabled:opacity-60"
      >
        {posterUrl ? (
          <Image
            src={posterUrl}
            alt=""
            width={56}
            height={84}
            className="h-[84px] w-14 shrink-0 rounded-md object-cover"
          />
        ) : (
          <div className="h-[84px] w-14 shrink-0 rounded-md bg-zinc-800" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium group-hover:text-violet-300">
            {pending ? "Loading…" : name}
          </p>
          <p className="text-xs text-zinc-500">
            {[year, voteAverage ? `★ ${voteAverage.toFixed(1)}` : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </button>
      <div className="shrink-0">
        {following ? (
          <span className="rounded-md bg-emerald-500/15 px-2 py-1 text-xs text-emerald-400">
            ✓ Following
          </span>
        ) : (
          <FollowTmdbButton tmdbId={tmdbId} />
        )}
      </div>
      {open && data && (
        <InfoModal
          name={name}
          year={year}
          posterUrl={posterUrl}
          info={data.info}
          videos={data.videos}
          onClose={() => setOpen(false)}
        />
      )}
    </li>
  );
}

function InfoModal({
  name,
  year,
  posterUrl,
  info,
  videos,
  onClose,
}: {
  name: string;
  year: string | null;
  posterUrl: string | null;
  info: TvInfo | null;
  videos: ShowVideo[];
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);

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

  const metaLine = info
    ? [
        info.network,
        info.status,
        info.seasons !== null &&
          `${info.seasons} season${info.seasons === 1 ? "" : "s"}${
            info.episodes ? ` · ${info.episodes} eps` : ""
          }`,
        info.genres.slice(0, 3).join(" · "),
      ]
        .filter(Boolean)
        .join("  ·  ")
    : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`About ${name}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="truncate font-semibold">
            {name}
            {(info?.firstAirYear ?? year) && (
              <span className="ml-2 font-normal text-zinc-500">
                {info?.firstAirYear ?? year}
              </span>
            )}
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
          {posterUrl && (
            <Image
              src={posterUrl.replace("/w185/", "/w342/")}
              alt=""
              width={128}
              height={192}
              className="hidden h-48 w-32 shrink-0 rounded-lg object-cover sm:block"
            />
          )}
          <div className="min-w-0 flex-1 space-y-2">
            {metaLine && <p className="text-sm text-zinc-500">{metaLine}</p>}
            {info?.rating ? (
              <p className="text-sm text-zinc-400">★ {info.rating.toFixed(1)} on TMDB</p>
            ) : null}
            <p className="text-sm leading-relaxed text-zinc-300">
              {info?.overview || "No synopsis available."}
            </p>
          </div>
        </div>

        {videos.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 text-sm font-semibold text-zinc-300">Videos</h3>
            {selected && (
              <div className="mb-2 aspect-video w-full overflow-hidden rounded-xl bg-zinc-900">
                <iframe
                  key={selected}
                  src={`https://www.youtube-nocookie.com/embed/${selected}?autoplay=1`}
                  title="Video player"
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full"
                />
              </div>
            )}
            <ul className="max-h-48 space-y-1 overflow-y-auto">
              {videos.map((v) => (
                <li key={v.key}>
                  <button
                    onClick={() => setSelected(v.key)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
                      selected === v.key
                        ? "bg-violet-600/15 text-violet-200"
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
                    <span className="shrink-0 text-zinc-600">
                      {selected === v.key ? "▶" : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
