type ErrorCode =
  | "PROMPT_FAILED"
  | "PROVIDER_TIMEOUT"
  | "SESSION_INIT_FAILED"
  | "STREAM_ABRUPT_END"
  | "STREAM_NO_RESPONSE"
  | "STREAM_PARSE_FAILED"
  | "TRANSPORT_FAILED";

export type ChatEntry =
  | {
      content: string;
      id: string;
      kind: "user";
    }
  | {
      content: string;
      id: string;
      kind: "assistant";
      streaming: boolean;
      thinking?: string;
      tools?: ToolChatEntry[];
    }
  | ToolChatEntry
  | {
      code?: ErrorCode | string;
      details?: unknown;
      id: string;
      kind: "error";
      message: string;
    }
  | {
      id: string;
      kind: "warning";
      message: string;
    };

export type ChatThreadSummary = {
  createdAt: number;
  id: string;
  title: string;
  updatedAt: number;
};

export type ChatThread = ChatThreadSummary & {
  entries: ChatEntry[];
};

export type ClientAction = {
  href: string;
  replace?: boolean;
  type: "browser_navigate";
};

export type ToolChatEntry = {
  error?: string;
  id: string;
  kind: "tool";
  label: string;
  params: unknown;
  result?: unknown;
  status: "complete" | "error" | "pending";
  toolCallId?: string;
  toolName: string;
};

export type StreamEvent = {
  assistantMessageEvent?: {
    delta?: string;
    type?: string;
  };
  clientAction?: ClientAction;
  code?: string;
  elapsedMs?: number;
  isError?: boolean;
  label?: string;
  message?: string;
  modelTier?: "expert" | "rapid" | "standard";
  content?: string;
  brief?: string;
  fromTier?: "expert" | "rapid" | "standard";
  parameters?: unknown;
  reason?: string;
  result?: unknown;
  route?: "agent" | "direct";
  suppress?: boolean;
  toTier?: "expert" | "rapid" | "standard";
  toolCallId?: string;
  toolName?: string;
  type: string;
};

export type AgentChatPageContext = {
  currentResource?: {
    href: string;
    id: string;
    kind: "pipe" | "program" | "project" | "source" | "table";
    label: string;
    parent?: {
      href: string;
      id: string;
      kind: "project";
      label: string;
    };
  };
  pathname: string;
  search: string;
};

export type ParseOutcome =
  | {
      kind: "ignored";
    }
  | {
      error: string;
      kind: "parse_error";
      raw: string;
    }
  | {
      event: StreamEvent;
      kind: "ok";
    };

export const IDLE_WATCHDOG_MS = 30000;
export const ACTIVE_THREAD_STORAGE_KEY = "marble-agent-chat-active-thread";
export const LEGACY_STORAGE_KEY = "marble-agent-chat-thread";
export const THREADS_STORAGE_KEY = "marble-agent-chat-threads";

export const ERROR_CODE_DESCRIPTIONS: Record<string, string> = {
  PROMPT_FAILED: "The LLM call failed mid-stream.",
  PROVIDER_TIMEOUT: "The provider didn't respond within the timeout window.",
  SESSION_INIT_FAILED: "The agent couldn't start.",
  STREAM_ABRUPT_END:
    "The server's stream closed without finishing. The model or a tool may have crashed silently.",
  STREAM_NO_RESPONSE: "No activity from the server for 30s.",
  STREAM_PARSE_FAILED: "The server sent something the client couldn't parse.",
  TRANSPORT_FAILED: "The request couldn't reach the server (or got rejected).",
};
