import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { rightPanelDefaultHeights } from "./constants";
import type { ResizablePanelId, RightWorkbenchPanelId } from "./types";
import { workbenchPanelHeightLimits } from "./types";
import { clampWorkbenchPanelHeight } from "./workbench";

export const usePanelResize = () => {
  const [draftStackCollapsed, setDraftStackCollapsed] = useState(false);
  const [draftStackHeight, setDraftStackHeight] = useState(196);
  const [versionsCollapsed, setVersionsCollapsed] = useState(false);
  const [versionsHeight, setVersionsHeight] = useState(224);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState<
    Record<RightWorkbenchPanelId, boolean>
  >({
    secrets: false,
    testInputs: false,
  });
  const [rightPanelHeights, setRightPanelHeights] = useState(
    rightPanelDefaultHeights,
  );
  const [activeResizePanel, setActiveResizePanel] =
    useState<null | ResizablePanelId>(null);
  const resizeStateRef = useRef<null | {
    direction: -1 | 1;
    panelId: ResizablePanelId;
    pointerId: number;
    startHeight: number;
    startY: number;
  }>(null);

  useEffect(() => {
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, []);

  const getPanelHeight = (panelId: ResizablePanelId) =>
    panelId === "draftStack"
      ? draftStackHeight
      : panelId === "versions"
        ? versionsHeight
        : rightPanelHeights[panelId];

  const setPanelHeight = (panelId: ResizablePanelId, nextHeight: number) => {
    if (panelId === "draftStack") {
      setDraftStackHeight(nextHeight);
      return;
    }

    if (panelId === "versions") {
      setVersionsHeight(nextHeight);
      return;
    }

    setRightPanelHeights((current) => ({
      ...current,
      [panelId]: nextHeight,
    }));
  };

  const finishPanelResize = (event?: ReactPointerEvent<HTMLButtonElement>) => {
    const currentTarget = event?.currentTarget;
    const resizeState = resizeStateRef.current;

    if (!resizeState) {
      return;
    }

    if (currentTarget?.hasPointerCapture(resizeState.pointerId)) {
      currentTarget.releasePointerCapture(resizeState.pointerId);
    }

    resizeStateRef.current = null;
    setActiveResizePanel(null);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  };

  const handlePanelResizeStart =
    (panelId: ResizablePanelId, direction: -1 | 1) =>
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      resizeStateRef.current = {
        direction,
        panelId,
        pointerId: event.pointerId,
        startHeight: getPanelHeight(panelId),
        startY: event.clientY,
      };
      setActiveResizePanel(panelId);
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
      event.currentTarget.setPointerCapture(event.pointerId);
    };

  const handlePanelResizeMove = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    const resizeState = resizeStateRef.current;

    if (!resizeState || resizeState.pointerId !== event.pointerId) {
      return;
    }

    const nextHeight = clampWorkbenchPanelHeight(
      resizeState.panelId,
      resizeState.startHeight +
        (event.clientY - resizeState.startY) * resizeState.direction,
    );

    setPanelHeight(resizeState.panelId, nextHeight);
  };

  const handlePanelResizeKeyDown =
    (panelId: ResizablePanelId) =>
    (event: ReactKeyboardEvent<HTMLButtonElement>) => {
      let nextHeight: number | null = null;

      if (event.key === "ArrowUp") {
        nextHeight = getPanelHeight(panelId) + 16;
      } else if (event.key === "ArrowDown") {
        nextHeight = getPanelHeight(panelId) - 16;
      } else if (event.key === "Home") {
        nextHeight = workbenchPanelHeightLimits[panelId].min;
      } else if (event.key === "End") {
        nextHeight = workbenchPanelHeightLimits[panelId].max;
      }

      if (nextHeight === null) {
        return;
      }

      event.preventDefault();
      setPanelHeight(panelId, clampWorkbenchPanelHeight(panelId, nextHeight));
    };

  return {
    activeResizePanel,
    draftStackCollapsed,
    draftStackHeight,
    finishPanelResize,
    handlePanelResizeKeyDown,
    handlePanelResizeMove,
    handlePanelResizeStart,
    rightPanelCollapsed,
    rightPanelHeights,
    setDraftStackCollapsed,
    setRightPanelCollapsed,
    setVersionsCollapsed,
    versionsCollapsed,
    versionsHeight,
  };
};
