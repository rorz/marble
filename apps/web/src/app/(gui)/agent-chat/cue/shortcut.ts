export const CUE_TEXTAREA_ID = "agent-chat-cue-input";

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement
  );
};

const isCueTextareaTarget = (target: EventTarget | null) =>
  target instanceof HTMLTextAreaElement && target.id === CUE_TEXTAREA_ID;

export const isCueStartKey = (event: KeyboardEvent) =>
  !event.altKey &&
  !event.ctrlKey &&
  !event.metaKey &&
  !event.defaultPrevented &&
  !event.isComposing &&
  !event.repeat &&
  event.key.length === 1 &&
  event.key.trim().length > 0 &&
  !isEditableTarget(event.target);

export const isTranscriptionStartKey = (event: KeyboardEvent) =>
  event.key === "Alt" &&
  !event.ctrlKey &&
  !event.metaKey &&
  !event.defaultPrevented &&
  !event.repeat &&
  (!isEditableTarget(event.target) || isCueTextareaTarget(event.target));

export const isTranscriptionStopKey = (event: KeyboardEvent) =>
  event.key === "Alt";
