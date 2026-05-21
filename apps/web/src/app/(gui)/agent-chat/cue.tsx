"use client";

import { cx, MarbleTextarea } from "@marble/ui";
import { PaperPlaneRightIcon, XIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
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
  const shouldReduceMotion = useReducedMotion();
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

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          animate={{
            bottom: "-0.5rem",
            opacity: 1,
          }}
          className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4"
          exit={{
            opacity: 0,
            transition: shouldReduceMotion
              ? {
                  duration: 0,
                }
              : {
                  duration: 0.08,
                  ease: "easeOut",
                },
          }}
          initial={
            shouldReduceMotion
              ? {
                  bottom: "-0.5rem",
                  opacity: 1,
                }
              : {
                  bottom: "-5rem",
                  opacity: 0,
                }
          }
          key="agent-chat-cue"
          transition={
            shouldReduceMotion
              ? {
                  duration: 0,
                }
              : {
                  bottom: {
                    damping: 24,
                    mass: 0.7,
                    stiffness: 520,
                    type: "spring",
                  },
                  opacity: {
                    duration: 0.08,
                    ease: "easeOut",
                  },
                }
          }
        >
          <form
            className={cx(
              "pointer-events-auto relative flex w-full max-w-2xl items-start gap-2 rounded-sm border border-taupe-200 bg-white/10 p-2 shadow-xl shadow-taupe-950/15 backdrop-blur-sm inset-shadow-2xs inset-shadow-white/70",
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
              className="max-h-32 min-h-9 resize-none border-0 bg-transparent px-1 py-1 pb-6 shadow-none focus:border-b-transparent"
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
              className="-right-2 -top-2 absolute flex size-6 items-center justify-center rounded-full border border-taupe-200 bg-white/85 text-taupe-500 shadow-md shadow-taupe-950/10 backdrop-blur-sm transition-colors hover:bg-white hover:text-taupe-900"
              onClick={clearCue}
              title="Close cue"
              type="button"
            >
              <XIcon
                size={12}
                weight="bold"
              />
            </button>
          </form>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};
