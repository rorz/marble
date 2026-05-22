"use client";

import { useMarbleRouter } from "@marble/ui";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { useSpotlightEffects } from "./effects";
import { useSpotlightMeasurement } from "./measurement";
import { useSpotlightNavigation } from "./navigation";
import { SpotlightOverlay } from "./overlay";
import { useSpotlightState } from "./state";

export const ChangeSpotlight = () => {
  const router = useMarbleRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const state = useSpotlightState();
  const routeKey = useMemo(
    () => `${pathname}?${searchParams.toString()}`,
    [
      pathname,
      searchParams,
    ],
  );
  const measurement = useSpotlightMeasurement(state);
  const navigation = useSpotlightNavigation({
    ...state,
    ...measurement,
    pathname,
    router,
  });

  useSpotlightEffects({
    ...measurement,
    activateSpotlight: navigation.activateSpotlight,
    clearPreview: state.clearPreview,
    clearSpotlight: state.clearSpotlight,
    preview: state.preview,
    refs: state.refs,
    routeKey,
    sessionGroupsLength: state.session?.groups.length ?? 0,
    stepReview: navigation.stepReview,
  });

  return (
    <SpotlightOverlay
      inspectedTargetKeys={state.inspectedTargetKeys}
      onBackdropPointerDown={state.dismissSpotlightFromBackdrop}
      onClearSpotlight={state.clearSpotlight}
      onInspectTargets={measurement.setSessionInspectionTargetKeys}
      onJumpToReviewIndex={navigation.jumpToReviewIndex}
      onStepReview={navigation.stepReview}
      preview={state.preview}
      session={state.session}
    />
  );
};
