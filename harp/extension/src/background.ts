import { createCaptureController } from "./capture";
import { buildHar, type HarArchive, hostOf, type PendingEntry } from "./har";

/**
 * HARP service worker. Owns the capture session and brokers messages from the
 * popup: start/stop recording, then on stop synthesise a HAR and (per settings)
 * download it and/or POST it to the local HARP server's ingest endpoint.
 */

type Settings = {
  autoDownload: boolean;
  autoIngest: boolean;
  projectId: string;
  serverUrl: string;
};

type StopResult = {
  downloaded: boolean;
  entryCount: number;
  error?: string;
  ingest?: unknown;
};

const DEFAULT_SETTINGS: Settings = {
  autoDownload: true,
  autoIngest: true,
  projectId: "",
  serverUrl: "http://localhost:4277",
};

const controller = createCaptureController();

const getSettings = async (): Promise<Settings> => {
  const stored = await chrome.storage.local.get("settings");
  return {
    ...DEFAULT_SETTINGS,
    ...((stored.settings as Partial<Settings>) ?? {}),
  };
};

const saveSettings = async (patch: Partial<Settings>) => {
  await chrome.storage.local.set({
    settings: {
      ...(await getSettings()),
      ...patch,
    },
  });
};

const setBadge = (recording: boolean) => {
  void chrome.action.setBadgeBackgroundColor({
    color: "#f97316",
  });
  void chrome.action.setBadgeText({
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
  const url = `data:application/json;base64,${toBase64(JSON.stringify(har))}`;
  await chrome.downloads.download({
    filename: `harp-${host}-${Date.now()}.har`,
    url,
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
  const tabs = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  const id = tabs[0]?.id;
  if (id === undefined) {
    throw new Error("No active tab to record.");
  }
  return id;
};

const handleStop = async (): Promise<StopResult> => {
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

const handleMessage = async (
  type: string,
  payload: {
    settings?: Partial<Settings>;
  },
) => {
  if (type === "GET_STATE") {
    return {
      settings: await getSettings(),
      state: controller.state(),
    };
  }
  if (type === "START") {
    await controller.start(await activeTabId());
    setBadge(true);
    return {
      state: controller.state(),
    };
  }
  if (type === "STOP") {
    return {
      result: await handleStop(),
    };
  }
  if (type === "SAVE_SETTINGS") {
    await saveSettings(payload.settings ?? {});
    return {
      settings: await getSettings(),
    };
  }
  throw new Error(`Unknown message '${type}'.`);
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const { type, ...payload } = (message ?? {}) as {
    settings?: Partial<Settings>;
    type?: string;
  };
  void (async () => {
    try {
      sendResponse({
        data: await handleMessage(type ?? "", payload),
        ok: true,
      });
    } catch (error) {
      sendResponse({
        error: error instanceof Error ? error.message : String(error),
        ok: false,
      });
    }
  })();
  return true;
});
