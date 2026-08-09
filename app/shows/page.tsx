import Image from "next/image";
import Link from "next/link";
import { MarkAllButton } from "@/components/MarkAllButton";
import { ShowsSearch } from "@/components/ShowsSearch";
import { ProgressBar } from "@/components/ProgressBar";
import { getAllProgress, type ShowProgress } from "@/lib/queries";

export const dynamic = "force-dynamic";

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    Running: "bg-emerald-500/15 text-emerald-400",
    Ended: "bg-zinc-700/40 text-zinc-400",
    "To Be Determined": "bg-amber-500/15 text-amber-400",
    "In Development": "bg-sky-500/15 text-sky-400",
  };
  return styles[status] ?? "bg-zinc-700/40 text-zinc-400";
}

function ShowGrid({ items }: { items: ShowProgress[] }) {
  return (
    <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
      {items.map(({ show, airedCount, watchedCount }) => (
        <li
          key={show.id}
          data-scroll-anchor={`show-${show.id}`}
          className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60 transition-colors hover:border-zinc-600"
        >
          <Link href={`/shows/${show.id}`} className="group block">
            {show.imageMedium ? (
              <Image
                src={show.imageMedium}
                alt=""
                width={210}
                height={295}
                className="aspect-[5/7] w-full object-cover"
              />
            ) : (
              <div className="grid aspect-[5/7] w-full place-items-center bg-zinc-800 p-2 text-center text-xs text-zinc-500">
                {show.name}
              </div>
            )}
            <div className="space-y-1.5 p-2 pb-0">
              <p className="truncate text-xs font-medium group-hover:text-violet-300">
                {show.name}
              </p>
              <span
                className={`inline-block rounded-full px-1.5 py-px text-[10px] ${statusBadge(show.status)}`}
              >
                {show.status}
              </span>
            </div>
          </Link>
          <div className="space-y-1.5 p-2">
            <ProgressBar value={watchedCount} max={airedCount} />
            {watchedCount < airedCount && (
              <MarkAllButton showId={show.id} remaining={airedCount - watchedCount} />
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

export default async function ShowsPage({ searchParams }: PageProps<"/shows">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";
  let progress = await getAllProgress();
  if (q) progress = progress.filter((p) => p.show.name.toLowerCase().includes(q));
  const watching = progress.filter((p) => p.nextUnwatched);
  const upToDate = progress.filter((p) => !p.nextUnwatched && p.show.status !== "Ended");
  const finished = progress.filter((p) => !p.nextUnwatched && p.show.status === "Ended");

  const sections: [string, ShowProgress[]][] = [
    [`In progress (${watching.length})`, watching],
    [`Up to date (${upToDate.length})`, upToDate],
    [`Ended & caught up (${finished.length})`, finished],
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold tracking-tight">Shows</h1>
        <div className="flex w-full items-center gap-3 sm:w-auto">
          <ShowsSearch initial={q} />
          <p className="shrink-0 text-sm text-zinc-500">
            {q ? `${progress.length} matching` : `${progress.length} followed`}
          </p>
        </div>
      </div>
      {q && progress.length === 0 && (
        <p className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 text-zinc-400">
          No followed shows match “{q}”.
        </p>
      )}
      {sections.map(
        ([title, items]) =>
          items.length > 0 && (
            <section key={title}>
              <h2 className="mb-3 text-sm font-semibold text-zinc-300">{title}</h2>
              <ShowGrid items={items} />
            </section>
          )
      )}
    </div>
  );
}
