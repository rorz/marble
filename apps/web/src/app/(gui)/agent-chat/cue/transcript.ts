export const appendTranscriptSegment = (current: string, next: string) => {
  const trimmedCurrent = current.trim();
  const trimmedNext = next.trim();

  if (!trimmedNext) {
    return trimmedCurrent;
  }

  return trimmedCurrent ? `${trimmedCurrent} ${trimmedNext}` : trimmedNext;
};

export const joinTranscriptDraft = (
  baseText: string,
  committedText: string,
  partialText: string,
) =>
  [
    baseText,
    committedText,
    partialText,
  ]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
