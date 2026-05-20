"use client";

import {
  type ButtonHTMLAttributes,
  type CSSProperties,
  createContext,
  type HTMLAttributes,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { cx } from "../utils/cx";

type MarbleTabsContextValue = {
  getTriggerNode: (value: string) => HTMLButtonElement | null;
  onValueChange: (value: string) => void;
  previewValue: null | string;
  registerTrigger: (value: string, node: HTMLButtonElement | null) => void;
  rootId: string;
  setPreviewValue: (value: null | string) => void;
  value: string | undefined;
};

const MarbleTabsContext = createContext<MarbleTabsContextValue | null>(null);

const normalizeTabIdPart = (value: string) => {
  const normalized = value.replace(/[^a-zA-Z0-9_-]/g, "-");

  return normalized.length > 0 ? normalized : "tab";
};

const getTabTriggerId = (rootId: string, value: string) => {
  return `${rootId}-trigger-${normalizeTabIdPart(value)}`;
};

const getTabContentId = (rootId: string, value: string) => {
  return `${rootId}-content-${normalizeTabIdPart(value)}`;
};

const useMarbleTabsContext = () => {
  const context = useContext(MarbleTabsContext);

  if (!context) {
    throw new Error(
      "Marble tabs components must be rendered inside MarbleTabs.",
    );
  }

  return context;
};

const measureIndicator = (
  list: HTMLDivElement,
  trigger: HTMLButtonElement,
): CSSProperties => {
  const listRect = list.getBoundingClientRect();
  const triggerRect = trigger.getBoundingClientRect();

  return {
    opacity: 1,
    transform: `translateX(${triggerRect.left - listRect.left}px)`,
    width: triggerRect.width,
  };
};

export type MarbleTabsProps = HTMLAttributes<HTMLDivElement> & {
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  value?: string;
};

export const MarbleTabs = ({
  children,
  className,
  defaultValue,
  id,
  onValueChange,
  value,
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
    }),
    [
      getTriggerNode,
      handleValueChange,
      previewValue,
      registerTrigger,
      resolvedValue,
      rootId,
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
  const { getTriggerNode, previewValue, setPreviewValue, value } =
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
        "relative isolate flex h-12 min-w-0 items-stretch overflow-hidden rounded-sm border border-taupe-200 bg-white/85 shadow-sm",
        className,
      )}
      onPointerLeave={() => setPreviewValue(null)}
      ref={listRef}
      role="tablist"
      {...props}
    >
      <span
        aria-hidden="true"
        className="absolute bottom-0 left-0 z-0 h-0.5 bg-orange-500 opacity-0 transition-[transform,width,opacity] duration-200 ease-out motion-reduce:transition-none"
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
        "relative z-10 flex min-w-0 flex-1 items-center justify-center gap-2 px-3 font-medium text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:pointer-events-none disabled:opacity-50",
        active ? "text-zinc-950" : "text-taupe-600 hover:text-zinc-950",
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
