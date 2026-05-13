"use client";

import { useLinkStatus } from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { cx } from "../utils/cx";

type Listener = (count: number) => void;

const listeners = new Set<Listener>();
let pendingCount = 0;

function notify() {
  for (const listener of listeners) {
    listener(pendingCount);
  }
}

const routeProgressStore = {
  decrement() {
    pendingCount = Math.max(0, pendingCount - 1);
    notify();
  },
  getSnapshot() {
    return pendingCount;
  },
  increment() {
    pendingCount += 1;
    notify();
  },
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

/**
 * Invisible — must be rendered as a descendant of `<Link>`. Publishes that
 * link's pending navigation state to the global `<MarbleRouteProgress />`.
 */
export function MarbleRouteProgressBeacon() {
  const { pending } = useLinkStatus();

  useEffect(() => {
    if (!pending) {
      return;
    }
    routeProgressStore.increment();
    return () => {
      routeProgressStore.decrement();
    };
  }, [
    pending,
  ]);

  return null;
}

/**
 * Report a programmatic navigation to the global progress bar. Pass the
 * `isPending` flag from `useTransition()` that wraps your `router.push`.
 */
export function useReportRouteProgress(isPending: boolean) {
  useEffect(() => {
    if (!isPending) {
      return;
    }
    routeProgressStore.increment();
    return () => {
      routeProgressStore.decrement();
    };
  }, [
    isPending,
  ]);
}

/**
 * Ergonomic shape of `useMarbleRouter()`. Mirrors the subset of
 * `next/navigation`'s `AppRouterInstance` we use in product code.
 */
export type MarbleRouter = {
  back: () => void;
  forward: () => void;
  /** True while any `push`/`replace`/`refresh` transition is in flight. */
  isPending: boolean;
  prefetch: (href: string) => void;
  push: (href: string) => void;
  refresh: () => void;
  replace: (href: string) => void;
};

/**
 * Marble's standard programmatic-navigation hook. Drop-in replacement for
 * `useRouter()` from `next/navigation` that wraps `push`/`replace`/`refresh`
 * in `useTransition` and publishes the resulting `isPending` to the global
 * `<MarbleRouteProgress />` bar.
 *
 * Always prefer this over `useRouter()` for in-app navigation. Naked
 * `router.push()` calls will not surface in the top progress bar — that is
 * intentional, and the consistent visual feedback is the whole point.
 */
export function useMarbleRouter(): MarbleRouter {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  useReportRouteProgress(isPending);

  return {
    back: () =>
      startTransition(() => {
        router.back();
      }),
    forward: () =>
      startTransition(() => {
        router.forward();
      }),
    isPending,
    prefetch: (href) => router.prefetch(href),
    push: (href) =>
      startTransition(() => {
        router.push(href);
      }),
    refresh: () =>
      startTransition(() => {
        router.refresh();
      }),
    replace: (href) =>
      startTransition(() => {
        router.replace(href);
      }),
  };
}

const SHOW_DEBOUNCE_MS = 80;
const GROW_DURATION_MS = 2000;
const FINISH_FADE_MS = 280;
const SNAP_FULL_MS = 200;
const GROW_TIMING_FN = "cubic-bezier(0.16, 1, 0.3, 1)";
const FINISH_TIMING_FN = "ease-out";

export type MarbleRouteProgressProps = {
  className?: string;
};

/**
 * Top-fixed indeterminate progress bar, GitHub-style. Mount once near the
 * root of an authenticated shell; listens to every `MarbleRouteProgressBeacon`
 * and every `useReportRouteProgress` subscriber.
 */
export function MarbleRouteProgress({
  className,
}: MarbleRouteProgressProps = {}) {
  const count = useSyncExternalStore(
    routeProgressStore.subscribe,
    routeProgressStore.getSnapshot,
    () => 0,
  );

  const [shown, setShown] = useState(false);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    if (count > 0) {
      setFinishing(false);
      if (shown) {
        return;
      }
      const t = setTimeout(() => setShown(true), SHOW_DEBOUNCE_MS);
      return () => clearTimeout(t);
    }

    if (!shown) {
      return;
    }
    setFinishing(true);
    const t = setTimeout(() => {
      setShown(false);
      setFinishing(false);
    }, FINISH_FADE_MS);
    return () => clearTimeout(t);
  }, [
    count,
    shown,
  ]);

  const isGrowing = shown && !finishing;
  const width = shown ? (finishing ? "100%" : "90%") : "0%";
  const opacity = isGrowing ? 1 : 0;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[1300] h-0.5"
    >
      <div
        className={cx("h-full origin-left bg-orange-500", className)}
        style={{
          opacity,
          transitionDuration: isGrowing
            ? `${GROW_DURATION_MS}ms, ${SNAP_FULL_MS}ms`
            : `${SNAP_FULL_MS}ms, ${FINISH_FADE_MS}ms`,
          transitionProperty: "width, opacity",
          transitionTimingFunction: isGrowing
            ? `${GROW_TIMING_FN}, ${FINISH_TIMING_FN}`
            : `${FINISH_TIMING_FN}, ${FINISH_TIMING_FN}`,
          width,
        }}
      />
    </div>
  );
}
