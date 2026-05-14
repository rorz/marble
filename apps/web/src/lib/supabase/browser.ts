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
const instantiate = () =>
  createBrowserClient(
    supabasePublicConfig.url,
    supabasePublicConfig.publishableKey,
  );

let cachedClient: null | ReturnType<typeof instantiate> = null;

export const createClient = () => {
  const client = cachedClient ?? instantiate();
  cachedClient = client;
  return client;
};
