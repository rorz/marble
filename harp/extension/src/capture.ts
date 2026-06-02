import type { PendingEntry } from "./har";

/**
 * Drives the Chrome DevTools Protocol Network domain over `chrome.debugger`:
 * attach to a tab, collect request/response events, fetch response bodies, and
 * hand back the raw entries that {@link buildHar} turns into a HAR archive.
 */

type RequestWillBeSent = {
  request: {
    headers?: Record<string, string>;
    method: string;
    postData?: string;
    url: string;
  };
  requestId: string;
  wallTime?: number;
};

type ResponseReceived = {
  requestId: string;
  response: {
    headers?: Record<string, string>;
    mimeType?: string;
    status: number;
    statusText?: string;
  };
};

type LoadingFinished = {
  requestId: string;
};
type ResponseBody = {
  base64Encoded?: boolean;
  body?: string;
};

export type CaptureState = {
  entryCount: number;
  recording: boolean;
  tabId: number | null;
};

const isoFromWallTime = (wallTime?: number) =>
  wallTime ? new Date(wallTime * 1000).toISOString() : new Date().toISOString();

const contentTypeOf = (
  headers?: Record<string, string>,
): string | undefined => {
  if (!headers) {
    return undefined;
  }
  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() === "content-type") {
      return value;
    }
  }
  return undefined;
};

export const createCaptureController = () => {
  let session: {
    entries: Map<string, PendingEntry>;
    tabId: number;
  } | null = null;

  const onRequest = (data: RequestWillBeSent) => {
    if (!session) {
      return;
    }
    session.entries.set(data.requestId, {
      method: data.request.method,
      postData: data.request.postData,
      postDataMime: contentTypeOf(data.request.headers),
      requestHeaders: data.request.headers ?? {},
      startedDateTime: isoFromWallTime(data.wallTime),
      url: data.request.url,
    });
  };

  const onResponse = (data: ResponseReceived) => {
    const entry = session?.entries.get(data.requestId);
    if (!entry) {
      return;
    }
    entry.responseHeaders = data.response.headers ?? {};
    entry.responseMime = data.response.mimeType;
    entry.status = data.response.status;
    entry.statusText = data.response.statusText;
  };

  const onFinished = async (data: LoadingFinished) => {
    if (!session) {
      return;
    }
    const entry = session.entries.get(data.requestId);
    if (!entry || entry.status === undefined) {
      return;
    }
    try {
      const body = (await chrome.debugger.sendCommand(
        {
          tabId: session.tabId,
        },
        "Network.getResponseBody",
        {
          requestId: data.requestId,
        },
      )) as ResponseBody;
      entry.body = body.body;
      entry.bodyBase64 = body.base64Encoded;
    } catch (error) {
      console.warn("[harp] getResponseBody failed", error);
    }
  };

  chrome.debugger.onEvent.addListener((source, method, params) => {
    if (!session || source.tabId !== session.tabId || !params) {
      return;
    }
    if (method === "Network.requestWillBeSent") {
      onRequest(params as RequestWillBeSent);
    } else if (method === "Network.responseReceived") {
      onResponse(params as ResponseReceived);
    } else if (method === "Network.loadingFinished") {
      void onFinished(params as LoadingFinished);
    }
  });

  chrome.debugger.onDetach.addListener((source) => {
    if (session && source.tabId === session.tabId) {
      session = null;
    }
  });

  const stop = async (): Promise<PendingEntry[]> => {
    if (!session) {
      return [];
    }
    const { entries, tabId } = session;
    session = null;
    try {
      await chrome.debugger.detach({
        tabId,
      });
    } catch (error) {
      console.warn("[harp] detach failed", error);
    }
    return [
      ...entries.values(),
    ];
  };

  const start = async (tabId: number) => {
    await stop();
    await chrome.debugger.attach(
      {
        tabId,
      },
      "1.3",
    );
    await chrome.debugger.sendCommand(
      {
        tabId,
      },
      "Network.enable",
    );
    session = {
      entries: new Map(),
      tabId,
    };
  };

  const state = (): CaptureState => ({
    entryCount: session ? session.entries.size : 0,
    recording: session !== null,
    tabId: session?.tabId ?? null,
  });

  return {
    start,
    state,
    stop,
  };
};
