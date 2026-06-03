import {
  type ExploreResult,
  type ExplorerProvider,
  type ExplorerVariant,
  explore,
  type ProbeExecutor,
  type ProbeResult,
} from "@harp/explorer";
import type { createBunWebSocket } from "hono/bun";
import type { WSContext } from "hono/ws";
import type { FileStore } from "./store";

/**
 * The `/projects/:id/explore` WebSocket: the server-side Pi explorer is the
 * brain, the extension content script is the hands. The brain's `probe` executor
 * sends `{type:"probe"}` over the socket; the extension replays it in-page and
 * returns `{type:"probe_result"}`. Progress streams as `{type:"event"}`; on
 * completion the refined model is saved and `{type:"done"}` is sent.
 *
 * Model keys live in the SERVER env (never the browser): pick a provider in the
 * popup, set the matching key here.
 */

type UpgradeWebSocket = ReturnType<
  typeof createBunWebSocket
>["upgradeWebSocket"];

const ENV_KEY: Record<ExplorerProvider, string> = {
  anthropic: "HARP_ANTHROPIC_API_KEY",
  google: "HARP_GOOGLE_API_KEY",
  openai: "HARP_OPENAI_API_KEY",
};

type StartMessage = {
  provider: ExplorerProvider;
  type: "start";
  variant?: ExplorerVariant;
};
type ProbeResultMessage = {
  id: string;
  response: ProbeResult;
  type: "probe_result";
};
type ClientMessage = StartMessage | ProbeResultMessage;

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export const createExploreRoute = (
  store: FileStore,
  upgradeWebSocket: UpgradeWebSocket,
) =>
  upgradeWebSocket((c) => {
    const projectId = c.req.param("id") ?? "";
    const pending = new Map<string, (result: ProbeResult) => void>();
    let probeSeq = 0;
    let running = false;

    const fail = (ws: WSContext, message: string) => {
      ws.send(
        JSON.stringify({
          message,
          type: "error",
        }),
      );
    };

    const start = async (ws: WSContext, message: StartMessage) => {
      if (running) {
        return;
      }
      running = true;
      const project = await store.getProject(projectId);
      if (!project) {
        return fail(ws, `Unknown project '${projectId}'.`);
      }
      const model = await store.getModel(projectId);
      if (!model) {
        return fail(ws, "No model yet — ingest a capture first.");
      }
      const envKey = ENV_KEY[message.provider];
      const apiKey = process.env[envKey];
      if (!apiKey) {
        return fail(
          ws,
          `Model key missing — set ${envKey} on the HARP server.`,
        );
      }

      const executor: ProbeExecutor = (request) =>
        new Promise<ProbeResult>((resolve) => {
          probeSeq += 1;
          const id = `p${probeSeq}`;
          pending.set(id, resolve);
          ws.send(
            JSON.stringify({
              id,
              request,
              type: "probe",
            }),
          );
        });

      try {
        const result: ExploreResult = await explore({
          apiKey,
          baseUrl: `https://${project.host || model.host}`,
          executor,
          model,
          onLog: (entry) =>
            ws.send(
              JSON.stringify({
                entry,
                type: "log",
              }),
            ),
          provider: message.provider,
          variant: message.variant,
        });
        const saved = await store.saveExploredModel(project, result.model);
        ws.send(
          JSON.stringify({
            delta: saved.delta,
            probeCount: result.probeLog.length,
            stats: saved.coverage.stats,
            type: "done",
          }),
        );
      } catch (error) {
        fail(ws, errorMessage(error));
      }
    };

    return {
      onClose: () => {
        pending.clear();
      },
      onMessage: (event, ws) => {
        let message: ClientMessage;
        try {
          message = JSON.parse(String(event.data)) as ClientMessage;
        } catch (error) {
          return fail(ws, errorMessage(error));
        }
        if (message.type === "probe_result") {
          const resolve = pending.get(message.id);
          if (resolve) {
            pending.delete(message.id);
            resolve(message.response);
          }
          return;
        }
        if (message.type === "start") {
          void start(ws, message);
        }
      },
    };
  });
