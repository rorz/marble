import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  COLLAPSED_AGENT_SIDEBAR_WIDTH,
  COLLAPSED_SIDEBAR_WIDTH,
  clampAgentSidebarWidth,
  clampSidebarWidth,
  type SidebarMode,
} from "../../../lib/gui-sidebar";
import { nextSidebarMode, sidebarModes } from "./constants";

type SidebarLayoutParams = {
  initialAgentSidebarMode: SidebarMode;
  initialAgentSidebarWidth: number;
  initialSidebarMode: SidebarMode;
  initialSidebarWidth: number;
};

export const useSidebarLayout = ({
  initialAgentSidebarMode,
  initialAgentSidebarWidth,
  initialSidebarMode,
  initialSidebarWidth,
}: SidebarLayoutParams) => {
  const [agentSidebarMode, setAgentSidebarMode] = useState<SidebarMode>(
    initialAgentSidebarMode,
  );
  const [agentSidebarTab, setAgentSidebarTab] = useState<"changes" | "chat">(
    "chat",
  );
  const [agentSidebarWidth, setAgentSidebarWidth] = useState(
    initialAgentSidebarWidth,
  );
  const [sidebarMode, setSidebarMode] =
    useState<SidebarMode>(initialSidebarMode);
  const [sidebarWidth, setSidebarWidth] = useState(initialSidebarWidth);
  const [isAgentSidebarResizing, setIsAgentSidebarResizing] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const agentResizeHandleRef = useRef<HTMLHRElement | null>(null);
  const agentSidebarWidthRef = useRef(agentSidebarWidth);
  const agentResizeStateRef = useRef<null | {
    pointerId: number;
    startWidth: number;
    startX: number;
  }>(null);
  const resizeHandleRef = useRef<HTMLHRElement | null>(null);
  const sidebarWidthRef = useRef(sidebarWidth);
  const resizeStateRef = useRef<null | {
    pointerId: number;
    startWidth: number;
    startX: number;
  }>(null);
  const sidebar = sidebarModes[sidebarMode];
  const agentSidebarToggleLabel =
    agentSidebarMode === "collapsed"
      ? "Expand agent sidebar"
      : "Collapse agent sidebar";
  const isAnySidebarResizing = isAgentSidebarResizing || isResizing;
  const layoutGridColumns = `${
    sidebarMode === "collapsed" ? COLLAPSED_SIDEBAR_WIDTH : sidebarWidth
  }px minmax(0, 1fr) ${
    agentSidebarMode === "collapsed"
      ? COLLAPSED_AGENT_SIDEBAR_WIDTH
      : agentSidebarWidth
  }px`;

  const toggleSidebar = () => {
    const nextMode = nextSidebarMode[sidebarMode];

    void fetch("/api/gui/sidebar-mode", {
      body: JSON.stringify({
        mode: nextMode,
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    setSidebarMode(nextMode);
  };

  const persistAgentSidebarMode = (nextMode: SidebarMode) => {
    void fetch("/api/gui/sidebar-mode", {
      body: JSON.stringify({
        agentSidebarMode: nextMode,
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  };

  const handleAgentSidebarTabChange = (value: string) => {
    if (value === "chat" || value === "changes") {
      setAgentSidebarTab(value);
    }
  };

  const toggleAgentSidebar = () => {
    const nextMode = nextSidebarMode[agentSidebarMode];

    persistAgentSidebarMode(nextMode);
    setAgentSidebarMode(nextMode);
  };

  const openAgentChat = () => {
    setAgentSidebarTab("chat");

    if (agentSidebarMode !== "collapsed") {
      return;
    }

    persistAgentSidebarMode("expanded");
    setAgentSidebarMode("expanded");
  };

  const persistSidebarWidth = (nextWidth: number) => {
    void fetch("/api/gui/sidebar-mode", {
      body: JSON.stringify({
        width: clampSidebarWidth(nextWidth),
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  };

  const persistAgentSidebarWidth = (nextWidth: number) => {
    void fetch("/api/gui/sidebar-mode", {
      body: JSON.stringify({
        agentSidebarWidth: clampAgentSidebarWidth(nextWidth),
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  };

  const finishResize = () => {
    const resizeState = resizeStateRef.current;

    if (!resizeState) {
      return;
    }

    resizeHandleRef.current?.releasePointerCapture(resizeState.pointerId);
    resizeStateRef.current = null;
    setIsResizing(false);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    persistSidebarWidth(sidebarWidthRef.current);
  };

  const handleResizeStart = (event: ReactPointerEvent<HTMLHRElement>) => {
    if (sidebarMode === "collapsed") {
      return;
    }

    resizeStateRef.current = {
      pointerId: event.pointerId,
      startWidth: sidebarWidth,
      startX: event.clientX,
    };
    setIsResizing(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleResizeMove = (event: ReactPointerEvent<HTMLHRElement>) => {
    const resizeState = resizeStateRef.current;

    if (!resizeState) {
      return;
    }

    const nextWidth = clampSidebarWidth(
      resizeState.startWidth + (event.clientX - resizeState.startX),
    );

    sidebarWidthRef.current = nextWidth;
    setSidebarWidth(nextWidth);
  };

  const handleResizeKeyDown = (event: ReactKeyboardEvent<HTMLHRElement>) => {
    let nextWidth: number | null = null;

    if (event.key === "ArrowLeft") {
      nextWidth = clampSidebarWidth(sidebarWidthRef.current - 16);
    } else if (event.key === "ArrowRight") {
      nextWidth = clampSidebarWidth(sidebarWidthRef.current + 16);
    } else if (event.key === "Home") {
      nextWidth = clampSidebarWidth(0);
    } else if (event.key === "End") {
      nextWidth = clampSidebarWidth(Number.MAX_SAFE_INTEGER);
    }

    if (nextWidth === null) {
      return;
    }

    event.preventDefault();
    sidebarWidthRef.current = nextWidth;
    setSidebarWidth(nextWidth);
    persistSidebarWidth(nextWidth);
  };

  const finishAgentSidebarResize = () => {
    const resizeState = agentResizeStateRef.current;

    if (!resizeState) {
      return;
    }

    agentResizeHandleRef.current?.releasePointerCapture(resizeState.pointerId);
    agentResizeStateRef.current = null;
    setIsAgentSidebarResizing(false);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    persistAgentSidebarWidth(agentSidebarWidthRef.current);
  };

  const handleAgentSidebarResizeStart = (
    event: ReactPointerEvent<HTMLHRElement>,
  ) => {
    if (agentSidebarMode === "collapsed") {
      return;
    }

    agentResizeStateRef.current = {
      pointerId: event.pointerId,
      startWidth: agentSidebarWidth,
      startX: event.clientX,
    };
    setIsAgentSidebarResizing(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleAgentSidebarResizeMove = (
    event: ReactPointerEvent<HTMLHRElement>,
  ) => {
    const resizeState = agentResizeStateRef.current;

    if (!resizeState) {
      return;
    }

    const nextWidth = clampAgentSidebarWidth(
      resizeState.startWidth - (event.clientX - resizeState.startX),
    );

    agentSidebarWidthRef.current = nextWidth;
    setAgentSidebarWidth(nextWidth);
  };

  const handleAgentSidebarResizeKeyDown = (
    event: ReactKeyboardEvent<HTMLHRElement>,
  ) => {
    let nextWidth: number | null = null;

    if (event.key === "ArrowLeft") {
      nextWidth = clampAgentSidebarWidth(agentSidebarWidthRef.current + 16);
    } else if (event.key === "ArrowRight") {
      nextWidth = clampAgentSidebarWidth(agentSidebarWidthRef.current - 16);
    } else if (event.key === "Home") {
      nextWidth = clampAgentSidebarWidth(0);
    } else if (event.key === "End") {
      nextWidth = clampAgentSidebarWidth(Number.MAX_SAFE_INTEGER);
    }

    if (nextWidth === null) {
      return;
    }

    event.preventDefault();
    agentSidebarWidthRef.current = nextWidth;
    setAgentSidebarWidth(nextWidth);
    persistAgentSidebarWidth(nextWidth);
  };

  useEffect(
    () => () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    },
    [],
  );

  useEffect(() => {
    agentSidebarWidthRef.current = agentSidebarWidth;
  }, [
    agentSidebarWidth,
  ]);

  useEffect(() => {
    sidebarWidthRef.current = sidebarWidth;
  }, [
    sidebarWidth,
  ]);

  return {
    agentResizeHandleRef,
    agentSidebarMode,
    agentSidebarTab,
    agentSidebarToggleLabel,
    agentSidebarWidth,
    finishAgentSidebarResize,
    finishResize,
    handleAgentSidebarResizeKeyDown,
    handleAgentSidebarResizeMove,
    handleAgentSidebarResizeStart,
    handleAgentSidebarTabChange,
    handleResizeKeyDown,
    handleResizeMove,
    handleResizeStart,
    isAgentSidebarResizing,
    isAnySidebarResizing,
    isResizing,
    layoutGridColumns,
    openAgentChat,
    resizeHandleRef,
    sidebar,
    sidebarMode,
    sidebarWidth,
    toggleAgentSidebar,
    toggleSidebar,
  };
};
