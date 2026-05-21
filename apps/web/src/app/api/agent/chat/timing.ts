import { formatServerTimingEntry, withTiming } from "@marble/lib/timing";
import type { AgentChatWireEvent } from "./events";

type TimingMetadata = Record<string, unknown>;

type TimingEntry = {
  durationMs: number;
  name: string;
};

const MARBLE_REQUEST_ID_HEADER = "x-marble-request-id";
const MARBLE_SERVER_TIMING_HEADER = "x-marble-server-timing";
const SERVER_TIMING_HEADER = "Server-Timing";
const CHAT_TIMING_LOG_LABEL = "[/api/agent/chat] timing";

const nowMs = () => performance.now();

const roundMs = (durationMs: number) => Math.round(durationMs);

const resolveRequestId = (request: Request) =>
  request.headers.get(MARBLE_REQUEST_ID_HEADER)?.trim() || crypto.randomUUID();

export const createAgentChatTiming = (request: Request) => {
  const requestId = resolveRequestId(request);
  const startedAt = nowMs();
  const timings: TimingEntry[] = [];
  const toolSpans = new Map<string, ReturnType<typeof startSpan>>();
  let finished = false;
  let observedFirstTextDelta = false;
  let observedFirstToolStart = false;
  let observedFirstWireEvent = false;

  const elapsedMs = () => nowMs() - startedAt;

  const log = (event: string, metadata: TimingMetadata = {}) => {
    console.info(CHAT_TIMING_LOG_LABEL, {
      elapsedMs: roundMs(elapsedMs()),
      event,
      requestId,
      ...metadata,
    });
  };

  const record = (
    name: string,
    durationMs: number,
    metadata: TimingMetadata = {},
  ) => {
    timings.push({
      durationMs,
      name,
    });
    log("phase", {
      durationMs: roundMs(durationMs),
      phase: name,
      ...metadata,
    });
  };

  const mark = (name: string, metadata: TimingMetadata = {}) => {
    log("mark", {
      mark: name,
      ...metadata,
    });
  };

  const measure = async <T>(
    name: string,
    task: () => Promise<T> | T,
    metadata: TimingMetadata = {},
  ): Promise<T> =>
    withTiming(
      (_recordedName, durationMs) => record(name, durationMs, metadata),
      name,
      task,
    );

  const startSpan = (name: string, metadata: TimingMetadata = {}) => {
    const spanStartedAt = nowMs();
    let ended = false;
    mark(`${name}.start`, metadata);

    return {
      end: (endMetadata: TimingMetadata = {}) => {
        if (ended) return;
        ended = true;
        record(name, nowMs() - spanStartedAt, {
          ...metadata,
          ...endMetadata,
        });
      },
    };
  };

  const observeWireEvent = (payload: AgentChatWireEvent) => {
    if (!observedFirstWireEvent) {
      observedFirstWireEvent = true;
      mark("stream.first_event", {
        eventType: payload.type,
      });
    }

    if (
      payload.type === "message_update" &&
      payload.assistantMessageEvent.delta.length > 0 &&
      !observedFirstTextDelta
    ) {
      observedFirstTextDelta = true;
      mark("agent.first_text_delta");
    }

    if (payload.type === "tool_execution_start") {
      if (!observedFirstToolStart) {
        observedFirstToolStart = true;
        mark("agent.first_tool_start", {
          toolName: payload.toolName,
        });
      }

      toolSpans.set(
        payload.toolCallId,
        startSpan("tool.execute", {
          label: payload.label,
          toolCallId: payload.toolCallId,
          toolName: payload.toolName,
        }),
      );
      return;
    }

    if (payload.type === "tool_execution_end") {
      const span = toolSpans.get(payload.toolCallId);
      toolSpans.delete(payload.toolCallId);
      if (span) {
        span.end({
          isError: payload.isError,
          toolName: payload.toolName,
        });
        return;
      }

      mark("tool.end_without_start", {
        isError: payload.isError,
        toolCallId: payload.toolCallId,
        toolName: payload.toolName,
      });
    }
  };

  const serverTiming = () =>
    timings
      .map((entry) => formatServerTimingEntry(entry.name, entry.durationMs))
      .join(", ");

  const headers = (init: HeadersInit = {}) => {
    const responseHeaders = new Headers(init);
    responseHeaders.set(MARBLE_REQUEST_ID_HEADER, requestId);

    const serverTimingValue = serverTiming();
    if (serverTimingValue) {
      responseHeaders.set(SERVER_TIMING_HEADER, serverTimingValue);
      responseHeaders.set(MARBLE_SERVER_TIMING_HEADER, serverTimingValue);
    }

    return responseHeaders;
  };

  const finish = (status: string, metadata: TimingMetadata = {}) => {
    if (finished) return;
    finished = true;
    record("total", elapsedMs(), {
      status,
      ...metadata,
    });
    log("summary", {
      status,
      timings: timings.map((entry) =>
        formatServerTimingEntry(entry.name, entry.durationMs),
      ),
      ...metadata,
    });
  };

  return {
    finish,
    headers,
    mark,
    measure,
    observeWireEvent,
    requestId,
    startSpan,
  };
};
