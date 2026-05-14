import { createBrowserClient } from "@supabase/ssr";
import { supabasePublicConfig } from "./public-config";

// Module-level singleton: the browser supabase client owns exactly one
// websocket (used by realtime broadcasts) and one auth session per tab.
// Spinning up a new client per call collides with the browser's per-origin
// WebSocket cap and silently drops realtime traffic — every `usePrivateBroadcast`
// caller must share the same client.
//
// `instantiate` exists so `ReturnType<typeof instantiate>` captures the
// instantiated client type. `ReturnType<typeof createBrowserClient>` on its own
// strips the generic args and downgrades downstream `.channel`/`.on` calls to `any`.
//
// We also patch a real gap in `supabase-js@2.102.1`'s `_handleTokenChanged`:
// it only forwards `SIGNED_IN | TOKEN_REFRESHED | SIGNED_OUT` to the realtime
// client. The `INITIAL_SESSION` event that `@supabase/ssr` fires when it
// hydrates the session from cookies on first load is silently dropped, so
// `realtime.accessTokenValue` stays `undefined` until the user's hook calls
// `setAuth()`. If that call races cookie hydration, `getSession()` returns
// null and `_getAccessToken` falls back to the anon publishable key — the
// channel joins successfully but RLS on `realtime.messages` rejects every
// SELECT, so broadcasts vanish until a hard refresh. Forwarding
// `INITIAL_SESSION` here closes that gap.
const instantiate = () => {
  const client = createBrowserClient(
    supabasePublicConfig.url,
    supabasePublicConfig.publishableKey,
  );
  client.auth.onAuthStateChange((event, session) => {
    if (event === "INITIAL_SESSION" && session?.access_token) {
      void client.realtime.setAuth(session.access_token);
    }
  });
  return client;
};

let cachedClient: null | ReturnType<typeof instantiate> = null;

export const createClient = () => {
  const client = cachedClient ?? instantiate();
  cachedClient = client;
  return client;
};
