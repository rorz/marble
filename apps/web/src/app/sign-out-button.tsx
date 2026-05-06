"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { createClient } from "../lib/supabase/browser";

export function useSignOut() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signOut() {
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
      return false;
    }

    router.replace("/");
    router.refresh();

    return true;
  }

  return {
    error,
    pending,
    signOut,
  };
}
