import type { ChatEntry } from "./types";

export const buildConversationHistory = (entries: ChatEntry[]) =>
  entries
    .filter(
      (
        entry,
      ): entry is Extract<
        ChatEntry,
        {
          kind: "assistant" | "user";
        }
      > => entry.kind === "assistant" || entry.kind === "user",
    )
    .slice(-12)
    .map((entry) => ({
      content: entry.content,
      role: entry.kind,
    }));
