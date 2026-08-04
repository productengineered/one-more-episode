"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-sm flex-1 flex-col items-center justify-center gap-4 py-24 text-center">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-600 text-lg">▶</span>
      <h1 className="text-lg font-semibold">Can’t reach the database</h1>
      <p className="text-sm text-zinc-500">
        The show library didn’t respond — usually a brief hiccup with the database
        host. Your data is safe; give it a moment and try again.
      </p>
      <button
        onClick={reset}
        className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
      >
        Try again
      </button>
    </div>
  );
}
