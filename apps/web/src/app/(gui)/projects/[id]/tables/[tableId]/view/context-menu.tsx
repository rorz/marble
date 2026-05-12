"use client";

import { cx } from "@marble/ui";
import { useEffect } from "react";

import type { ContextMenuState } from "./types";

export function ContextMenu({
  state,
  onClose,
}: {
  state: NonNullable<ContextMenuState>;
  onClose: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    onClose,
  ]);

  return (
    <>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop dismiss pattern */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: backdrop dismiss pattern */}
      <div
        className="fixed inset-0 z-[60]"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div
        className="fixed z-[61] min-w-36 rounded-xs border border-zinc-200 bg-white p-1 shadow-lg shadow-zinc-950/10"
        role="menu"
        style={{
          left: state.x,
          top: state.y,
        }}
      >
        {state.items.map((item) => (
          <button
            className={cx(
              "flex w-full items-center gap-3 rounded-[6px] px-3 py-2 text-left text-sm transition-colors",
              item.danger
                ? "text-red-600 hover:bg-red-50 hover:text-red-700"
                : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950",
            )}
            key={item.label}
            onClick={() => {
              item.onClick();
              onClose();
            }}
            role="menuitem"
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>
    </>
  );
}

// ── Cell Inspector Modal ────────────────────────────────
