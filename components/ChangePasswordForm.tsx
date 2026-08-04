"use client";

import { useState, useTransition } from "react";
import { changePassword } from "@/app/actions";

export function ChangePasswordForm() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-2">
      <div className="flex max-w-md gap-2">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New password"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none placeholder:text-zinc-600 focus:border-violet-500"
        />
        <button
          onClick={() =>
            startTransition(async () => {
              const r = await changePassword(password);
              setMessage(
                r.ok
                  ? { ok: true, text: "Password changed" }
                  : { ok: false, text: r.error ?? "Failed" }
              );
              if (r.ok) setPassword("");
            })
          }
          disabled={pending || !password}
          className="shrink-0 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Change"}
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
