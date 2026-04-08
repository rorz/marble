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

    const { error: authError } = await supabase.auth.signOut();

    setPending(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    router.replace("/");
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void handleSignOut()}
        disabled={pending}
        className="rounded border border-stone-300 px-3 py-2 text-sm text-stone-900 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Signing out..." : "Sign out"}
      </button>
      {error ? <p className="text-xs text-red-500">{error}</p> : null}
    </div>
  );
}
