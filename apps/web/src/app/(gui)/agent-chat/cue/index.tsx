"use client";

import { useReducedMotion } from "motion/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useAgentChatSession } from "../context";
import { reportCueTranscriptionError } from "./error";
import {
  type ScribeSession,
  type ScribeStopResult,
  type ScribeTranscriptEvent,
  startScribeSession,
  stopScribeSession,
} from "./scribe";
import {
  CUE_TEXTAREA_ID,
  isCueStartKey,
  isTranscriptionStartKey,
  isTranscriptionStopKey,
} from "./shortcut";
import { CueTranscriptionSurface } from "./surface";
import { appendTranscriptSegment, joinTranscriptDraft } from "./transcript";

type AgentChatCueProps = {
  disabled?: boolean;
  onSubmitStart?: () => void;
};

export const AgentChatCue = ({
  disabled = false,
  onSubmitStart,
}: AgentChatCueProps) => {
  const { sendMessage, streaming } = useAgentChatSession();
  const shouldReduceMotion = useReducedMotion();
  const [draft, setDraft] = useState("");
  const [transcribing, setTranscribing] = useState(false);
  const [visible, setVisible] = useState(false);
  const draftRef = useRef("");
  const scribeBaseRef = useRef("");
  const scribeCommittedRef = useRef("");
  const scribePartialRef = useRef("");
  const scribeStopSequenceRef = useRef(0);
  const scribeSessionRef = useRef<ScribeSession | null>(null);
  const scribeStartingRef = useRef(false);
  const scribeSubmitOnStopRef = useRef(false);
  const scribeStopRequestedRef = useRef(false);
  const unavailable = disabled || streaming;

  const updateDraft = useCallback((nextDraft: string) => {
    draftRef.current = nextDraft;
    setDraft(nextDraft);
  }, []);

  const submitCueText = useCallback(
    async (text: string) => {
      const trimmed = text.trim();

      if (!trimmed || unavailable) {
        return;
      }

      updateDraft("");
      setVisible(false);
      onSubmitStart?.();
      await sendMessage(trimmed, {
        freshThread: true,
      });
    },
    [
      onSubmitStart,
      sendMessage,
      unavailable,
      updateDraft,
    ],
  );

  const handleStoppedTranscription = useCallback(
    (result: ScribeStopResult, sequence: number) => {
      setTranscribing(false);

      if (sequence !== scribeStopSequenceRef.current || !result.capturedAudio) {
        return;
      }

      if (result.reason !== "committed") {
        reportCueTranscriptionError(
          new Error(
            `Speech transcription did not return a final transcript (${result.reason}).`,
          ),
        );
        return;
      }

      void submitCueText(draftRef.current);
    },
    [
      submitCueText,
    ],
  );

  const finishScribeSession = useCallback(
    (session: ScribeSession, submitWhenCommitted: boolean) => {
      const sequence = ++scribeStopSequenceRef.current;
      const stopped = stopScribeSession(session);

      if (!submitWhenCommitted) {
        setTranscribing(false);
        return;
      }

      void stopped
        .then((result) => handleStoppedTranscription(result, sequence))
        .catch((error) => {
          setTranscribing(false);
          reportCueTranscriptionError(error);
        });
    },
    [
      handleStoppedTranscription,
    ],
  );

  const stopCurrentTranscription = useCallback(
    (submitWhenCommitted: boolean) => {
      scribeStopRequestedRef.current = true;
      scribeSubmitOnStopRef.current ||= submitWhenCommitted;
      scribeStartingRef.current = false;

      if (!scribeSessionRef.current) {
        if (!submitWhenCommitted) setTranscribing(false);
        return;
      }

      const session = scribeSessionRef.current;
      scribeSessionRef.current = null;
      finishScribeSession(session, submitWhenCommitted);
    },
    [
      finishScribeSession,
    ],
  );

  const stopTranscribing = useCallback(() => {
    stopCurrentTranscription(false);
  }, [
    stopCurrentTranscription,
  ]);

  const stopAndSubmitTranscription = useCallback(() => {
    stopCurrentTranscription(true);
  }, [
    stopCurrentTranscription,
  ]);

  const handleScribeTranscript = useCallback(
    ({ committed, text }: ScribeTranscriptEvent) => {
      if (committed) {
        scribeCommittedRef.current = appendTranscriptSegment(
          scribeCommittedRef.current,
          text,
        );
        scribePartialRef.current = "";
      } else {
        scribePartialRef.current = text;
      }

      updateDraft(
        joinTranscriptDraft(
          scribeBaseRef.current,
          scribeCommittedRef.current,
          scribePartialRef.current,
        ),
      );
    },
    [
      updateDraft,
    ],
  );

  const startTranscribing = useCallback(async () => {
    if (unavailable || scribeSessionRef.current || scribeStartingRef.current) {
      return;
    }

    scribeBaseRef.current = draftRef.current;
    scribeCommittedRef.current = "";
    scribePartialRef.current = "";
    scribeStartingRef.current = true;
    scribeSubmitOnStopRef.current = false;
    scribeStopRequestedRef.current = false;
    setTranscribing(true);
    setVisible(true);

    try {
      const session = await startScribeSession(
        handleScribeTranscript,
        (error) => {
          reportCueTranscriptionError(error);
          setTranscribing(false);
        },
        () => {
          setTranscribing(false);
          scribeSessionRef.current = null;
        },
      );

      scribeStartingRef.current = false;

      if (scribeStopRequestedRef.current) {
        finishScribeSession(session, scribeSubmitOnStopRef.current);
        return;
      }

      scribeSessionRef.current = session;
    } catch (error) {
      scribeStartingRef.current = false;
      setTranscribing(false);
      reportCueTranscriptionError(error);
    }
  }, [
    finishScribeSession,
    handleScribeTranscript,
    unavailable,
  ]);

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

  const clearCue = useCallback(() => {
    scribeStopSequenceRef.current += 1;
    scribeSubmitOnStopRef.current = false;
    stopTranscribing();
    updateDraft("");
    setVisible(false);
  }, [
    stopTranscribing,
    updateDraft,
  ]);

  const submitCue = useCallback(async () => {
    stopTranscribing();
    await submitCueText(draftRef.current);
  }, [
    stopTranscribing,
    submitCueText,
  ]);

  useEffect(() => {
    if (!unavailable) {
      return;
    }

    stopTranscribing();
  }, [
    stopTranscribing,
    unavailable,
  ]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTranscriptionStartKey(event)) {
        event.preventDefault();
        void startTranscribing();
        return;
      }

      if (visible || unavailable || !isCueStartKey(event)) {
        return;
      }

      event.preventDefault();
      updateDraft(event.key);
      setVisible(true);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (isTranscriptionStopKey(event)) {
        stopAndSubmitTranscription();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", stopTranscribing);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", stopTranscribing);
    };
  }, [
    startTranscribing,
    stopAndSubmitTranscription,
    stopTranscribing,
    unavailable,
    updateDraft,
    visible,
  ]);

  useEffect(
    () => () => stopTranscribing(),
    [
      stopTranscribing,
    ],
  );

  return (
    <CueTranscriptionSurface
      draft={draft}
      onClear={clearCue}
      onDraftChange={updateDraft}
      onSubmit={() => void submitCue()}
      shouldReduceMotion={shouldReduceMotion}
      transcribing={transcribing}
      unavailable={unavailable}
      visible={visible}
    />
  );
};
