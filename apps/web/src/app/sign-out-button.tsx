"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { createClient } from "../lib/supabase/browser";

export default function SignOutButton() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignOut() {
    setPending(true);
    setError(null);

    const [authResult, clearCookiesResult] = await Promise.allSettled([
      supabase.auth.signOut(),
      fetch("/api/auth/sign-out", {
        method: "POST",
      }),
    ]);

    setPending(false);

    const authError =
      authResult.status === "fulfilled"
        ? authResult.value.error
        : new Error("Failed to contact Supabase.");
    const cookiesCleared =
      clearCookiesResult.status === "fulfilled" && clearCookiesResult.value.ok;

    if (authError && !cookiesCleared) {
      setError(authError.message);
      return;
    }

    router.replace("/");
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        className="rounded border border-stone-300 px-3 py-2 text-sm text-stone-900 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={pending}
        onClick={() => void handleSignOut()}
        type="button"
      >
        {pending ? "Signing out..." : "Sign out"}
      </button>
      {error ? <p className="text-red-500 text-xs">{error}</p> : null}
    </div>
  );
}
