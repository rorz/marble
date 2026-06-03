import { browser, defineContentScript } from "#imports";
import type { ProbeRequest, ProbeResponse } from "../lib/messaging";

/**
 * The explorer's in-page "hands". Runs in the page context of every site so the
 * server-side brain can ask it (via the background relay) to replay a request
 * with the user's live session — `credentials: "include"` sends the page's
 * cookies, including httpOnly ones, without exposing them to the server.
 */

const executeProbe = async (request: ProbeRequest): Promise<ProbeResponse> => {
  try {
    const response = await fetch(request.url, {
      credentials: "include",
      headers: request.headers,
      method: request.method,
    });
    return {
      body: await response.text(),
      contentType: response.headers.get("content-type"),
      ok: response.ok,
      status: response.status,
    };
  } catch (error) {
    return {
      body: error instanceof Error ? error.message : String(error),
      contentType: null,
      ok: false,
      status: 0,
    };
  }
};

export default defineContentScript({
  main() {
    browser.runtime.onMessage.addListener((message) => {
      const msg = message as {
        request?: ProbeRequest;
        type?: string;
      };
      if (msg.type === "HARP_PROBE" && msg.request) {
        return executeProbe(msg.request);
      }
      return undefined;
    });
  },
  matches: [
    "<all_urls>",
  ],
});
