import type { ChatEntry, ToolChatEntry } from "./types";

export const randomId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

type ErrorEntry = Extract<
  ChatEntry,
  {
    kind: "error";
  }
>;

const isAssistantWithTools = (
  entry: ChatEntry | undefined,
): entry is Extract<
  ChatEntry,
  {
    kind: "assistant";
  }
> => entry?.kind === "assistant" && Boolean(entry.tools?.length);

export const appendErrorEntry = (
  entries: ChatEntry[],
  error: Omit<ErrorEntry, "id" | "kind">,
): ChatEntry[] => [
  ...entries,
  {
    ...error,
    id: randomId(),
    kind: "error",
  },
];

export const closePendingToolEntries = (
  entries: ChatEntry[],
  options: {
    error?: string;
    status: "complete" | "error";
  },
): ChatEntry[] =>
  entries.map((entry) => {
    if (entry.kind === "tool" && entry.status === "pending") {
      return {
        ...entry,
        error: options.error,
        status: options.status,
      };
    }

    if (entry.kind !== "assistant" || !entry.tools) return entry;

    return {
      ...entry,
      streaming: false,
      thinkingDurationMs:
        entry.thinkingDurationMs ??
        (entry.thinkingStartedAt
          ? Date.now() - entry.thinkingStartedAt
          : undefined),
      tools: entry.tools.map((tool) =>
        tool.status === "pending"
          ? {
              ...tool,
              error: options.error,
              status: options.status,
            }
          : tool,
      ),
    };
  });

export const commitFinalAssistantMessage = (
  entries: ChatEntry[],
  finalContent: string,
): ChatEntry[] => {
  const lastEntry = entries.at(-1);
  if (
    lastEntry?.kind === "assistant" &&
    (lastEntry.streaming ||
      lastEntry.content === finalContent ||
      finalContent.startsWith(lastEntry.content) ||
      Boolean(lastEntry.tools?.length))
  ) {
    return entries.map((entry) =>
      entry.id === lastEntry.id && entry.kind === "assistant"
        ? {
            ...entry,
            content: finalContent,
            streaming: false,
            thinkingDurationMs:
              entry.thinkingDurationMs ??
              (entry.thinkingStartedAt
                ? Date.now() - entry.thinkingStartedAt
                : undefined),
          }
        : entry,
    );
  }

  return [
    ...entries,
    {
      content: finalContent,
      id: randomId(),
      kind: "assistant",
      streaming: false,
    },
  ];
};

export const appendToolToAssistantTurn = (
  entries: ChatEntry[],
  tool: ToolChatEntry,
  assistantId?: null | string,
): {
  assistantId: string;
  entries: ChatEntry[];
} => {
  if (assistantId) {
    let found = false;
    const nextEntries = entries.map((entry) => {
      if (entry.kind !== "assistant" || entry.id !== assistantId) {
        return entry;
      }
      found = true;
      return {
        ...entry,
        streaming: true,
        tools: [
          ...(entry.tools ?? []),
          tool,
        ],
      };
    });

    if (found) {
      return {
        assistantId,
        entries: nextEntries,
      };
    }
  }

  const lastEntry = entries.at(-1);
  if (lastEntry?.kind === "assistant") {
    return {
      assistantId: lastEntry.id,
      entries: entries.map((entry) =>
        entry.id === lastEntry.id && entry.kind === "assistant"
          ? {
              ...entry,
              streaming: true,
              tools: [
                ...(entry.tools ?? []),
                tool,
              ],
            }
          : entry,
      ),
    };
  }

  const newAssistantId = randomId();
  return {
    assistantId: newAssistantId,
    entries: [
      ...entries,
      {
        content: "",
        id: newAssistantId,
        kind: "assistant",
        streaming: true,
        tools: [
          tool,
        ],
      },
    ],
  };
};

export const suppressAssistantText = (
  entries: ChatEntry[],
  assistantId: null | string,
): ChatEntry[] => {
  if (!assistantId) return entries;

  return entries.flatMap((entry) => {
    if (entry.kind !== "assistant" || entry.id !== assistantId) {
      return [
        entry,
      ];
    }

    if (isAssistantWithTools(entry)) {
      return [
        {
          ...entry,
          streaming: true,
        },
      ];
    }

    return [];
  });
};

export const updateToolEntry = (
  entries: ChatEntry[],
  toolEntryId: string,
  update: Partial<ToolChatEntry>,
): {
  entries: ChatEntry[];
  found: boolean;
} => {
  let found = false;
  const nextEntries = entries.map((entry) => {
    if (entry.kind === "tool" && entry.id === toolEntryId) {
      found = true;
      return {
        ...entry,
        ...update,
      };
    }

    if (entry.kind !== "assistant" || !entry.tools) return entry;

    return {
      ...entry,
      tools: entry.tools.map((tool) => {
        if (tool.id !== toolEntryId) return tool;
        found = true;
        return {
          ...tool,
          ...update,
        };
      }),
    };
  });

  return {
    entries: nextEntries,
    found,
  };
};

const closeStreamingAssistantEntries = (entries: ChatEntry[]): ChatEntry[] =>
  entries.map((entry) =>
    entry.kind === "assistant" && entry.streaming
      ? {
          ...entry,
          streaming: false,
        }
      : entry,
  );

export const closeActiveRunEntries = (
  entries: ChatEntry[],
  options: {
    error?: string;
    status: "complete" | "error";
  },
): ChatEntry[] =>
  closePendingToolEntries(closeStreamingAssistantEntries(entries), options);
