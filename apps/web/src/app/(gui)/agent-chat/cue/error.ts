import { getErrorMessage } from "@marble/lib/result";
import { marbleToast } from "@marble/ui";

export const reportCueTranscriptionError = (error: unknown) => {
  console.error("[agent-chat/cue] speech transcription failed", error);
  marbleToast.error("Speech transcription failed", {
    description: getErrorMessage(error),
  });
};
