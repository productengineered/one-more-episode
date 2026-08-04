"use client";

import { useState, useTransition } from "react";
import { clearTmdbKey, saveTmdbKey } from "@/app/actions";

export function TmdbKeyForm({ savedHint }: { savedHint: string | null }) {
  const [key, setKey] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      {savedHint && (
        <p className="flex items-center gap-2 text-sm">
          <span className="rounded-lg bg-emerald-500/15 px-2 py-1 text-emerald-400">
            ✓ Key saved (…{savedHint})
          </span>
          <button
            onClick={() =>
              startTransition(async () => {
                await clearTmdbKey();
                setMessage({ ok: true, text: "Key removed" });
              })
            }
            disabled={pending}
            className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
          >
            Remove
          </button>
        </p>
      )}
      <div className="flex max-w-xl gap-2">
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={savedHint ? "Paste a new key to replace it" : "Paste your TMDB key here"}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none placeholder:text-zinc-600 focus:border-violet-500"
        />
        <button
          onClick={() =>
            startTransition(async () => {
              const r = await saveTmdbKey(key);
              setMessage(
                r.ok
                  ? { ok: true, text: "Key verified and saved — recommendations are on" }
                  : { ok: false, text: r.error ?? "Something went wrong" }
              );
              if (r.ok) setKey("");
            })
          }
          disabled={pending || !key.trim()}
          className="shrink-0 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {pending ? "Checking…" : "Save"}
        </button>
      </div>
      {message && (
        <p className={`text-sm ${message.ok ? "text-emerald-400" : "text-red-400"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
