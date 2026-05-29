const KEYBOARD_CAPTURE_OWNER_SELECTOR = "[data-marble-keyboard-capture-owner]";
const KEYBOARD_DIALOG_OWNER_SELECTOR = '[aria-modal="true"], [role="dialog"]';
const KEYBOARD_OWNER_SELECTOR = `${KEYBOARD_CAPTURE_OWNER_SELECTOR}, ${KEYBOARD_DIALOG_OWNER_SELECTOR}`;

type EditableKeyboardTargetOptions = {
  ignoreCommandMenu?: boolean;
};

const isHTMLElementTarget = (
  target: EventTarget | null,
): target is HTMLElement =>
  typeof HTMLElement !== "undefined" && target instanceof HTMLElement;

const getActiveElement = () => {
  if (typeof document === "undefined") {
    return null;
  }

  return document.activeElement;
};

const isCommandMenuTarget = (target: HTMLElement) =>
  Boolean(target.closest("[cmdk-root]"));

export const keyboardCaptureOwnerProps = {
  "data-marble-keyboard-capture-owner": "",
} as const;

export const isEditableKeyboardTarget = (
  target: EventTarget | null,
  options: EditableKeyboardTargetOptions = {},
) => {
  if (!isHTMLElementTarget(target)) {
    return false;
  }

  if (options.ignoreCommandMenu && isCommandMenuTarget(target)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement
  );
};

const isKeyboardCaptureOwnerTarget = (target: EventTarget | null) =>
  isHTMLElementTarget(target) &&
  Boolean(target.closest(KEYBOARD_OWNER_SELECTOR));

export const hasKeyboardCaptureOwner = (
  event: KeyboardEvent,
  options: EditableKeyboardTargetOptions = {},
) => {
  const activeElement = getActiveElement();

  return (
    isKeyboardCaptureOwnerTarget(event.target) ||
    isKeyboardCaptureOwnerTarget(activeElement) ||
    isEditableKeyboardTarget(event.target, options) ||
    isEditableKeyboardTarget(activeElement, options)
  );
};
