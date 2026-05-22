"use client";

import { type CSSProperties, createContext, useContext } from "react";

export type MarbleTabsVariant = "default" | "quiet";

type MarbleTabsContextValue = {
  getTriggerNode: (value: string) => HTMLButtonElement | null;
  onValueChange: (value: string) => void;
  previewValue: null | string;
  registerTrigger: (value: string, node: HTMLButtonElement | null) => void;
  rootId: string;
  setPreviewValue: (value: null | string) => void;
  value: string | undefined;
  variant: MarbleTabsVariant;
};

export const MarbleTabsContext = createContext<MarbleTabsContextValue | null>(
  null,
);

export const useMarbleTabsContext = () => {
  const context = useContext(MarbleTabsContext);

  if (!context) {
    throw new Error(
      "Marble tabs components must be rendered inside MarbleTabs.",
    );
  }

  return context;
};

export const normalizeTabIdPart = (value: string) => {
  const normalized = value.replace(/[^a-zA-Z0-9_-]/g, "-");

  return normalized.length > 0 ? normalized : "tab";
};

export const getTabTriggerId = (rootId: string, value: string) => {
  return `${rootId}-trigger-${normalizeTabIdPart(value)}`;
};

export const getTabContentId = (rootId: string, value: string) => {
  return `${rootId}-content-${normalizeTabIdPart(value)}`;
};

export const measureIndicator = (
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
