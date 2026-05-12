"use client";

import type {
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
  RefObject,
} from "react";
import { createPortal } from "react-dom";
import { cx } from "../../utils/cx";
import type { MarbleContextPopoverItem, MarbleContextPopoverSection } from ".";

type ContextPopoverMenuProps = {
  closeMenu: () => void;
  contentClassName?: string;
  dismissMenu: () => void;
  enabledItemIndexes: number[];
  focusItem: (index: number) => void;
  header?: ReactNode;
  itemRefs: RefObject<Array<HTMLButtonElement | null>>;
  menuClassName?: string;
  menuId: string;
  menuPosition: {
    left: number;
    top: number;
  } | null;
  menuRef: RefObject<HTMLDivElement | null>;
  menuSections: MarbleContextPopoverSection[];
  portalTarget: HTMLElement;
};

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

export function ContextPopoverMenu({
  closeMenu,
  dismissMenu,
  enabledItemIndexes,
  focusItem,
  header,
  itemRefs,
  menuClassName,
  menuId,
  menuPosition,
  menuRef,
  menuSections,
  portalTarget,
}: ContextPopoverMenuProps) {
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

  return createPortal(
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
            (total, currentSection) => total + currentSection.items.length,
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
              <div className="px-3 pb-1 font-medium text-eyebrow-xs text-zinc-400">
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
  );
}
