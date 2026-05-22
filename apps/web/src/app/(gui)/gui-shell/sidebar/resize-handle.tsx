import { cx } from "@marble/ui";
import type {
  KeyboardEventHandler,
  PointerEventHandler,
  RefObject,
} from "react";
import {
  MAX_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
} from "../../../../lib/gui-sidebar";

type SidebarResizeHandleProps = {
  isResizing: boolean;
  onResizeCancel: PointerEventHandler<HTMLHRElement>;
  onResizeKeyDown: KeyboardEventHandler<HTMLHRElement>;
  onResizeMove: PointerEventHandler<HTMLHRElement>;
  onResizeStart: PointerEventHandler<HTMLHRElement>;
  onResizeUp: PointerEventHandler<HTMLHRElement>;
  resizeHandleRef: RefObject<HTMLHRElement | null>;
  sidebarWidth: number;
};

export const SidebarResizeHandle = ({
  isResizing,
  onResizeCancel,
  onResizeKeyDown,
  onResizeMove,
  onResizeStart,
  onResizeUp,
  resizeHandleRef,
  sidebarWidth,
}: SidebarResizeHandleProps) => (
  <hr
    aria-controls="gui-navigation-sidebar"
    aria-label="Resize navigation sidebar"
    aria-orientation="vertical"
    aria-valuemax={MAX_SIDEBAR_WIDTH}
    aria-valuemin={MIN_SIDEBAR_WIDTH}
    aria-valuenow={sidebarWidth}
    className={cx(
      "absolute top-0 right-0 z-10 h-full w-3 translate-x-1/2 cursor-col-resize touch-none border-0 bg-linear-to-r from-transparent via-transparent to-transparent transition-colors",
      isResizing
        ? "via-taupe-400"
        : "hover:via-taupe-300 focus-visible:via-taupe-300",
    )}
    onKeyDown={onResizeKeyDown}
    onPointerCancel={onResizeCancel}
    onPointerDown={onResizeStart}
    onPointerMove={onResizeMove}
    onPointerUp={onResizeUp}
    ref={resizeHandleRef}
    tabIndex={0}
    title="Resize navigation sidebar"
  />
);
