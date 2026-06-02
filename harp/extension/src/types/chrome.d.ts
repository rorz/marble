/**
 * Minimal ambient declarations for the slice of the Chrome extension API HARP
 * uses. Hand-rolled on purpose: it keeps the extension dependency-free (no
 * `@types/chrome`) and self-contained for lift-out. Extend as new APIs are used.
 */

type DebuggerTarget = {
  extensionId?: string;
  tabId?: number;
  targetId?: string;
};

interface ChromeEvent<Listener extends (...args: never[]) => void> {
  addListener(listener: Listener): void;
  removeListener(listener: Listener): void;
}

declare const chrome: {
  action: {
    setBadgeBackgroundColor(details: {
      color: string;
      tabId?: number;
    }): Promise<void>;
    setBadgeText(details: { tabId?: number; text: string }): Promise<void>;
  };
  debugger: {
    attach(target: DebuggerTarget, requiredVersion: string): Promise<void>;
    detach(target: DebuggerTarget): Promise<void>;
    onDetach: ChromeEvent<(source: DebuggerTarget, reason: string) => void>;
    onEvent: ChromeEvent<
      (source: DebuggerTarget, method: string, params?: object) => void
    >;
    sendCommand(
      target: DebuggerTarget,
      method: string,
      commandParams?: object,
    ): Promise<unknown>;
  };
  downloads: {
    download(options: {
      filename?: string;
      saveAs?: boolean;
      url: string;
    }): Promise<number>;
  };
  runtime: {
    id: string;
    lastError?: {
      message?: string;
    };
    onMessage: ChromeEvent<
      (
        message: unknown,
        sender: unknown,
        sendResponse: (response?: unknown) => void,
      ) => boolean | undefined
    >;
    sendMessage(message: unknown): Promise<unknown>;
  };
  storage: {
    local: {
      get(keys?: string | string[] | null): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
    };
  };
  tabs: {
    query(queryInfo: { active?: boolean; currentWindow?: boolean }): Promise<
      Array<{
        id?: number;
        title?: string;
        url?: string;
      }>
    >;
  };
};
