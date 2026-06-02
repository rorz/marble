/**
 * Synthesises a spec-compliant HAR 1.2 archive from collected CDP Network
 * events. This is the "auto-capture a HAR" path — no manual DevTools export —
 * and the output feeds straight into the HARP core inference engine.
 */

export type PendingEntry = {
  body?: string;
  bodyBase64?: boolean;
  method: string;
  postData?: string;
  postDataMime?: string;
  requestHeaders: Record<string, string>;
  responseHeaders?: Record<string, string>;
  responseMime?: string;
  startedDateTime: string;
  status?: number;
  statusText?: string;
  url: string;
};

type HarHeader = {
  name: string;
  value: string;
};

export type HarArchive = {
  log: {
    creator: {
      name: string;
      version: string;
    };
    entries: unknown[];
    version: string;
  };
};

const toHeaderList = (headers: Record<string, string>): HarHeader[] =>
  Object.entries(headers).map(([name, value]) => ({
    name,
    value,
  }));

const queryFromUrl = (rawUrl: string): HarHeader[] => {
  try {
    return [
      ...new URL(rawUrl).searchParams.entries(),
    ].map(([name, value]) => ({
      name,
      value,
    }));
  } catch {
    // harness-ignore: no-swallowed-errors -- a malformed URL just yields no query
    return [];
  }
};

const buildEntry = (entry: PendingEntry) => ({
  cache: {},
  request: {
    bodySize: entry.postData ? entry.postData.length : 0,
    headers: toHeaderList(entry.requestHeaders),
    headersSize: -1,
    httpVersion: "HTTP/1.1",
    method: entry.method,
    postData: entry.postData
      ? {
          mimeType: entry.postDataMime ?? "application/octet-stream",
          text: entry.postData,
        }
      : undefined,
    queryString: queryFromUrl(entry.url),
    url: entry.url,
  },
  response: {
    bodySize: entry.body ? entry.body.length : 0,
    content: {
      encoding: entry.bodyBase64 ? "base64" : undefined,
      mimeType: entry.responseMime ?? "application/octet-stream",
      size: entry.body ? entry.body.length : 0,
      text: entry.body,
    },
    headers: toHeaderList(entry.responseHeaders ?? {}),
    headersSize: -1,
    httpVersion: "HTTP/1.1",
    redirectURL: "",
    status: entry.status ?? 0,
    statusText: entry.statusText ?? "",
  },
  startedDateTime: entry.startedDateTime,
  time: 0,
  timings: {
    receive: 0,
    send: 0,
    wait: 0,
  },
});

export const buildHar = (entries: PendingEntry[]): HarArchive => ({
  log: {
    creator: {
      name: "HARP",
      version: "0.1.0",
    },
    entries: entries
      .filter((entry) => entry.status !== undefined)
      .map(buildEntry),
    version: "1.2",
  },
});

export const hostOf = (entries: PendingEntry[]): string => {
  for (const entry of entries) {
    try {
      return new URL(entry.url).host;
    } catch {
      // harness-ignore: no-swallowed-errors -- skip unparseable URLs when naming the file
    }
  }
  return "capture";
};
