"use client";

import { cx, MarbleTextarea } from "@marble/ui";
import { PaperPlaneRightIcon, XIcon } from "@phosphor-icons/react";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";
import { useAgentChatSession } from "./context";

const CUE_TEXTAREA_ID = "agent-chat-cue-input";

type AgentChatCueProps = {
  disabled?: boolean;
  onSubmitStart?: () => void;
};

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

const isCueStartKey = (event: KeyboardEvent) =>
  !event.altKey &&
  !event.ctrlKey &&
  !event.metaKey &&
  !event.defaultPrevented &&
  !event.isComposing &&
  !event.repeat &&
  event.key.length === 1 &&
  event.key.trim().length > 0 &&
  !isEditableTarget(event.target);

export const AgentChatCue = ({
  disabled = false,
  onSubmitStart,
}: AgentChatCueProps) => {
  const { sendMessage, streaming } = useAgentChatSession();
  const [draft, setDraft] = useState("");
  const [visible, setVisible] = useState(false);
  const unavailable = disabled || streaming;

  useLayoutEffect(() => {
    if (!visible) {
      return;
    }

    const input = document.getElementById(CUE_TEXTAREA_ID);

    if (!(input instanceof HTMLTextAreaElement)) {
      return;
    }

    const cursorPosition = input.value.length;
    input.focus();
    input.setSelectionRange(cursorPosition, cursorPosition);
  }, [
    visible,
  ]);

  const clearCue = () => {
    setDraft("");
    setVisible(false);
  };

  const submitCue = async () => {
    const trimmed = draft.trim();

    if (!trimmed || unavailable) {
      return;
    }

    clearCue();
    onSubmitStart?.();
    await sendMessage(trimmed, {
      freshThread: true,
    });
  };

  useEffect(() => {
    if (visible || unavailable) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isCueStartKey(event)) {
        return;
      }

      event.preventDefault();
      setDraft(event.key);
      setVisible(true);
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    unavailable,
    visible,
  ]);

  const handleCueKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      clearCue();
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitCue();
    }
  };

  if (!visible) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <form
        className={cx(
          "pointer-events-auto flex w-full max-w-2xl items-end gap-2 rounded-md border border-taupe-300 bg-white/95 p-2 shadow-xl shadow-taupe-950/15 inset-shadow-2xs inset-shadow-white/70",
          unavailable ? "opacity-60" : null,
        )}
        onSubmit={(event) => {
          event.preventDefault();
          void submitCue();
        }}
      >
        <MarbleTextarea
          aria-label="Cue message"
          autoFocus
          className="max-h-32 min-h-9 resize-none border-0 bg-transparent px-1 py-1 shadow-none focus:border-b-transparent"
          disabled={unavailable}
          id={CUE_TEXTAREA_ID}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleCueKeyDown}
          placeholder="Ask Marble Agent..."
          rows={1}
          value={draft}
          wrapperClassName="min-w-0 flex-1"
        />
        <button
          aria-label="Send cue"
          className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-zinc-950 text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={draft.trim().length === 0 || unavailable}
          title="Send cue"
          type="submit"
        >
          <PaperPlaneRightIcon
            size={16}
            weight="fill"
          />
        </button>
        <button
          aria-label="Close cue"
          className="flex size-9 shrink-0 items-center justify-center rounded-sm text-taupe-500 transition-colors hover:bg-taupe-100 hover:text-taupe-900"
          onClick={clearCue}
          title="Close cue"
          type="button"
        >
          <XIcon
            size={16}
            weight="bold"
          />
        </button>
      </form>
    </div>
  );
};
