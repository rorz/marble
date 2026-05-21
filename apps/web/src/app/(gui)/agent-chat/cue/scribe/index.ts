import { stringifyJsonSafe } from "@marble/lib/json";
import {
  concatenatePcmChunks,
  downsampleToPcm,
  encodePcmBase64,
  SAMPLE_RATE,
  stopStreamTracks,
} from "./audio";
import {
  buildScribeUrl,
  describeScribeError,
  isCommittedTranscriptMessage,
  isScribeErrorMessage,
  isTranscriptMessage,
  parseScribeMessage,
  readScribeToken,
} from "./protocol";
import type {
  ScribeCapture,
  ScribeConnectionStatus,
  ScribeSession,
  ScribeStopResult,
  ScribeTranscriptEvent,
} from "./types";
import { createScribeAudioNode } from "./worklet";

const CHUNK_INTERVAL_MS = 250;
const FINAL_RESULT_TIMEOUT_MS = 6_000;
const MAX_CHUNK_SAMPLE_COUNT = SAMPLE_RATE;
const MIN_COMMIT_SAMPLE_COUNT = SAMPLE_RATE * 2;
const COMMIT_SILENCE = new Int16Array(SAMPLE_RATE / 10);

export type { ScribeSession, ScribeStopResult, ScribeTranscriptEvent };

const closeScribeSocket = (session: ScribeSession) => {
  const { socket } = session;

  if (
    socket?.readyState === WebSocket.OPEN ||
    socket?.readyState === WebSocket.CONNECTING
  ) {
    socket.close();
  }
};

const settleStop = (session: ScribeSession, result: ScribeStopResult) => {
  if (!session.resolveStop) return;
  if (session.stopTimeout !== null) {
    window.clearTimeout(session.stopTimeout);
    session.stopTimeout = null;
  }
  const resolve = session.resolveStop;
  session.resolveStop = null;
  resolve(result);
};

const disposeScribeCapture = (session: ScribeSession) => {
  if (session.captureDisposed) return;
  session.captureDisposed = true;
  window.clearInterval(session.flushInterval);
  session.processor.port.close();
  session.processor.disconnect();
  session.source.disconnect();
  stopStreamTracks(session.stream);
  void session.audioContext.close();
};

const padCommitAudio = (capture: ScribeCapture) => {
  if (
    capture.capturedSampleCount <= 0 ||
    capture.capturedSampleCount >= MIN_COMMIT_SAMPLE_COUNT
  ) {
    return;
  }

  const missingSamples = MIN_COMMIT_SAMPLE_COUNT - capture.capturedSampleCount;
  capture.pendingChunks.push(new Int16Array(missingSamples));
  capture.capturedSampleCount += missingSamples;
};

const sendPcmPayload = (
  session: ScribeSession,
  pcm: Int16Array,
  commit: boolean,
) => {
  let offset = 0;

  while (offset < pcm.length) {
    const end = Math.min(offset + MAX_CHUNK_SAMPLE_COUNT, pcm.length);
    const finalChunk = end === pcm.length;
    session.socket?.send(
      stringifyJsonSafe({
        audio_base_64: encodePcmBase64(pcm.subarray(offset, end)),
        commit: commit && finalChunk,
        message_type: "input_audio_chunk",
        sample_rate: SAMPLE_RATE,
      }),
    );
    offset = end;
  }
};

const sendScribeAudio = (session: ScribeSession, commit: boolean) => {
  if (session.socket?.readyState !== WebSocket.OPEN) return;
  if (commit) padCommitAudio(session.capture);

  const chunks = session.capture.pendingChunks.splice(0);
  if (chunks.length === 0 && (!commit || !session.hasSentAudio)) return;

  const pcm = chunks.length > 0 ? concatenatePcmChunks(chunks) : COMMIT_SILENCE;
  session.hasSentAudio = true;
  sendPcmPayload(session, pcm, commit);
};

const createAudioContext = () => {
  if (!window.AudioContext) throw new Error("AudioContext is unavailable.");
  return new AudioContext();
};

const waitForSocketOpen = async (socket: WebSocket) => {
  await new Promise<void>((resolve, reject) => {
    socket.addEventListener(
      "error",
      () => reject(new Error("ElevenLabs realtime socket failed to open.")),
      {
        once: true,
      },
    );
    socket.addEventListener("open", () => resolve(), {
      once: true,
    });
  });
};

const handleScribeSocketClose = (
  session: ScribeSession,
  event: CloseEvent,
  onError: (error: Error) => void,
) => {
  if (!session.stopping && event.code !== 1000) {
    const reason = event.reason ? ` ${event.reason}` : "";
    onError(
      new Error(`ElevenLabs realtime socket closed (${event.code}).${reason}`),
    );
  }

  if (session.stopping) {
    settleStop(session, {
      capturedAudio: session.capture.capturedSampleCount > 0,
      reason: session.stopReason ?? "closed",
    });
  }
};

