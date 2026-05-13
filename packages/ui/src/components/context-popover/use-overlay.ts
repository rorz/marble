"use client";

import {
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

type MenuPosition = {
  left: number;
  top: number;
};

type PopoverOverlay = {
  buttonRef: RefObject<HTMLElement | null>;
  closeMenu: () => void;
  dismissMenu: () => void;
  focusItem: (index: number) => void;
  isOpen: boolean;
  itemRefs: RefObject<Array<HTMLButtonElement | null>>;
  menuId: string;
  menuPosition: MenuPosition | null;
  menuRef: RefObject<HTMLDivElement | null>;
  openMenu: (focusIndex: number | undefined) => void;
  portalTarget: HTMLElement | null;
  rootRef: RefObject<HTMLDivElement | null>;
  setIsOpen: (next: boolean | ((current: boolean) => boolean)) => void;
};

export const usePopoverOverlay = ({
  align,
  onOpenChange,
}: {
  align: "end" | "start";
  onOpenChange?: (isOpen: boolean) => void;
}): PopoverOverlay => {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLElement | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [isOpen, setIsOpen] = useState(false); // harness-ignore: no-handrolled-anchor-dropdown -- this IS the popover overlay primitive
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalTarget(document.body);
  }, []);

  const containsTarget = useCallback((target: Node) => {
    return (
      rootRef.current?.contains(target) || menuRef.current?.contains(target)
    );
  }, []);

  const focusItem = useCallback((index: number) => {
    itemRefs.current[index]?.focus();
  }, []);

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

  const openMenu = useCallback((focusIndex: number | undefined) => {
    setIsOpen(true);
    queueMicrotask(() => {
      if (typeof focusIndex === "number") {
        const target = itemRefs.current[focusIndex];

        if (target) {
          target.focus();
          return;
        }
      }

      menuRef.current?.focus();
    });
  }, []);

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

  return {
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
  };
};
