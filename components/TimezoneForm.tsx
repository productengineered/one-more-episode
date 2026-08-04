"use client";

import { useEffect, useState, useTransition } from "react";
import { saveTimezone } from "@/app/actions";

export function TimezoneForm({
  current,
  serverDefault,
}: {
  current: string | null;
  serverDefault: string;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [browserTz, setBrowserTz] = useState<string | null>(null);
  const [zones, setZones] = useState<string[]>([]);

  useEffect(() => {
    setBrowserTz(Intl.DateTimeFormat().resolvedOptions().timeZone);
    setZones(Intl.supportedValuesOf("timeZone"));
  }, []);

  const save = (tz: string) =>
    startTransition(async () => {
      const r = await saveTimezone(tz);
      setMessage(
        r.ok ? (tz ? `Timezone set to ${tz}` : "Using server default") : (r.error ?? "Failed")
      );
      setTimeout(() => setMessage(null), 4000);
    });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={current ?? ""}
          onChange={(e) => save(e.target.value)}
          disabled={pending || zones.length === 0}
          className="max-w-72 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 outline-none focus:border-violet-500"
        >
          <option value="">Server default ({serverDefault})</option>
          {zones.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </select>
        {browserTz && current !== browserTz && (
          <button
            onClick={() => save(browserTz)}
            disabled={pending}
            className="rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-300 hover:border-zinc-500 disabled:opacity-60"
          >
            Use my timezone ({browserTz})
          </button>
        )}
      </div>
      {message && <p className="text-sm text-emerald-400">{message}</p>}
    </div>
  );
}
