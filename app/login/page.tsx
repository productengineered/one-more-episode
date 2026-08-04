import { LoginForm } from "@/components/LoginForm";
import { authEnabled } from "@/lib/auth";
import { getStoredPasswordHash } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const firstTime = authEnabled() && !(await getStoredPasswordHash());
  return (
    <div className="mx-auto flex max-w-sm flex-1 flex-col items-center justify-center gap-6 py-24">
      <div className="flex items-center gap-2 text-lg font-semibold tracking-tight">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-600 text-sm">▶</span>
        One More Episode
      </div>
      {firstTime && (
        <p className="text-center text-sm text-zinc-500">
          Welcome! Create a password to protect this instance — you can change it
          later in Settings.
        </p>
      )}
      <LoginForm firstTime={firstTime} />
    </div>
  );
}
