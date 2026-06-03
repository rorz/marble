import type { CoverageDelta } from "@harp/contracts";

/**
 * Shared message + settings shapes for the HARP extension. The popup and
 * dashboard talk to the background worker (capture control, ingest) and the
 * content script (in-page probe execution) through these typed envelopes.
 */

type ExplorerProvider = "anthropic" | "google" | "openai";

export type Settings = {
  autoDownload: boolean;
  autoIngest: boolean;
  projectId: string;
  provider: ExplorerProvider;
  serverUrl: string;
};

export const DEFAULT_SETTINGS: Settings = {
  autoDownload: true,
  autoIngest: true,
  projectId: "",
  provider: "anthropic",
  serverUrl: "http://localhost:4277",
};

export type StopResult = {
  downloaded: boolean;
  entryCount: number;
  error?: string;
  ingest?: {
    delta: CoverageDelta;
  };
};

export type ProbeRequest = {
  headers?: Record<string, string>;
  method: string;
  url: string;
};

export type ProbeResponse = {
  body: string;
  contentType: string | null;
  ok: boolean;
  status: number;
};

export type BackgroundResponse<T> = {
  data?: T;
  error?: string;
  ok: boolean;
};

export type LogEntry = {
  at: string;
  kind: "thinking" | "message" | "action" | "result" | "error" | "info";
  text: string;
};
