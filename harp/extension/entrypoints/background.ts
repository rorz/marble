import { browser, defineBackground } from "#imports";
import { createCaptureController } from "../lib/capture";
import {
  buildHar,
  type HarArchive,
  hostOf,
  type PendingEntry,
} from "../lib/har";
import {
  type BackgroundResponse,
  DEFAULT_SETTINGS,
  type ProbeRequest,
  type ProbeResponse,
  type Settings,
  type StopResult,
} from "../lib/messaging";

/**
 * HARP service worker. Owns the capture session and brokers messages from the
 * popup/dashboard: start/stop recording (synthesise + ingest a HAR) and relay
 * in-page probe requests to the active tab's content script (the explorer's
 * "hands").
 */

type Controller = ReturnType<typeof createCaptureController>;

const getSettings = async (): Promise<Settings> => {
  const stored = await browser.storage.local.get("settings");
  return {
    ...DEFAULT_SETTINGS,
    ...((stored.settings as Partial<Settings>) ?? {}),
  };
};

const saveSettings = async (patch: Partial<Settings>) => {
  await browser.storage.local.set({
    settings: {
      ...(await getSettings()),
      ...patch,
    },
  });
};

const setBadge = (recording: boolean) => {
  void browser.action.setBadgeBackgroundColor({
    color: "#f97316",
  });
  void browser.action.setBadgeText({
    text: recording ? "REC" : "",
  });
};

const toBase64 = (text: string) => {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
};

const downloadHar = async (har: HarArchive, host: string) => {
  await browser.downloads.download({
    filename: `harp-${host}-${Date.now()}.har`,
    url: `data:application/json;base64,${toBase64(JSON.stringify(har))}`,
  });
};

const ingestCapture = async (settings: Settings, har: HarArchive) => {
  const endpoint = `${settings.serverUrl.replace(/\/+$/, "")}/projects/${settings.projectId}/captures`;
  const response = await fetch(endpoint, {
    body: JSON.stringify({
      har,
    }),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(
      `Ingest failed (${response.status}): ${await response.text()}`,
    );
  }
  return response.json();
};

const activeTabId = async () => {
  const tabs = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });
  const id = tabs[0]?.id;
  if (id === undefined) {
    throw new Error("No active tab.");
  }
  return id;
};

const probeViaTab = async (
  request: ProbeRequest,
  tabId: number,
): Promise<ProbeResponse> =>
  (await browser.tabs.sendMessage(tabId, {
    request,
    type: "HARP_PROBE",
  })) as ProbeResponse;

const broadcastExplore = (payload: object) => {
  void browser.runtime.sendMessage(payload).catch(() => undefined);
};

const handleStop = async (controller: Controller): Promise<StopResult> => {
  const entries: PendingEntry[] = await controller.stop();
  setBadge(false);
  const har = buildHar(entries);
  const settings = await getSettings();
  const result: StopResult = {
    downloaded: false,
    entryCount: har.log.entries.length,
  };
  if (settings.autoDownload) {
    await downloadHar(har, hostOf(entries));
    result.downloaded = true;
  }
  if (settings.autoIngest && settings.projectId) {
    try {
      result.ingest = await ingestCapture(settings, har);
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
    }
  }
  return result;
};

const hostOfUrl = (url: string | undefined): string | null => {
  if (!url) {
    return null;
  }
  try {
    return new URL(url).host;
  } catch {
    // harness-ignore: no-swallowed-errors -- non-web tabs (chrome://, about:) just don't match
    return null;
  }
};

/** The host a project targets, read from the server's project record. */
const projectHost = async (
  settings: Settings,
  projectId: string,
): Promise<string> => {
  try {
    const response = await fetch(
      `${settings.serverUrl.replace(/\/+$/, "")}/projects`,
    );
    if (!response.ok) {
      return "";
    }
    const projects = (await response.json()) as Array<{
      host: string;
      id: string;
    }>;
    return projects.find((p) => p.id === projectId)?.host ?? "";
  } catch (error) {
    console.warn("[harp] could not resolve project host:", error);
    return "";
  }
};

