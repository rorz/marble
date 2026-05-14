"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A generic, broadcast-aware state container.
 *
 * Bulletproof realtime sync on top of {@link usePrivateBroadcast}.
 *
 * The core problem this solves:
 *
 *   Supabase Realtime broadcasts have NO replay. Any DB mutation that happens
 *   between an RSC snapshot landing and the client channel reaching
 *   `SUBSCRIBED` is permanently lost. On top of that, websockets can be
 *   suspended on hidden tabs, dropped on network changes, or queued behind
 *   the per-origin connection cap — any of which silently widens the gap
 *   window and produces a stale local store with no obvious recovery path.
 *
 * The contract:
 *
 *   - `state` is the current snapshot, seeded from `initialState`.
 *   - `applyBroadcast(payload)` is fed every incoming broadcast. It validates
 *     via `isMutation` and either applies immediately or BUFFERS the mutation
 *     when a snapshot refetch is in flight (so mutations that race the
 *     snapshot are replayed onto the fresh state, not dropped).
 *   - `resync()` deduplicates concurrent fetches via an in-flight promise
 *     ref. The first caller drives the fetch; everyone else awaits it.
 *
 * Triggers wired automatically:
 *
 *   - `document.visibilitychange` (when becoming visible): a hidden tab may
 *     have had its websocket throttled or dropped; resync on return.
 *   - `window.focus`: defensive secondary trigger; dedupe makes it cheap.
 *   - `window.online`: a reconnected client may have missed broadcasts while
 *     offline; resync immediately.
 *
 * Callers should also pass the returned `resync` as the `onSubscribed`
 * callback on every `usePrivateBroadcast` consumer that feeds this hook —
 * `onSubscribed` fires on initial subscribe AND on every reconnect, so this
 * is the canonical place to close the subscription-gap race.
 */
interface UseBroadcastResyncOptions<TState, TMutation> {
  /** Pure reducer that applies a single mutation to current state. */
  applyMutation: (current: TState, mutation: TMutation) => TState;
  /** Async fetcher returning a fresh full snapshot. */
  fetchSnapshot: () => Promise<TState>;
  /** Seed state — usually the server-rendered snapshot. */
  initialState: TState;
  /** Type guard that validates an incoming broadcast payload. */
  isMutation: (value: unknown) => value is TMutation;
  /** Optional label used as a prefix for diagnostic logging. */
  label?: string;
}

interface UseBroadcastResyncReturn<TState> {
  /** Feed every incoming broadcast payload here. */
  applyBroadcast: (payload: unknown) => void;
  /** Force a deduplicated snapshot refetch. */
  resync: () => Promise<void>;
  /** Direct setter (escape hatch for local optimistic updates etc.). */
  setState: React.Dispatch<React.SetStateAction<TState>>;
  /** Current snapshot. */
  state: TState;
}

export const useBroadcastResync = <TState, TMutation>({
  applyMutation,
  fetchSnapshot,
  initialState,
  isMutation,
  label,
}: UseBroadcastResyncOptions<
  TState,
  TMutation
>): UseBroadcastResyncReturn<TState> => {
  const [state, setState] = useState<TState>(initialState);

  // `useBroadcastResync` uses refs (not deps) to track in-flight work and
  // buffered mutations. This keeps `applyBroadcast` and `resync` stable
  // across renders, which matters because they're passed to long-lived
  // realtime subscriptions whose effect must not retear on every render.
  const refetchInFlightRef = useRef<null | Promise<void>>(null);
  const bufferedMutationsRef = useRef<TMutation[]>([]);
  const handlersRef = useRef({
    applyMutation,
    fetchSnapshot,
    isMutation,
    label,
  });
  handlersRef.current = {
    applyMutation,
    fetchSnapshot,
    isMutation,
    label,
  };

  const drainBufferOnto = useCallback((seed: TState): TState => {
    const drained = bufferedMutationsRef.current;
    bufferedMutationsRef.current = [];
    return drained.reduce(
      (accumulated, mutation) =>
        handlersRef.current.applyMutation(accumulated, mutation),
      seed,
    );
  }, []);

  const resync = useCallback((): Promise<void> => {
    const inFlight = refetchInFlightRef.current;
    if (inFlight) {
      return inFlight;
    }

    const promise = (async () => {
      try {
        const snapshot = await handlersRef.current.fetchSnapshot();
        // Drain inside the setState callback so the read-clear-apply of the
        // buffer is atomic with the state transition — any broadcast that
        // arrives between snapshot resolution and React running this callback
        // either lands in the buffer (and is drained here) or, post-finally,
        // applies via `applyBroadcast` onto the drained result.
        setState(() => drainBufferOnto(snapshot));
      } catch (error) {
        // Snapshot fetch failed. Don't drop buffered mutations — apply them
        // onto the existing (possibly stale) state. This preserves the
        // pre-resync sync contract: every broadcast received gets applied.
        setState((previous) => drainBufferOnto(previous));
        if (handlersRef.current.label) {
          console.error(`${handlersRef.current.label} resync failed`, error);
        }
      } finally {
        refetchInFlightRef.current = null;
      }
    })();

    refetchInFlightRef.current = promise;
    return promise;
  }, [
    drainBufferOnto,
  ]);

  const applyBroadcast = useCallback((payload: unknown) => {
    if (!handlersRef.current.isMutation(payload)) {
      return;
    }

    const mutation = payload;
    if (refetchInFlightRef.current !== null) {
      // A snapshot refetch is in flight; buffer this mutation so it can be
      // replayed onto the fresh state once the snapshot lands. Applying it
      // directly to the current state would be undone by the snapshot.
      bufferedMutationsRef.current.push(mutation);
      return;
    }

    setState((previous) =>
      handlersRef.current.applyMutation(previous, mutation),
    );
  }, []);

  // Visibility/focus/online triggers all funnel through the deduplicated
  // `resync`. Multiple triggers firing in rapid succession (e.g. a tab
  // returning from background coincides with `online`) collapse to a
  // single in-flight fetch.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void resync();
      }
    };
    const onFocus = () => {
      void resync();
    };
    const onOnline = () => {
      void resync();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
    };
  }, [
    resync,
  ]);

  return {
    applyBroadcast,
    resync,
    setState,
    state,
  };
};
