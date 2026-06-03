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

const runExploreSession = async (settings: Settings): Promise<unknown> => {
  if (!settings.projectId) {
    throw new Error("Select a project before exploring.");
  }
  // Pin probing to the tab that started the run, so you can switch to the
  // dashboard to watch the log while probes keep hitting the target's session.
  const tabId = await activeTabId();
  const wsUrl = `${settings.serverUrl.replace(/^http/, "ws").replace(/\/+$/, "")}/projects/${settings.projectId}/explore`;
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(wsUrl);
    socket.addEventListener("open", () => {
      broadcastExplore({
        projectId: settings.projectId,
        type: "EXPLORE_START",
      });
      socket.send(
        JSON.stringify({
          provider: settings.provider,
          type: "start",
        }),
      );
    });
    socket.addEventListener("message", (event) => {
      void (async () => {
        const message = JSON.parse(String(event.data)) as {
          entry?: unknown;
          id?: string;
          message?: string;
          request?: ProbeRequest;
          type: string;
        };
        if (message.type === "probe" && message.request && message.id) {
          const response: ProbeResponse = await probeViaTab(
            message.request,
            tabId,
          ).catch((error) => ({
            body: error instanceof Error ? error.message : String(error),
            contentType: null,
            ok: false,
            status: 0,
          }));
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
        if (message.type === "done") {
          broadcastExplore({
            type: "EXPLORE_DONE",
          });
          socket.close();
          resolve(message);
          return;
        }
        if (message.type === "error") {
          broadcastExplore({
            message: message.message,
            type: "EXPLORE_ERROR",
          });
          socket.close();
          reject(new Error(message.message ?? "Explore failed."));
        }
      })();
    });
    socket.addEventListener("error", () => {
      reject(new Error("Explore socket error — is the HARP server running?"));
    });
  });
};

const handleMessage = async (
  controller: Controller,
  type: string,
  payload: {
    request?: ProbeRequest;
    settings?: Partial<Settings>;
  },
): Promise<BackgroundResponse<unknown>> => {
  try {
    if (type === "GET_STATE") {
      return {
        data: {
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
      return {
        data: {
          result: await handleStop(controller),
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
        data: await runExploreSession(await getSettings()),
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
        request?: ProbeRequest;
        settings?: Partial<Settings>;
        type?: string;
      };
      return handleMessage(controller, type ?? "", payload);
    });
  },
});
