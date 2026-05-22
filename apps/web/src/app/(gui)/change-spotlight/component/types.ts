import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { SpotlightPreview, SpotlightSession } from "../types";

export type PreviewChangeSpotlight = {
  targetKeys: string[];
};

export type SpotlightRefs = {
  activationTokenRef: MutableRefObject<number>;
  activeElementRef: MutableRefObject<HTMLElement | null>;
  activeTargetKeyRef: MutableRefObject<string | null>;
  dismissTimeoutRef: MutableRefObject<number | null>;
  inspectedTargetKeysRef: MutableRefObject<null | string[]>;
  previewTargetKeysRef: MutableRefObject<string[]>;
  searchFrameRef: MutableRefObject<number | null>;
  targetKeysRef: MutableRefObject<string[]>;
};

export type SpotlightState = {
  clearDismissTimeout: () => void;
  clearPreview: () => void;
  clearSearchFrame: () => void;
  clearSpotlight: () => void;
  dismissSpotlightFromBackdrop: () => void;
  inspectedTargetKeys: null | string[];
  preview: SpotlightPreview | null;
  refs: SpotlightRefs;
  resetActiveSpotlight: () => void;
  session: SpotlightSession | null;
  setInspectedTargetKeys: Dispatch<SetStateAction<null | string[]>>;
  setPreview: Dispatch<SetStateAction<SpotlightPreview | null>>;
  setSession: Dispatch<SetStateAction<SpotlightSession | null>>;
};
