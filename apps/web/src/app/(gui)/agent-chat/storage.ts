import { normalizeDisplayLabel } from "@marble/lib/string";
import type {
  ChatEntry,
  ChatThread,
  ChatThreadSummary,
  ToolChatEntry,
} from "./types";
import {
  ACTIVE_THREAD_STORAGE_KEY,
  LEGACY_STORAGE_KEY,
  THREADS_STORAGE_KEY,
} from "./types";

const MAX_STORED_THREADS = 24;
const FALLBACK_THREAD_TITLE = "New chat";

type ThreadSnapshot = {
  activeThreadId: string;
  entries: ChatEntry[];
  summaries: ChatThreadSummary[];
};

export const createThreadId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isStoredThread = (value: unknown): value is ChatThread =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.title === "string" &&
  typeof value.createdAt === "number" &&
  typeof value.updatedAt === "number" &&
  Array.isArray(value.entries);

const orderThreads = (threads: ChatThread[]): ChatThread[] =>
  [
    ...threads,
  ].sort((a, b) => b.updatedAt - a.updatedAt);

const summarizeThreads = (threads: ChatThread[]): ChatThreadSummary[] =>
  orderThreads(threads).map(({ createdAt, id, title, updatedAt }) => ({
    createdAt,
    id,
    title,
    updatedAt,
  }));

const deriveThreadTitle = (entries: ChatEntry[]) => {
  const firstUserMessage = entries.find((entry) => entry.kind === "user");
  const collapsed =
    firstUserMessage?.kind === "user"
      ? firstUserMessage.content.replace(/\s+/g, " ").slice(0, 72)
      : undefined;

  return normalizeDisplayLabel(collapsed, FALLBACK_THREAD_TITLE);
};

const readJsonArray = (key: string): unknown[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const readStoredThreads = (): ChatThread[] =>
  readJsonArray(THREADS_STORAGE_KEY)
    .filter(isStoredThread)
    .map((thread) => ({
      ...thread,
      entries: normalizeEntries(thread.entries),
      title: normalizeDisplayLabel(thread.title, FALLBACK_THREAD_TITLE),
    }));

const loadLegacyEntries = (): ChatEntry[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatEntry[];
    if (!Array.isArray(parsed)) return [];
    return normalizeEntries(parsed);
  } catch {
    return [];
  }
};

const readActiveThreadId = () => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_THREAD_STORAGE_KEY);
};

const persistThreads = (threads: ChatThread[], activeThreadId: string) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ACTIVE_THREAD_STORAGE_KEY, activeThreadId);
    window.localStorage.setItem(
      THREADS_STORAGE_KEY,
      JSON.stringify(orderThreads(threads).slice(0, MAX_STORED_THREADS)),
    );
  } catch {}
};

const snapshotFromThreads = (
  threads: ChatThread[],
  activeThreadId: string,
): ThreadSnapshot => ({
  activeThreadId,
  entries:
    threads.find((thread) => thread.id === activeThreadId)?.entries ?? [],
  summaries: summarizeThreads(threads),
});

export const loadThreadSnapshot = (): ThreadSnapshot => {
  const threads = readStoredThreads();
  const storedActiveId = readActiveThreadId();
  const activeThread =
    threads.find((thread) => thread.id === storedActiveId) ??
    orderThreads(threads)[0];

  if (activeThread) {
    return snapshotFromThreads(threads, activeThread.id);
  }

  const legacyEntries = loadLegacyEntries();
  const activeThreadId = createThreadId();
  if (legacyEntries.length === 0) {
    return {
      activeThreadId,
      entries: [],
      summaries: [],
    };
  }

  const now = Date.now();
  const legacyThread: ChatThread = {
    createdAt: now,
    entries: legacyEntries,
    id: activeThreadId,
    title: deriveThreadTitle(legacyEntries),
    updatedAt: now,
  };
  persistThreads(
    [
      legacyThread,
    ],
    activeThreadId,
  );
  return snapshotFromThreads(
    [
      legacyThread,
    ],
    activeThreadId,
  );
};

export const saveActiveThread = (
  activeThreadId: string,
  entries: ChatEntry[],
): ThreadSnapshot => {
  const normalizedEntries = normalizeEntries(entries);
  const existingThreads = readStoredThreads();
  const existingThread = existingThreads.find(
    (thread) => thread.id === activeThreadId,
  );
  const remainingThreads = existingThreads.filter(
    (thread) => thread.id !== activeThreadId,
  );

  const nextThreads =
    normalizedEntries.length === 0
      ? remainingThreads
      : [
          {
            createdAt: existingThread?.createdAt ?? Date.now(),
            entries: normalizedEntries,
            id: activeThreadId,
            title: deriveThreadTitle(normalizedEntries),
            updatedAt: Date.now(),
          },
          ...remainingThreads,
        ];

  persistThreads(nextThreads, activeThreadId);
  return snapshotFromThreads(nextThreads, activeThreadId);
};

export const openStoredThread = (threadId: string): ThreadSnapshot => {
  const threads = readStoredThreads();
  const activeThread = threads.find((thread) => thread.id === threadId);

  if (!activeThread) {
    return loadThreadSnapshot();
  }

  persistThreads(threads, threadId);
  return snapshotFromThreads(threads, threadId);
};

export const deleteStoredThread = (
  threadId: string,
  activeThreadId: string,
): ThreadSnapshot & {
  removedActiveThread: boolean;
} => {
  const threads = readStoredThreads();
  const nextThreads = threads.filter((thread) => thread.id !== threadId);
  const removedActiveThread = threadId === activeThreadId;
  const nextActiveThreadId = removedActiveThread
    ? (orderThreads(nextThreads)[0]?.id ?? createThreadId())
    : activeThreadId;

  persistThreads(nextThreads, nextActiveThreadId);
  return {
    ...snapshotFromThreads(nextThreads, nextActiveThreadId),
    removedActiveThread,
  };
};