const handleScribeSocketMessage = (
  session: ScribeSession,
  data: unknown,
  onTranscript: (event: ScribeTranscriptEvent) => void,
  onError: (error: Error) => void,
) => {
  try {
    const message = parseScribeMessage(data);
    if (!message) return;

    if (isScribeErrorMessage(message)) {
      onError(
        new Error(
          describeScribeError(message) ||
            "ElevenLabs realtime transcription failed.",
        ),
      );
      session.stopReason = "failed";
      closeScribeSocket(session);
      return;
    }

    if (isTranscriptMessage(message) && typeof message.text === "string") {
      onTranscript({
        committed: isCommittedTranscriptMessage(message),
        text: message.text,
      });
    }

    if (session.stopping && isCommittedTranscriptMessage(message)) {
      session.stopReason = "committed";
      closeScribeSocket(session);
    }
  } catch (cause) {
    onError(
      new Error("Unable to process ElevenLabs realtime message.", {
        cause,
      }),
    );
    session.stopReason = "failed";
    closeScribeSocket(session);
  }
};

const failActiveSession = (session: ScribeSession, onStop: () => void) => {
  if (session.stopping) return;
  session.stopping = true;
  session.stopReason = "failed";
  disposeScribeCapture(session);
  closeScribeSocket(session);
  onStop();
};

const connectScribeSocket = async (
  session: ScribeSession,
  onTranscript: (event: ScribeTranscriptEvent) => void,
  onError: (error: Error) => void,
  onStop: () => void,
): Promise<ScribeConnectionStatus> => {
  try {
    const socket = new WebSocket(buildScribeUrl(await readScribeToken()));
    let opened = false;
    session.socket = socket;
    socket.addEventListener("message", (event) => {
      handleScribeSocketMessage(session, event.data, onTranscript, onError);
    });
    socket.addEventListener("error", () => {
      if (opened && !session.stopping) {
        onError(new Error("ElevenLabs realtime socket failed."));
        failActiveSession(session, onStop);
      }
    });
    socket.addEventListener("close", (event) => {
      handleScribeSocketClose(session, event, onError);
      onStop();
    });
    await waitForSocketOpen(socket);
    opened = true;
    return "connected";
  } catch (cause) {
    onError(
      new Error("Unable to connect to ElevenLabs realtime Scribe.", {
        cause,
      }),
    );
    failActiveSession(session, onStop);
    return "failed";
  }
};

export const stopScribeSession = (session: ScribeSession) => {
  if (session.stopPromise) return session.stopPromise;
  session.stopping = true;
  disposeScribeCapture(session);
  session.stopPromise = new Promise<ScribeStopResult>((resolve) => {
    session.resolveStop = resolve;
  });

  if (session.capture.capturedSampleCount <= 0) {
    session.stopReason = "empty";
    void session.connectPromise.then(() => closeScribeSocket(session));
    settleStop(session, {
      capturedAudio: false,
      reason: "empty",
    });
    return session.stopPromise;
  }

  void session.connectPromise.then((status) => {
    if (status === "failed") {
      session.stopReason = "failed";
      settleStop(session, {
        capturedAudio: true,
        reason: "failed",
      });
      return;
    }

    sendScribeAudio(session, true);
    session.stopTimeout = window.setTimeout(() => {
      session.stopReason = "timeout";
      closeScribeSocket(session);
      settleStop(session, {
        capturedAudio: true,
        reason: "timeout",
      });
    }, FINAL_RESULT_TIMEOUT_MS);
  });

  return session.stopPromise;
};

export const startScribeSession = async (
  onTranscript: (event: ScribeTranscriptEvent) => void,
  onError: (error: Error) => void,
  onStop: () => void,
) => {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Microphone capture is unavailable.");
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
    },
  });
  const audioContext = createAudioContext();
  const capture: ScribeCapture = {
    capturedSampleCount: 0,
    pendingChunks: [],
  };
  const source = audioContext.createMediaStreamSource(stream);
  const processor = await createScribeAudioNode(audioContext, (samples) => {
    const pcm = downsampleToPcm(samples, audioContext.sampleRate);
    capture.pendingChunks.push(pcm);
    capture.capturedSampleCount += pcm.length;
  });
  const session: ScribeSession = {
    audioContext,
    capture,
    captureDisposed: false,
    connectPromise: Promise.resolve("failed"),
    flushInterval: 0,
    hasSentAudio: false,
    processor,
    resolveStop: null,
    socket: null,
    source,
    stopPromise: null,
    stopping: false,
    stopReason: null,
    stopTimeout: null,
    stream,
  };

  source.connect(processor);
  processor.connect(audioContext.destination);
  if (audioContext.state === "suspended") await audioContext.resume();

  session.flushInterval = window.setInterval(
    () => sendScribeAudio(session, false),
    CHUNK_INTERVAL_MS,
  );
  session.connectPromise = connectScribeSocket(
    session,
    onTranscript,
    onError,
    onStop,
  );
  return session;
};
