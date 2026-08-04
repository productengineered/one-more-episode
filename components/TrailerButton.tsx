"use client";

import { useEffect, useState, useTransition } from "react";
import { fetchShowVideos, type ShowVideo } from "@/app/actions";

interface ResolveHints {
  tmdbId?: number | null;
  imdbId?: string | null;
  tvdbId?: number | null;
  tvmazeShowId?: number | null;
}

export function TrailerButton({
  showName,
  hints,
  size = "md",
}: {
  showName: string;
  hints: ResolveHints;
  size?: "sm" | "md";
}) {
  const [pending, startTransition] = useTransition();
  const [videos, setVideos] = useState<ShowVideo[] | null>(null); // null = not fetched yet
  const [open, setOpen] = useState(false);

  const openModal = () => {
    if (videos !== null) {
      setOpen(true);
      return;
    }
    startTransition(async () => {
      const v = await fetchShowVideos(hints);
      setVideos(v);
      setOpen(true);
    });
  };

  const cls =
    size === "md"
      ? "rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-1.5 text-sm text-zinc-300 hover:border-zinc-500"
      : "rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-400 hover:border-zinc-600 hover:text-zinc-200";

  return (
    <>
      <button onClick={openModal} disabled={pending} className={`${cls} transition-colors disabled:opacity-60`}>
        {pending ? "Loading…" : "▶ Trailer"}
      </button>
      {open && videos !== null && (
        <TrailerModal showName={showName} videos={videos} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

const TYPE_BADGE: Record<string, string> = {
  Trailer: "bg-violet-600/20 text-violet-300",
  Teaser: "bg-sky-500/15 text-sky-300",
  Featurette: "bg-amber-500/15 text-amber-300",
  Clip: "bg-zinc-700/40 text-zinc-300",
};

function TrailerModal({
  showName,
  videos,
  onClose,
}: {
  showName: string;
  videos: ShowVideo[];
  onClose: () => void;
}) {
  // With exactly one video there's nothing to choose — play it immediately.
  const [selected, setSelected] = useState<string | null>(
    videos.length === 1 ? videos[0].key : null
  );

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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${showName} videos`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-zinc-800 bg-zinc-950 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="truncate font-semibold">{showName} — videos</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            ✕
          </button>
        </div>

        <div className="aspect-video w-full shrink-0 overflow-hidden rounded-xl bg-zinc-900">
          {selected ? (
            <iframe
              key={selected}
              src={`https://www.youtube-nocookie.com/embed/${selected}?autoplay=1`}
              title="Video player"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
              className="h-full w-full"
            />
          ) : (
            <div className="grid h-full w-full place-items-center text-sm text-zinc-600">
              {videos.length ? "Pick a video below" : "No videos found on TMDB for this show"}
            </div>
          )}
        </div>

        {videos.length > 0 && (
          <ul className="mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto">
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
                  {v.official && (
                    <span className="shrink-0 text-[10px] text-zinc-600">official</span>
                  )}
                  <span className="shrink-0 text-zinc-600">{selected === v.key ? "▶" : ""}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