const waitForTabReady = (tabId: number): Promise<void> =>
  new Promise((resolve) => {
    const listener = (
      id: number,
      info: {
        status?: string;
      },
    ) => {
      if (id === tabId && info.status === "complete") {
        browser.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    browser.tabs.onUpdated.addListener(listener);
    // Safety net: proceed even if the load event is missed.
    setTimeout(() => {
      browser.tabs.onUpdated.removeListener(listener);
      resolve();
    }, 8000);
  });

/**
 * A tab on the target host to probe through — probes inherit that origin's live
 * session (cookies are shared per-origin). Prefers an already-open tab; opens a
 * background one if none exists. `opened` lets the caller tidy up afterwards.
 */
const tabOnHost = async (
  host: string,
): Promise<{
  opened: boolean;
  tabId: number;
} | null> => {
  if (!host) {
    return null;
  }
  const tabs = await browser.tabs.query({});
  const existing = tabs.find((tab) => hostOfUrl(tab.url) === host);
  if (existing?.id !== undefined) {
    return {
      opened: false,
      tabId: existing.id,
    };
  }
  const created = await browser.tabs.create({
    active: false,
    url: `https://${host}/`,
  });
  if (created.id === undefined) {
    return null;
  }
  await waitForTabReady(created.id);
  return {
    opened: true,
    tabId: created.id,
  };
};

const runAnalyzeSession = async (
  settings: Settings,
  override?: {
    host?: string;
    message?: string;
    projectId?: string;
  },
): Promise<unknown> => {
  const projectId = override?.projectId || settings.projectId;
  if (!projectId) {
    throw new Error("Select a project before analyzing.");
  }
  // Analyze always tries to probe the project's host with your live session,
  // reusing an open tab on that host or opening one in the background. Only when
  // there's no known host yet does it fall back to a reasoning-only pass.
  const host = override?.host || (await projectHost(settings, projectId));
  const probe = await tabOnHost(host);
  const mode: "explore" | "refine" = probe ? "explore" : "refine";
  const wsUrl = `${settings.serverUrl.replace(/^http/, "ws").replace(/\/+$/, "")}/projects/${projectId}/explore`;
  const cleanup = () => {
    if (probe?.opened) {
      void browser.tabs.remove(probe.tabId).catch(() => undefined);
    }
  };
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(wsUrl);
    socket.addEventListener("open", () => {
      socket.send(
        JSON.stringify({
          message: override?.message,
          mode,
          provider: settings.provider,
          type: "start",
        }),
      );
    });
    socket.addEventListener("message", (event) => {
      void (async () => {
        const message = JSON.parse(String(event.data)) as {
          coverage?: unknown;
          delta?: unknown;
          entry?: unknown;
          id?: string;
          message?: string;
          probeCount?: number;
          request?: ProbeRequest;
          type: string;
        };
        if (message.type === "probe" && message.request && message.id) {
          const response: ProbeResponse =
            probe === null
              ? {
                  body: "No live tab to probe.",
                  contentType: null,
                  ok: false,
                  status: 0,
                }
              : await probeViaTab(message.request, probe.tabId).catch(
                  (error) => ({
                    body:
                      error instanceof Error ? error.message : String(error),
                    contentType: null,
                    ok: false,
                    status: 0,
                  }),
                );
          socket.send(
            JSON.stringify({
              id: message.id,
              response,
              type: "probe_result",
            }),
          );
          return;
        }
        if (message.type === "log") {
          broadcastExplore({
            entry: message.entry,
            type: "EXPLORE_LOG",
          });
          return;
        }
        if (message.type === "progress") {
          broadcastExplore({
            coverage: message.coverage,
            type: "EXPLORE_PROGRESS",
          });
          return;
        }
        if (message.type === "done") {
          broadcastExplore({
            delta: message.delta,
            probeCount: message.probeCount,
            type: "EXPLORE_DONE",
          });
          cleanup();
          socket.close();
          resolve(message);
          return;
        }
        if (message.type === "error") {
          broadcastExplore({
            message: message.message,
            type: "EXPLORE_ERROR",
          });
          cleanup();
          socket.close();
          reject(new Error(message.message ?? "Analyze failed."));
        }
      })();
    });
    socket.addEventListener("error", () => {
      cleanup();
      reject(new Error("Analyze socket error — is the HARP server running?"));
    });
  });
};

// Single source of truth for "is an analysis running", shared across the popup
// and dashboard via GET_STATE + broadcasts so both views render the same state.
let analyzing = false;

const startAnalysis = async (
  settings: Settings,
  override?: {
    host?: string;
    message?: string;
    projectId?: string;
  },
): Promise<unknown> => {
  if (analyzing) {
    throw new Error("Already analyzing.");
  }
  analyzing = true;
  broadcastExplore({
    type: "EXPLORE_START",
  });
  try {
    return await runAnalyzeSession(settings, override);
  } finally {
    analyzing = false;
  }
};

const handleMessage = async (
  controller: Controller,
  type: string,
  payload: {
    host?: string;
    message?: string;
    projectId?: string;
    request?: ProbeRequest;
    settings?: Partial<Settings>;
  },
): Promise<BackgroundResponse<unknown>> => {
  try {
    if (type === "GET_STATE") {
      return {
        data: {
          analyzing,
          settings: await getSettings(),
          state: controller.state(),
        },
        ok: true,
      };
    }
    if (type === "START") {
      await controller.start(await activeTabId());
      setBadge(true);
      return {
        data: {
          state: controller.state(),
        },
        ok: true,
      };
    }
    if (type === "STOP") {
      const result = await handleStop(controller);
      const settings = await getSettings();
      // Automatic analysis after every successful capture. Fire-and-forget: the
      // WebSocket keeps the worker alive and EXPLORE_* broadcasts drive both UIs.
      if (settings.autoAnalyze && settings.projectId && result.ingest) {
        void startAnalysis(settings).catch((error) => {
          broadcastExplore({
            message: error instanceof Error ? error.message : String(error),
            type: "EXPLORE_ERROR",
          });
        });
      }
      return {
        data: {
          result,
        },
        ok: true,
      };
    }
    if (type === "SAVE_SETTINGS") {
      await saveSettings(payload.settings ?? {});
      return {
        data: {
          settings: await getSettings(),
        },
        ok: true,
      };
    }
    if (type === "PROBE" && payload.request) {
      return {
        data: await probeViaTab(payload.request, await activeTabId()),
        ok: true,
      };
    }
    if (type === "EXPLORE") {
      return {
        data: await startAnalysis(await getSettings(), {
          host: payload.host,
          message: payload.message,
          projectId: payload.projectId,
        }),
        ok: true,
      };
    }
    throw new Error(`Unknown message '${type}'.`);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      ok: false,
    };
  }
};

export default defineBackground({
  main() {
    const controller = createCaptureController();
    browser.runtime.onMessage.addListener((message) => {
      const { type, ...payload } = (message ?? {}) as {
        host?: string;
        message?: string;
        projectId?: string;
        request?: ProbeRequest;
        settings?: Partial<Settings>;
        type?: string;
      };
      return handleMessage(controller, type ?? "", payload);
    });
  },
});
