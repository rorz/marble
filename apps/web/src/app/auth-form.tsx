"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { createClient } from "../lib/supabase/browser";

export default function AuthForm() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSignIn() {
    setPending(true);
    setError(null);
    setMessage(null);

    const {
      data: { session },
      error: authError,
    } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setPending(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    if (!session) {
      setError("Supabase did not return a session.");
      return;
    }

    router.replace("/tables");
    router.refresh();
  }

  async function handleSignUp() {
    setPending(true);
    setError(null);
    setMessage(null);

    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    setPending(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    if (data.session) {
      router.replace("/tables");
      router.refresh();
      return;
    }

    setMessage(
      "Account created. Confirm the email address from Supabase before signing in.",
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1 text-stone-950">
        <label
          className="block text-xs uppercase tracking-[0.2em]"
          htmlFor="email"
        >
          Email
        </label>
        <input
          autoComplete="email"
          className="w-full rounded border border-stone-700 bg-stone-50 px-3 py-2 text-sm outline-none transition focus:border-stone-500"
          id="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          type="email"
          value={email}
        />
      </div>

      <div className="space-y-1">
        <label
          className="block text-xs uppercase tracking-[0.2em]"
          htmlFor="password"
        >
          Password
        </label>
        <input
          autoComplete="current-password"
          className="w-full rounded border border-stone-700 px-3 py-2 text-sm outline-none transition focus:border-stone-500"
          id="password"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="••••••••"
          type="password"
          value={password}
        />
      </div>

      {error ? <p className="text-red-300 text-sm">{error}</p> : null}
      {message ? <p className="text-emerald-300 text-sm">{message}</p> : null}

      <div className="flex flex-wrap gap-3">
        <button
          className="rounded border border-stone-600 px-3 py-2 text-sm transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={pending || !email || !password}
          onClick={() => void handleSignIn()}
          type="button"
        >
          {pending ? "Working..." : "Sign in"}
        </button>
        <button
          className="rounded border border-stone-800 px-3 py-2 text-sm transition hover:border-stone-600 hover:text-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={pending || !email || !password}
          onClick={() => void handleSignUp()}
          type="button"
        >
          Create account
        </button>
      </div>
    </div>
  );
}
