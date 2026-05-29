import { z } from "zod";
import { workerStore } from "./store";

const queueMessageSchema = z.object({
  payload: z.json(),
  sourceId: z.uuid(),
});
type QueueMessage = z.infer<typeof queueMessageSchema>;
type ExecutorPayload = Record<string, unknown>;

const readExecutorResponse = async (response: Response) => {
  const text = await response.text();

  try {
    return (text.length === 0 ? {} : JSON.parse(text)) as ExecutorPayload;
  } catch {
    return {
      message: text || "Executor returned a non-JSON response.",
      success: false,
    };
  }
};

const executorPayloadMessage = (payload: ExecutorPayload) => {
  return typeof payload.message === "string" ? payload.message : undefined;
};

const executeRuns = async (env: Env, runIds: string[]) => {
  if (runIds.length === 0) {
    return;
  }

  const response = await env.MARBLE_EXECUTOR.fetch(
    new Request("https://executor.marble.internal/runs", {
      body: JSON.stringify({
        runIds,
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    }),
  );
  const payload = await readExecutorResponse(response);

  if (!response.ok && !(response.status === 500 && payload.success === false)) {
    throw new Error(
      `Executor batch run failed (${response.status}): ${
        executorPayloadMessage(payload) ?? JSON.stringify(payload)
      }`,
    );
  }
};

const processQueuedSourceEvent = async (env: Env, input: QueueMessage) => {
  const { runIds } = await workerStore(env).sourceEvents.ingestWebhook(input);
  await executeRuns(env, runIds);
};

export const consumeQueue = async (batch: MessageBatch<unknown>, env: Env) => {
  for (const message of batch.messages) {
    try {
      const input = queueMessageSchema.parse(message.body);
      await processQueuedSourceEvent(env, input);
      message.ack();
    } catch (error) {
      // A malformed body is poison — it will never parse, so drop it (ack) to
      // avoid retrying forever. Any other failure is transient (store/executor
      // outage, network) — retry so the message is not silently lost.
      if (error instanceof z.ZodError) {
        console.error("Dropping poison source ingest message", error);
        message.ack();
      } else {
        console.error("Retrying source ingest message after failure", error);
        message.retry();
      }
    }
  }
};
