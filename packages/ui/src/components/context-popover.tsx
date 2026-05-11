"use client";

import {
  type ButtonHTMLAttributes,
  cloneElement,
  isValidElement,
  type ReactElement,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { cx } from "../utils/cx";

type MarbleContextPopoverItem = {
  description?: ReactNode;
  detail?: ReactNode;
  disabled?: boolean;
  id?: string;
  icon?: ReactNode;
  label: string;
  onBlur?: () => void;
  onFocus?: () => void;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
  onSelect: () => void;
  tone?: "default" | "danger";
};

type MarbleContextPopoverSection = {
  id?: string;
  items: MarbleContextPopoverItem[];
  label?: string;
};

export type MarbleContextPopoverProps = {
  align?: "end" | "start";
  ariaLabel?: string;
  asChild?: boolean;
  children?: ReactNode;
  className?: string;
  disabled?: boolean;
  header?: ReactNode;
  items?: MarbleContextPopoverItem[];
  menuClassName?: string;
  onOpenChange?: (isOpen: boolean) => void;
  sections?: MarbleContextPopoverSection[];
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
  asChild = false,
  children,
  className,
  disabled = false,
  header,
  items = [],
  menuClassName,
  onOpenChange,
  sections,
  onKeyDown,
  triggerClassName,
  ...props
}: MarbleContextPopoverProps) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLElement | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<null | {
    left: number;
    top: number;
  }>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const hasCustomTrigger = children !== undefined && children !== null;

  useEffect(() => {
    setPortalTarget(document.body);
  }, []);
  const menuSections = useMemo(() => {
    if (sections) {
      return sections.filter((section) => section.items.length > 0);
    }

    return items.length > 0
      ? [
          {
            items,
          },
        ]
      : [];
  }, [
    items,
    sections,
  ]);
  const flattenedItems = useMemo(
    () => menuSections.flatMap((section) => section.items),
    [
      menuSections,
    ],
  );
  const enabledItemIndexes = getEnabledItemIndexes(flattenedItems);
  const isTriggerDisabled = disabled || flattenedItems.length === 0;

  const getItemKey = (item: MarbleContextPopoverItem) =>
    item.id ??
    [
      item.label,
      item.description,
    ]
      .filter(Boolean)
      .join(":");

  const getSectionKey = (section: MarbleContextPopoverSection) =>
    section.id ??
    [
      section.label,
      ...section.items.map(getItemKey),
    ].join("|");

  const containsTarget = useCallback((target: Node) => {
    return (
      rootRef.current?.contains(target) || menuRef.current?.contains(target)
    );
  }, []);

  const focusItem = (index: number) => {
    itemRefs.current[index]?.focus();
  };

  const dismissMenu = useCallback(() => {
    setIsOpen(false);
    setMenuPosition(null);
  }, []);

  const closeMenu = useCallback(() => {
    dismissMenu();
    buttonRef.current?.focus();
  }, [
    dismissMenu,
  ]);

  const openMenu = (targetIndex = 0) => {
    if (isTriggerDisabled) {
      return;
    }

    setIsOpen(true);
    queueMicrotask(() => {
      const itemIndex = enabledItemIndexes[targetIndex];

      if (typeof itemIndex === "number") {
        focusItem(itemIndex);
        return;
      }

      menuRef.current?.focus();
    });
  };

  useEffect(() => {
    onOpenChange?.(isOpen);
  }, [
    isOpen,
    onOpenChange,
  ]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (!containsTarget(target)) {
        dismissMenu();
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

      if (!containsTarget(target)) {
        dismissMenu();
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
    containsTarget,
    dismissMenu,
    isOpen,
  ]);

  useLayoutEffect(() => {
    if (!isOpen) {
      return;
    }

    const updateMenuPosition = () => {
      const button = buttonRef.current;
      const menu = menuRef.current;

      if (!button || !menu) {
        return;
      }

      const buttonRect = button.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      const gap = 8;
      const viewportPadding = 8;
      const maxLeft = Math.max(
        viewportPadding,
        window.innerWidth - viewportPadding - menuRect.width,
      );
      let top = buttonRect.bottom + gap;

      if (top + menuRect.height > window.innerHeight - viewportPadding) {
        top = Math.max(viewportPadding, buttonRect.top - gap - menuRect.height);
      }

      let left =
        align === "end" ? buttonRect.right - menuRect.width : buttonRect.left;

      left = Math.min(Math.max(left, viewportPadding), maxLeft);

      setMenuPosition((current) =>
        current && current.left === left && current.top === top
          ? current
          : {
              left,
              top,
            },
      );
    };

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [
    align,
    isOpen,
  ]);

  const handleTriggerKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    buttonRef.current = event.currentTarget;
    onKeyDown?.(event as unknown as ReactKeyboardEvent<HTMLButtonElement>);

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

  const handleTriggerClick = (event: ReactMouseEvent<HTMLElement>) => {
    buttonRef.current = event.currentTarget;
    setIsOpen((current) => !current);
  };

  const renderTrigger = () => {
    if (asChild && isValidElement(children)) {
      const child = children as ReactElement<{
        "aria-controls"?: string;
        "aria-expanded"?: boolean;
        "aria-haspopup"?: "menu";
        "aria-label"?: string;
        className?: string;
        disabled?: boolean;
        onClick?: (event: ReactMouseEvent<HTMLElement>) => void;
        onKeyDown?: (event: ReactKeyboardEvent<HTMLElement>) => void;
      }>;
      const disabledTriggerProps =
        typeof child.type === "string"
          ? child.type === "button"
            ? {
                disabled: isTriggerDisabled,
              }
            : {
                "aria-disabled": isTriggerDisabled || undefined,
              }
          : {
              disabled: isTriggerDisabled,
            };

      return cloneElement(child, {
        ...disabledTriggerProps,
        ...props,
        "aria-controls": menuId,
        "aria-expanded": isOpen,
        "aria-haspopup": "menu",
        "aria-label": ariaLabel,
        className: cx(
          "inline-flex min-w-0 items-center justify-center rounded-[6px] transition-colors",
          triggerClassName,
          child.props.className,
        ),
        onClick: (event: ReactMouseEvent<HTMLElement>) => {
          child.props.onClick?.(event);

          if (!event.defaultPrevented && !isTriggerDisabled) {
            handleTriggerClick(event);
          }
        },
        onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => {
          child.props.onKeyDown?.(event);

          if (!event.defaultPrevented) {
            handleTriggerKeyDown(event);
          }
        },
      });
    }

    return (
      <button
        aria-controls={menuId}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={ariaLabel}
        className={cx(
          hasCustomTrigger
            ? "inline-flex min-w-0 items-center justify-center rounded-[6px] transition-colors"
            : "inline-flex size-7 items-center justify-center rounded-[4px] text-zinc-400 transition-colors",
          hasCustomTrigger
            ? "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:cursor-not-allowed disabled:opacity-50"
            : "hover:bg-zinc-100 hover:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:cursor-not-allowed disabled:opacity-50",
          triggerClassName,
        )}
        disabled={isTriggerDisabled}
        onClick={handleTriggerClick}
        onKeyDown={handleTriggerKeyDown}
        ref={(element) => {
          buttonRef.current = element;
        }}
        type="button"
        {...props}
      >
        {hasCustomTrigger ? (
          children
        ) : (
          <span
            aria-hidden="true"
            className="flex flex-col gap-px"
          >
            <span className="size-[3px] rounded-full bg-current" />
            <span className="size-[3px] rounded-full bg-current" />
            <span className="size-[3px] rounded-full bg-current" />
          </span>
        )}
      </button>
    );
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

  const menuNode =
    isOpen && portalTarget
      ? createPortal(
          <div
            className={cx(
              "fixed z-[1000] min-w-36 rounded-xs border border-zinc-200 bg-white p-1 shadow-lg shadow-zinc-950/10",
              menuClassName,
            )}
            id={menuId}
            ref={menuRef}
            role="menu"
            style={{
              left: menuPosition?.left ?? 0,
              top: menuPosition?.top ?? 0,
              visibility: menuPosition ? "visible" : "hidden",
            }}
            tabIndex={-1}
          >
            {header ? <div className="px-1 pb-1">{header}</div> : null}
            {menuSections.map((section, sectionIndex) => {
              const indexOffset = menuSections
                .slice(0, sectionIndex)
                .reduce(
                  (total, currentSection) =>
                    total + currentSection.items.length,
                  0,
                );

              return (
                <div
                  className={cx(
                    sectionIndex === 0 && !header
                      ? null
                      : "mt-1 border-zinc-200 border-t pt-1",
                  )}
                  key={getSectionKey(section)}
                >
                  {section.label ? (
                    <div className="px-3 pb-1 font-medium text-[10px] text-zinc-400 uppercase tracking-[0.2em]">
                      {section.label}
                    </div>
                  ) : null}
                  {section.items.map((item, itemIndex) => {
                    const index = indexOffset + itemIndex;

                    return (
                      <button
                        className={cx(
                          "flex w-full items-start gap-3 rounded-[6px] px-3 py-2 text-left transition-colors",
                          item.disabled
                            ? "cursor-not-allowed text-zinc-400"
                            : "cursor-pointer text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 focus-visible:bg-zinc-100 focus-visible:text-zinc-950 focus-visible:outline-none",
                          item.tone === "danger" && !item.disabled
                            ? "text-red-600 hover:bg-red-50 hover:text-red-700 focus-visible:bg-red-50 focus-visible:text-red-700"
                            : null,
                        )}
                        disabled={item.disabled}
                        key={getItemKey(item)}
                        onBlur={() => item.onBlur?.()}
                        onClick={() => {
                          item.onBlur?.();
                          item.onPointerLeave?.();
                          dismissMenu();
                          item.onSelect();
                        }}
                        onFocus={() => item.onFocus?.()}
                        onKeyDown={handleItemKeyDown(index)}
                        onPointerEnter={() => item.onPointerEnter?.()}
                        onPointerLeave={() => item.onPointerLeave?.()}
                        ref={(element) => {
                          itemRefs.current[index] = element;
                        }}
                        role="menuitem"
                        type="button"
                      >
                        {item.icon ? (
                          <span className="flex size-4 shrink-0 translate-y-0.5 items-center justify-center">
                            {item.icon}
                          </span>
                        ) : null}
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate font-medium text-sm">
                            {item.label}
                          </span>
                          {item.description ? (
                            <div className="mt-0.5 text-xs text-zinc-500">
                              {item.description}
                            </div>
                          ) : null}
                        </span>
                        {item.detail ? (
                          <span className="flex shrink-0 items-center justify-center self-center text-xs text-zinc-400">
                            {item.detail}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>,
          portalTarget,
        )
      : null;

  return (
    <div
      className={cx("relative inline-flex", className)}
      ref={rootRef}
    >
      {renderTrigger()}
      {menuNode}
    </div>
  );
}

export type { MarbleContextPopoverItem, MarbleContextPopoverSection };
