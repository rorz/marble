import type {
  AgentSessionEvent,
  ClientAction,
  createMarbleAgentSession,
  MarbleAgentModelTier,
  MarbleAgentProvider,
} from "@marble/agent";

type AgentSession = Awaited<
  ReturnType<typeof createMarbleAgentSession>
>["session"];

type AgentMessageWithContent = {
  content?: unknown;
  role?: unknown;
};

type AgentMessageContentBlock = {
  type?: unknown;
};

type TextContentBlock = {
  text: string;
  type: "text";
};

type ToolResultContent = {
  text?: unknown;
  type?: unknown;
};

type ToolResultDetails = {
  clientAction?: unknown;
  error?: unknown;
  result?: unknown;
};

type ToolExecutionResult = {
  content?: ToolResultContent[];
  details?: ToolResultDetails;
};

export type AgentChatWireEvent =
  | {
      provider: MarbleAgentProvider;
      type: "marble_session_starting";
    }
  | {
      attempt: number;
      modelId?: string;
      modelTier: MarbleAgentModelTier;
      thinkingLevel?: string;
      type: "marble_agent_tier_start";
    }
  | {
      brief: string;
      fromTier: MarbleAgentModelTier;
      reason: string;
      toTier: MarbleAgentModelTier;
      type: "marble_agent_handoff_requested";
    }
  | {
      type: "marble_session_built" | "marble_session_complete";
    }
  | {
      assistantMessageEvent: {
        delta: string;
        type: "text_delta";
      };
      type: "message_update";
    }
  | {
      content?: string;
      suppress?: boolean;
      type: "message_end";
    }
  | {
      label: string;
      parameters: unknown;
      toolCallId: string;
      toolName: string;
      type: "tool_execution_start";
    }
  | {
      clientAction?: ClientAction;
      isError: boolean;
      message?: string;
      result?: unknown;
      toolCallId: string;
      toolName: string;
      type: "tool_execution_end";
    }
  | {
      elapsedMs: number;
      type: "marble_session_heartbeat";
    }
  | {
      code: string;
      message: string;
      type: "marble_session_error";
    }
  | {
      type: "tool_execution_reconciled";
    };

const isTextContentBlock = (block: unknown): block is TextContentBlock =>
  typeof block === "object" &&
  block !== null &&
  "type" in block &&
  block.type === "text" &&
  "text" in block &&
  typeof block.text === "string";

const extractAssistantText = (message: unknown): string | undefined => {
  const maybeMessage = message as AgentMessageWithContent;
  if (
    !maybeMessage ||
    typeof maybeMessage !== "object" ||
    maybeMessage.role !== "assistant" ||
    !Array.isArray(maybeMessage.content)
  ) {
    return undefined;
  }

  const text = maybeMessage.content
    .filter(isTextContentBlock)
    .map((block) => block.text)
    .join("");

  return text.length > 0 ? text : undefined;
};

const hasContentBlockType = (message: unknown, type: string): boolean => {
  const maybeMessage = message as AgentMessageWithContent;
  if (!Array.isArray(maybeMessage?.content)) return false;
  return maybeMessage.content.some((block: unknown) => {
    const maybeBlock = block as AgentMessageContentBlock;
    return (
      typeof maybeBlock === "object" &&
      maybeBlock !== null &&
      maybeBlock.type === type
    );
  });
};

const asToolExecutionResult = (value: unknown): ToolExecutionResult => {
  if (!value || typeof value !== "object") return {};
  return value as ToolExecutionResult;
};

const extractToolResultText = (
  result: ToolExecutionResult,
): string | undefined => {
  const text = result.content
    ?.filter(isTextContentBlock)
    .map((block) => block.text)
    .join("\n");

  return text && text.length > 0 ? text : undefined;
};

const parseClientAction = (value: unknown): ClientAction | undefined => {
  if (!value || typeof value !== "object") return undefined;
  const action = value as Partial<ClientAction>;
  if (
    action.type === "browser_navigate" &&
    typeof action.href === "string" &&
    (action.replace === undefined || typeof action.replace === "boolean")
  ) {
    return {
      href: action.href,
      replace: action.replace,
      type: "browser_navigate",
    };
  }

  return undefined;
};

export const normalizeAgentEvent = (
  event: AgentSessionEvent,
  session: AgentSession,
): AgentChatWireEvent | undefined => {
  if (
    event.type === "message_update" &&
    event.assistantMessageEvent.type === "text_delta"
  ) {
    return {
      assistantMessageEvent: {
        delta: event.assistantMessageEvent.delta ?? "",
        type: "text_delta",
      },
      type: "message_update",
    };
  }

  if (event.type === "message_end") {
    const maybeMessage = event.message as AgentMessageWithContent;
    if (maybeMessage?.role !== "assistant") return undefined;

    return {
      content: extractAssistantText(event.message),
      suppress: hasContentBlockType(event.message, "toolCall"),
      type: "message_end",
    };
  }

  if (event.type === "tool_execution_start") {
    return {
      label: session.getToolDefinition(event.toolName)?.label ?? event.toolName,
      parameters: event.args,
      toolCallId: event.toolCallId,
      toolName: event.toolName,
      type: "tool_execution_start",
    };
  }

  if (event.type === "tool_execution_end") {
    const result = asToolExecutionResult(event.result);
    const errorMessage =
      typeof result.details?.error === "string"
        ? result.details.error
        : event.isError
          ? (extractToolResultText(result) ?? "Tool failed")
          : undefined;

    return {
      clientAction: parseClientAction(result.details?.clientAction),
      isError: event.isError || errorMessage !== undefined,
      message: errorMessage,
      result: result.details?.result ?? result.details ?? result,
      toolCallId: event.toolCallId,
      toolName: event.toolName,
      type: "tool_execution_end",
    };
  }

  return undefined;
};
