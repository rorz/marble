"use client";

import {
  type ButtonHTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { cx } from "../utils/cx";

type MarbleContextPopoverItem = {
  disabled?: boolean;
  label: string;
  onSelect: () => void;
  tone?: "default" | "danger";
};

export type MarbleContextPopoverProps = {
  align?: "end" | "start";
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  items: MarbleContextPopoverItem[];
  menuClassName?: string;
  triggerClassName?: string;
} & Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-label" | "children" | "disabled" | "type"
>;

function getEnabledItemIndexes(items: MarbleContextPopoverItem[]) {
  return items.flatMap((item, index) => (item.disabled ? [] : index));
}

export function MarbleContextPopover({
  align = "end",
  ariaLabel = "Open menu",
  className,
  disabled = false,
  items,
  menuClassName,
  onKeyDown,
  triggerClassName,
  ...props
}: MarbleContextPopoverProps) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [isOpen, setIsOpen] = useState(false);
  const enabledItemIndexes = getEnabledItemIndexes(items);
  const isTriggerDisabled = disabled || enabledItemIndexes.length === 0;

  const focusItem = (index: number) => {
    itemRefs.current[index]?.focus();
  };

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    buttonRef.current?.focus();
  }, []);

  const openMenu = (targetIndex = 0) => {
    if (isTriggerDisabled) {
      return;
    }

    setIsOpen(true);
    queueMicrotask(() => {
      const itemIndex = enabledItemIndexes[targetIndex];

      if (typeof itemIndex === "number") {
        focusItem(itemIndex);
      }
    });
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (!rootRef.current?.contains(target)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    };

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (!rootRef.current?.contains(target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    document.addEventListener("focusin", handleFocusIn);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("focusin", handleFocusIn);
    };
  }, [
    closeMenu,
    isOpen,
  ]);

  const handleTriggerKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
  ) => {
    onKeyDown?.(event);

    if (event.defaultPrevented || isTriggerDisabled) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      openMenu(0);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      openMenu(enabledItemIndexes.length - 1);
    }
  };

  const handleItemKeyDown =
    (itemIndex: number) => (event: ReactKeyboardEvent<HTMLButtonElement>) => {
      const currentEnabledIndex = enabledItemIndexes.indexOf(itemIndex);

      if (event.key === "ArrowDown") {
        event.preventDefault();
        const nextEnabledIndex =
          (currentEnabledIndex + 1) % enabledItemIndexes.length;
        focusItem(enabledItemIndexes[nextEnabledIndex] ?? itemIndex);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        const previousEnabledIndex =
          (currentEnabledIndex - 1 + enabledItemIndexes.length) %
          enabledItemIndexes.length;
        focusItem(enabledItemIndexes[previousEnabledIndex] ?? itemIndex);
        return;
      }

      if (event.key === "Home") {
        event.preventDefault();
        focusItem(enabledItemIndexes[0] ?? itemIndex);
        return;
      }

      if (event.key === "End") {
        event.preventDefault();
        focusItem(
          enabledItemIndexes[enabledItemIndexes.length - 1] ?? itemIndex,
        );
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
      }
    };

  return (
    <div
      className={cx("relative inline-flex", className)}
      ref={rootRef}
    >
      <button
        aria-controls={menuId}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={ariaLabel}
        className={cx(
          "inline-flex size-7 items-center justify-center rounded-[4px] text-zinc-400 transition-colors",
          "hover:bg-zinc-100 hover:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:cursor-not-allowed disabled:opacity-50",
          triggerClassName,
        )}
        disabled={isTriggerDisabled}
        onClick={() => {
          setIsOpen((current) => !current);
        }}
        onKeyDown={handleTriggerKeyDown}
        ref={buttonRef}
        type="button"
        {...props}
      >
        <span
          aria-hidden="true"
          className="flex flex-col gap-px"
        >
          <span className="size-[3px] rounded-full bg-current" />
          <span className="size-[3px] rounded-full bg-current" />
          <span className="size-[3px] rounded-full bg-current" />
        </span>
      </button>

      {isOpen ? (
        <div
          className={cx(
            "absolute top-full z-50 mt-2 min-w-36 rounded-xs border border-zinc-200 bg-white p-1 shadow-lg shadow-zinc-950/10",
            align === "end" ? "right-0" : "left-0",
            menuClassName,
          )}
          id={menuId}
          role="menu"
        >
          {items.map((item, index) => (
            <button
              className={cx(
                "flex w-full items-center rounded-[3px] px-3 py-2 text-left font-medium text-sm transition-colors",
                item.disabled
                  ? "cursor-not-allowed text-zinc-400"
                  : "cursor-pointer text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 focus-visible:bg-zinc-100 focus-visible:text-zinc-950 focus-visible:outline-none",
                item.tone === "danger" && !item.disabled
                  ? "text-red-600 hover:bg-red-50 hover:text-red-700 focus-visible:bg-red-50 focus-visible:text-red-700"
                  : null,
              )}
              disabled={item.disabled}
              key={item.label}
              onClick={() => {
                setIsOpen(false);
                item.onSelect();
              }}
              onKeyDown={handleItemKeyDown(index)}
              ref={(element) => {
                itemRefs.current[index] = element;
              }}
              role="menuitem"
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export type { MarbleContextPopoverItem };
