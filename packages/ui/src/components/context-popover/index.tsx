"use client";

import {
  type ButtonHTMLAttributes,
  cloneElement,
  isValidElement,
  type ReactElement,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useMemo,
} from "react";
import { createPortal } from "react-dom";
import { cx } from "../../utils/cx";
import { ContextPopoverMenu } from "./menu";
import { usePopoverOverlay } from "./use-overlay";

export type MarbleContextPopoverItem = {
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

export type MarbleContextPopoverSection = {
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
  /**
   * Free-form content to render inside the popover body in place of
   * `items` / `sections`. Use this for forms or other arbitrary
   * controls that don't fit the menu-item shape. When `content` is
   * provided, `items` / `sections` are ignored and keyboard
   * arrow-navigation between items is disabled (the consuming content
   * owns its own focus order).
   */
  content?: ReactNode;
  contentClassName?: string;
  disabled?: boolean;
  header?: ReactNode;
  items?: MarbleContextPopoverItem[];
  menuClassName?: string;
  onOpenChange?: (isOpen: boolean) => void;
  sections?: MarbleContextPopoverSection[];
  triggerClassName?: string;
} & Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-label" | "children" | "content" | "disabled" | "type"
>;

const getEnabledItemIndexes = (items: MarbleContextPopoverItem[]) => {
  return items.flatMap((item, index) => (item.disabled ? [] : index));
};

export const MarbleContextPopover = ({
  align = "end",
  ariaLabel = "Open menu",
  asChild = false,
  children,
  className,
  content,
  contentClassName,
  disabled = false,
  header,
  items = [],
  menuClassName,
  onOpenChange,
  sections,
  onKeyDown,
  triggerClassName,
  ...props
}: MarbleContextPopoverProps) => {
  // harness-ignore: no-handrolled-anchor-dropdown -- this IS the primitive
  const {
    buttonRef,
    closeMenu,
    dismissMenu,
    focusItem,
    isOpen,
    itemRefs,
    menuId,
    menuPosition,
    menuRef,
    openMenu,
    portalTarget,
    rootRef,
    setIsOpen,
  } = usePopoverOverlay({
    align,
    onOpenChange,
  });
  const hasCustomTrigger = children !== undefined && children !== null;

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
  // When `content` is provided the trigger is always enabled (the free-form
  // body decides what's inside). Otherwise the menu variant disables the
  // trigger when there are no items.
  const isTriggerDisabled =
    disabled || (content === undefined && flattenedItems.length === 0);

  const handleTriggerKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    buttonRef.current = event.currentTarget;
    onKeyDown?.(event as ReactKeyboardEvent<HTMLButtonElement>);

    if (event.defaultPrevented || isTriggerDisabled) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      openMenu(enabledItemIndexes[0]);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      openMenu(enabledItemIndexes[enabledItemIndexes.length - 1]);
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

  // Free-form content takes precedence over items/sections. The popover
  // chrome (positioning, click-outside, escape) still applies, but the
  // host owns the body markup and focus order.
  const contentNode =
    isOpen && portalTarget && content !== undefined
      ? createPortal(
          <div
            className={cx(
              "fixed z-[1000] min-w-36 rounded-xs border border-zinc-200 bg-white shadow-lg shadow-zinc-950/10",
              menuClassName,
            )}
            id={menuId}
            ref={menuRef}
            role="dialog"
            style={{
              left: menuPosition?.left ?? 0,
              top: menuPosition?.top ?? 0,
              visibility: menuPosition ? "visible" : "hidden",
            }}
            tabIndex={-1}
          >
            {header ? <div className="px-3 pt-3">{header}</div> : null}
            <div className={cx("p-3", contentClassName)}>{content}</div>
          </div>,
          portalTarget,
        )
      : null;

  const menuNode =
    isOpen && portalTarget && content === undefined ? (
      <ContextPopoverMenu
        closeMenu={closeMenu}
        contentClassName={contentClassName}
        dismissMenu={dismissMenu}
        enabledItemIndexes={enabledItemIndexes}
        focusItem={focusItem}
        header={header}
        itemRefs={itemRefs}
        menuClassName={menuClassName}
        menuId={menuId}
        menuPosition={menuPosition}
        menuRef={menuRef}
        menuSections={menuSections}
        portalTarget={portalTarget}
      />
    ) : null;

  return (
    <div
      className={cx("relative inline-flex", className)}
      ref={rootRef}
    >
      {renderTrigger()}
      {menuNode}
      {contentNode}
    </div>
  );
};
