"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { login } from "@/app/actions";

export function LoginForm({ firstTime = false }: { firstTime?: boolean }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const submit = () =>
    startTransition(async () => {
      const r = await login(password);
      if (r.ok) {
        router.push("/");
        router.refresh();
      } else {
        setError(r.error ?? "Wrong password");
        setPassword("");
      }
    });

  return (
    <form
      className="w-full space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <input
        type="password"
        value={password}
        onChange={(e) => {
          setPassword(e.target.value);
          setError(null);
        }}
        placeholder={firstTime ? "Create a password" : "Password"}
        autoFocus
        className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none placeholder:text-zinc-600 focus:border-violet-500"
      />
      <button
        type="submit"
        disabled={pending || !password}
        className="w-full rounded-lg bg-violet-600 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
      >
        {pending ? "Signing in…" : firstTime ? "Set password & sign in" : "Sign in"}
      </button>
      {error && <p className="text-center text-sm text-red-400">{error}</p>}
    </form>
  );
}
