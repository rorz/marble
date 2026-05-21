"use client";

import { cx, MarbleTextarea } from "@marble/ui";
import { PaperPlaneRightIcon, XIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { type KeyboardEvent, type ReactNode, useLayoutEffect } from "react";
import { CueTranscriptionIndicator } from "./indicator";
import { CUE_TEXTAREA_ID } from "./shortcut";

type CueTranscriptionSurfaceProps = {
  draft: string;
  onClear: () => void;
  onDraftChange: (draft: string) => void;
  onSubmit: () => void;
  shouldReduceMotion: boolean | null;
  transcribing: boolean;
  unavailable: boolean;
  visible: boolean;
};

const stopEscapeOrSubmit = (
  event: KeyboardEvent<HTMLTextAreaElement>,
  onClear: () => void,
  onSubmit: () => void,
) => {
  if (event.key === "Escape") {
    event.preventDefault();
    onClear();
    return;
  }

  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    onSubmit();
  }
};

const motionValue = <TValue,>(
  reduced: boolean | null,
  animated: TValue,
  still: TValue,
) => (reduced ? still : animated);

export const CueTranscriptionSurface = ({
  draft,
  onClear,
  onDraftChange,
  onSubmit,
  shouldReduceMotion,
  transcribing,
  unavailable,
  visible,
}: CueTranscriptionSurfaceProps): ReactNode => {
  useLayoutEffect(() => {
    if (!visible) return;

    const input = document.getElementById(CUE_TEXTAREA_ID);
    if (!(input instanceof HTMLTextAreaElement)) return;

    const cursorPosition = input.value.length;
    input.focus();
    input.setSelectionRange(cursorPosition, cursorPosition);
  }, [
    visible,
  ]);

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
            transition: motionValue(
              shouldReduceMotion,
              {
                duration: 0.08,
                ease: "easeOut",
              },
              {
                duration: 0,
              },
            ),
          }}
          initial={motionValue(
            shouldReduceMotion,
            {
              bottom: "-5rem",
              opacity: 0,
            },
            {
              bottom: "-0.5rem",
              opacity: 1,
            },
          )}
          key="agent-chat-cue"
          transition={motionValue(
            shouldReduceMotion,
            {
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
            },
            {
              duration: 0,
            },
          )}
        >
          <form
            aria-busy={transcribing}
            className={cx(
              "pointer-events-auto relative flex w-full max-w-2xl items-start gap-2 rounded-sm border border-taupe-200 bg-white/10 p-2 shadow-xl shadow-taupe-950/15 backdrop-blur-sm inset-shadow-2xs inset-shadow-white/70",
              unavailable ? "opacity-60" : null,
            )}
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit();
            }}
          >
            <CueTranscriptionIndicator
              active={transcribing}
              shouldReduceMotion={shouldReduceMotion}
            />
            <MarbleTextarea
              aria-label="Cue message"
              autoFocus
              className="max-h-32 min-h-9 resize-none border-0 bg-transparent px-1 py-1 pb-6 shadow-none focus:border-b-transparent"
              disabled={unavailable}
              id={CUE_TEXTAREA_ID}
              onChange={(event) => onDraftChange(event.target.value)}
              onKeyDown={(event) =>
                stopEscapeOrSubmit(event, onClear, onSubmit)
              }
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
              onClick={onClear}
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
