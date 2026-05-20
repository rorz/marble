import type { ChatEntry, ToolChatEntry } from "./types";
import { STORAGE_KEY } from "./types";

const isDuplicateCompletion = (
  previous: ToolChatEntry | undefined,
  current: ToolChatEntry,
): previous is ToolChatEntry =>
  Boolean(previous) &&
  previous?.toolName === current.toolName &&
  previous.label === current.label &&
  previous.status === current.status &&
  previous.params !== undefined &&
  current.params === undefined;

const dedupeTools = (tools: ToolChatEntry[]): ToolChatEntry[] =>
  tools.reduce<ToolChatEntry[]>((acc, tool) => {
    const previous = acc.at(-1);
    if (isDuplicateCompletion(previous, tool)) {
      acc[acc.length - 1] = {
        ...previous,
        error: previous?.error ?? tool.error,
        result: previous?.result ?? tool.result,
        status: previous?.status ?? tool.status,
      };
      return acc;
    }

    acc.push(tool);
    return acc;
  }, []);

const normalizeEntries = (entries: ChatEntry[]): ChatEntry[] =>
  entries
    .filter(
      (entry) =>
        entry.kind !== "warning" ||
        !entry.message.includes("tools unavailable in this session"),
    )
    .map((entry) =>
      entry.kind === "assistant" && entry.tools
        ? {
            ...entry,
            tools: dedupeTools(entry.tools),
          }
        : entry,
    );

export const loadEntries = (): ChatEntry[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatEntry[];
    if (!Array.isArray(parsed)) return [];
    return normalizeEntries(parsed);
  } catch {
    return [];
  }
};

export const saveEntries = (entries: ChatEntry[]) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(normalizeEntries(entries)),
    );
  } catch {}
};
