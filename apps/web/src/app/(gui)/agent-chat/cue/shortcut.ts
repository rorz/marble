import { hasKeyboardCaptureOwner } from "../../keyboard-capture";

export const CUE_TEXTAREA_ID = "agent-chat-cue-input";

const isCueTextareaTarget = (target: EventTarget | null) =>
  target instanceof HTMLTextAreaElement && target.id === CUE_TEXTAREA_ID;

const isCueTextareaActive = () =>
  typeof document !== "undefined" &&
  isCueTextareaTarget(document.activeElement);

const isCueKeyboardOwner = (event: KeyboardEvent) =>
  isCueTextareaTarget(event.target) || isCueTextareaActive();

export const isCueStartKey = (event: KeyboardEvent) =>
  !event.altKey &&
  !event.ctrlKey &&
  !event.metaKey &&
  !event.defaultPrevented &&
  !event.isComposing &&
  !event.repeat &&
  event.key.length === 1 &&
  event.key.trim().length > 0 &&
  !hasKeyboardCaptureOwner(event);

export const isTranscriptionStartKey = (event: KeyboardEvent) =>
  event.key === "Alt" &&
  !event.ctrlKey &&
  !event.metaKey &&
  !event.defaultPrevented &&
  !event.repeat &&
  (!hasKeyboardCaptureOwner(event) || isCueKeyboardOwner(event));

export const isTranscriptionStopKey = (event: KeyboardEvent) =>
  event.key === "Alt";
