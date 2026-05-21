export type ScribeCapture = {
  capturedSampleCount: number;
  pendingChunks: Int16Array[];
};

export type ScribeConnectionStatus = "connected" | "failed";

type ScribeStopReason = "closed" | "committed" | "empty" | "failed" | "timeout";

export type ScribeStopResult = {
  capturedAudio: boolean;
  reason: ScribeStopReason;
};

export type ScribeSession = {
  audioContext: AudioContext;
  capture: ScribeCapture;
  captureDisposed: boolean;
  connectPromise: Promise<ScribeConnectionStatus>;
  flushInterval: number;
  hasSentAudio: boolean;
  processor: AudioWorkletNode;
  resolveStop: ((result: ScribeStopResult) => void) | null;
  socket: WebSocket | null;
  source: MediaStreamAudioSourceNode;
  stopPromise: Promise<ScribeStopResult> | null;
  stopReason: ScribeStopReason | null;
  stopTimeout: number | null;
  stopping: boolean;
  stream: MediaStream;
};

export type ScribeTranscriptEvent = {
  committed: boolean;
  text: string;
};
