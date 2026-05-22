"use client";

import {
  type ButtonHTMLAttributes,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { cx } from "../../utils/cx";
import {
  getTabContentId,
  getTabTriggerId,
  MarbleTabsContext,
  type MarbleTabsVariant,
  measureIndicator,
  normalizeTabIdPart,
  useMarbleTabsContext,
} from "./context";

export type MarbleTabsProps = HTMLAttributes<HTMLDivElement> & {
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  value?: string;
  /** `default` is the chunky bordered control surface; `quiet` is borderless with a hairline underline for embedded surfaces. */
  variant?: MarbleTabsVariant;
};

export const MarbleTabs = ({
  children,
  className,
  defaultValue,
  id,
  onValueChange,
  value,
  variant = "default",
  ...props
}: MarbleTabsProps) => {
  const generatedId = useId();
  const rootId = normalizeTabIdPart(id ?? generatedId);
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const [previewValue, setPreviewValue] = useState<null | string>(null);
  const triggerNodesRef = useRef(new Map<string, HTMLButtonElement>());
  const resolvedValue = value ?? uncontrolledValue;

  const registerTrigger = useCallback(
    (triggerValue: string, node: HTMLButtonElement | null) => {
      if (node) {
        triggerNodesRef.current.set(triggerValue, node);
        return;
      }

      triggerNodesRef.current.delete(triggerValue);
    },
    [],
  );

  const getTriggerNode = useCallback((triggerValue: string) => {
    return triggerNodesRef.current.get(triggerValue) ?? null;
  }, []);

  const handleValueChange = useCallback(
    (nextValue: string) => {
      if (nextValue === resolvedValue) {
        return;
      }

      if (value === undefined) {
        setUncontrolledValue(nextValue);
      }

      onValueChange?.(nextValue);
    },
    [
      onValueChange,
      resolvedValue,
      value,
    ],
  );

  const contextValue = useMemo(
    () => ({
      getTriggerNode,
      onValueChange: handleValueChange,
      previewValue,
      registerTrigger,
      rootId,
      setPreviewValue,
      value: resolvedValue,
      variant,
    }),
    [
      getTriggerNode,
      handleValueChange,
      previewValue,
      registerTrigger,
      resolvedValue,
      rootId,
      variant,
    ],
  );

  return (
    <MarbleTabsContext.Provider value={contextValue}>
      <div
        className={cx("flex flex-col gap-4", className)}
        id={id}
        {...props}
      >
        {children}
      </div>
    </MarbleTabsContext.Provider>
  );
};

export type MarbleTabsListProps = HTMLAttributes<HTMLDivElement>;

export const MarbleTabsList = ({
  children,
  className,
  ...props
}: MarbleTabsListProps) => {
  const { getTriggerNode, previewValue, setPreviewValue, value, variant } =
    useMarbleTabsContext();
  const listRef = useRef<HTMLDivElement | null>(null);
  const indicatorValue = previewValue ?? value;
  const [indicatorStyle, setIndicatorStyle] = useState<CSSProperties>({
    opacity: 0,
  });

  useEffect(() => {
    const updateIndicator = () => {
      const list = listRef.current;
      const trigger = indicatorValue ? getTriggerNode(indicatorValue) : null;

      setIndicatorStyle(
        list && trigger
          ? measureIndicator(list, trigger)
          : {
              opacity: 0,
            },
      );
    };

    updateIndicator();

    window.addEventListener("resize", updateIndicator);

    return () => {
      window.removeEventListener("resize", updateIndicator);
    };
  }, [
    getTriggerNode,
    indicatorValue,
  ]);

  return (
    <div
      className={cx(
        "relative isolate flex min-w-0",
        variant === "quiet"
          ? "h-9 items-end gap-1 border-taupe-100 border-b"
          : "h-12 items-stretch overflow-hidden rounded-sm border border-taupe-200 bg-white/85 shadow-sm",
        className,
      )}
      onPointerLeave={() => setPreviewValue(null)}
      ref={listRef}
      role="tablist"
      {...props}
    >
      <span
        aria-hidden="true"
        className={cx(
          "absolute left-0 z-0 opacity-0 transition-[transform,width,opacity] duration-200 ease-out motion-reduce:transition-none",
          variant === "quiet"
            ? "-bottom-px h-px bg-taupe-700"
            : "bottom-0 h-0.5 bg-orange-500",
        )}
        style={indicatorStyle}
      />
      {children}
    </div>
  );
};

export type MarbleTabsTriggerProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "value"
> & {
  badge?: ReactNode;
  value: string;
};

export const MarbleTabsTrigger = ({
  badge,
  children,
  className,
  disabled,
  onBlur,
  onClick,
  onFocus,
  onPointerEnter,
  type = "button",
  value,
  ...props
}: MarbleTabsTriggerProps) => {
  const {
    onValueChange,
    registerTrigger,
    rootId,
    setPreviewValue,
    value: activeValue,
    variant,
  } = useMarbleTabsContext();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const active = activeValue === value;

  useEffect(() => {
    registerTrigger(value, triggerRef.current);

    return () => registerTrigger(value, null);
  }, [
    registerTrigger,
    value,
  ]);

  return (
    <button
      aria-controls={getTabContentId(rootId, value)}
      aria-selected={active}
      className={cx(
        "relative z-10 flex min-w-0 items-center justify-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:pointer-events-none disabled:opacity-50",
        variant === "quiet"
          ? active
            ? "flex-initial px-2 py-1 font-normal text-[13px] text-taupe-900"
            : "flex-initial px-2 py-1 font-normal text-[13px] text-taupe-500 hover:text-taupe-900"
          : active
            ? "flex-1 px-3 font-medium text-sm text-zinc-950"
            : "flex-1 px-3 font-medium text-sm text-taupe-600 hover:text-zinc-950",
        className,
      )}
      data-state={active ? "active" : "inactive"}
      disabled={disabled}
      id={getTabTriggerId(rootId, value)}
      onBlur={(event) => {
        setPreviewValue(null);
        onBlur?.(event);
      }}
      onClick={(event) => {
        onClick?.(event);

        if (!event.defaultPrevented) {
          onValueChange(value);
        }
      }}
      onFocus={(event) => {
        setPreviewValue(value);
        onFocus?.(event);
      }}
      onPointerEnter={(event) => {
        setPreviewValue(value);
        onPointerEnter?.(event);
      }}
      ref={triggerRef}
      role="tab"
      type={type}
      {...props}
    >
      <span className="truncate">{children}</span>
      {badge === undefined || badge === null ? null : (
        <span
          className={cx(
            "rounded-full border px-1.5 py-0.5 font-mono text-xs leading-none",
            active
              ? "border-orange-200 bg-orange-50 text-orange-700"
              : "border-taupe-200 bg-taupe-50 text-taupe-600",
          )}
        >
          {badge}
        </span>
      )}
    </button>
  );
};

export type MarbleTabsContentProps = HTMLAttributes<HTMLDivElement> & {
  forceMount?: boolean;
  value: string;
};

export const MarbleTabsContent = ({
  children,
  className,
  forceMount = false,
  value,
  ...props
}: MarbleTabsContentProps) => {
  const { rootId, value: activeValue } = useMarbleTabsContext();
  const active = activeValue === value;

  if (!forceMount && !active) {
    return null;
  }

  return (
    <div
      aria-labelledby={getTabTriggerId(rootId, value)}
      className={className}
      data-state={active ? "active" : "inactive"}
      hidden={!active}
      id={getTabContentId(rootId, value)}
      role="tabpanel"
      {...props}
    >
      {children}
    </div>
  );
};
