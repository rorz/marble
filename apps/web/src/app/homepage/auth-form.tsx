"use client";

import {
  MarbleAlert,
  MarbleButton,
  MarbleCard,
  MarbleCardContent,
  MarbleInput,
} from "@marble/ui";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { createClient } from "../../lib/supabase/browser";

const AuthForm = () => {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSignIn = async () => {
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

    router.replace("/projects");
    router.refresh();
  };

  const handleSignUp = async () => {
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
      router.replace("/projects");
      router.refresh();
      return;
    }

    setMessage(
      "Account created. Confirm the email address from Supabase before signing in.",
    );
  };

  return (
    <MarbleCard className="bg-taupe-200 p-1">
      <MarbleCardContent className="flex flex-col gap-2 p-1">
        <MarbleInput
          autoComplete="email"
          id="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          type="email"
          value={email}
        />

        <MarbleInput
          autoComplete="current-password"
          id="password"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="••••••••"
          type="password"
          value={password}
        />

        {error ? (
          <MarbleAlert
            size="sm"
            tone="error"
          >
            {error}
          </MarbleAlert>
        ) : null}
        {message ? (
          <MarbleAlert
            size="sm"
            tone="success"
          >
            {message}
          </MarbleAlert>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <MarbleButton
            disabled={pending || !email || !password}
            onClick={() => void handleSignIn()}
            variant="orange"
          >
            {pending ? "Working..." : "Sign in"}
          </MarbleButton>

          <MarbleButton
            disabled={pending || !email || !password}
            onClick={() => void handleSignUp()}
            variant={"dark"}
          >
            Create account
          </MarbleButton>
        </div>
      </MarbleCardContent>
    </MarbleCard>
  );
};
export default AuthForm;
