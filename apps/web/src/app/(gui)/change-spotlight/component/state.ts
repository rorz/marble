import { useCallback, useRef, useState } from "react";
import { persistPendingChangeSpotlight } from "../storage";
import type { SpotlightPreview, SpotlightSession } from "../types";
import type { SpotlightState } from "./types";

export const useSpotlightState = (): SpotlightState => {
  const [inspectedTargetKeys, setInspectedTargetKeys] = useState<
    null | string[]
  >(null);
  const [preview, setPreview] = useState<SpotlightPreview | null>(null);
  const [session, setSession] = useState<SpotlightSession | null>(null);
  const activationTokenRef = useRef(0);
  const dismissTimeoutRef = useRef<number | null>(null);
  const searchFrameRef = useRef<number | null>(null);
  const activeElementRef = useRef<HTMLElement | null>(null);
  const activeTargetKeyRef = useRef<string | null>(null);
  const inspectedTargetKeysRef = useRef<null | string[]>(null);
  const previewTargetKeysRef = useRef<string[]>([]);
  const targetKeysRef = useRef<string[]>([]);

  const clearDismissTimeout = useCallback(() => {
    if (dismissTimeoutRef.current !== null) {
      window.clearTimeout(dismissTimeoutRef.current);
      dismissTimeoutRef.current = null;
    }
  }, []);

  const clearSearchFrame = useCallback(() => {
    if (searchFrameRef.current !== null) {
      window.cancelAnimationFrame(searchFrameRef.current);
      searchFrameRef.current = null;
    }
  }, []);

  const resetActiveSpotlight = useCallback(() => {
    activationTokenRef.current += 1;
    clearDismissTimeout();
    clearSearchFrame();
    activeElementRef.current = null;
    activeTargetKeyRef.current = null;
    inspectedTargetKeysRef.current = null;
    targetKeysRef.current = [];
    setInspectedTargetKeys(null);
    setSession(null);
  }, [
    clearDismissTimeout,
    clearSearchFrame,
  ]);

  const clearSpotlight = useCallback(() => {
    persistPendingChangeSpotlight(null);
    resetActiveSpotlight();
  }, [
    resetActiveSpotlight,
  ]);

  const clearPreview = useCallback(() => {
    previewTargetKeysRef.current = [];
    setPreview(null);
  }, []);

  const dismissSpotlightFromBackdrop = useCallback(() => {
    clearSpotlight();
  }, [
    clearSpotlight,
  ]);

  return {
    clearDismissTimeout,
    clearPreview,
    clearSearchFrame,
    clearSpotlight,
    dismissSpotlightFromBackdrop,
    inspectedTargetKeys,
    preview,
    refs: {
      activationTokenRef,
      activeElementRef,
      activeTargetKeyRef,
      dismissTimeoutRef,
      inspectedTargetKeysRef,
      previewTargetKeysRef,
      searchFrameRef,
      targetKeysRef,
    },
    resetActiveSpotlight,
    session,
    setInspectedTargetKeys,
    setPreview,
    setSession,
  };
};
