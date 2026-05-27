import { defineTool } from "@earendil-works/pi-coding-agent";
import { z } from "zod";
import { type MarbleAgentHandoffTarget, resolveAgentRoleLabel } from "../roles";
import { prepareToolSchema } from "./contract/schema";

export type MarbleAgentHandoffRequest = {
  brief: string;
  reason: string;
  variant: MarbleAgentHandoffTarget;
};

export type HandoffToolBuildOptions = {
  handoffTargets: readonly MarbleAgentHandoffTarget[];
  onHandoffRequest: (request: MarbleAgentHandoffRequest) => void;
};

type HandoffToolDetails = {
  handoff?: MarbleAgentHandoffRequest;
  result?: unknown;
};

export const REQUEST_HANDOFF_TOOL_NAME = "request_handoff";

const requestHandoffInput = z.object({
  brief: z
    .string()
    .min(1)
    .describe(
      "Short context the next variant needs to continue the same turn.",
    ),
  reason: z
    .string()
    .min(1)
    .describe("Why another agent variant should continue this turn."),
  variant: z
    .enum([
      "architect",
      "builder",
      "concierge",
    ])
    .describe("The agent variant to continue this user turn."),
});

const formatHandoffTargets = (
  targets: readonly MarbleAgentHandoffTarget[],
): string => targets.map(resolveAgentRoleLabel).join(" or ");

export const buildRequestHandoffTool = ({
  handoffTargets,
  onHandoffRequest,
}: HandoffToolBuildOptions): ReturnType<typeof defineTool> => {
  const prepared = prepareToolSchema(z.toJSONSchema(requestHandoffInput));
  const targetSet = new Set<MarbleAgentHandoffTarget>(handoffTargets);

  return defineTool({
    description: `Ask Marble infrastructure to continue this same user turn with ${formatHandoffTargets(handoffTargets)}. Use this when another variant has the better role, tools, or context for the next move.`,
    execute: async (_toolCallId, params) => {
      const input = requestHandoffInput.parse(
        prepared.wrapped
          ? (
              params as {
                input: unknown;
              }
            ).input
          : params,
      );

      if (!targetSet.has(input.variant)) {
        throw new Error(
          `This session can only hand off to ${formatHandoffTargets(handoffTargets)}.`,
        );
      }

      const handoff: MarbleAgentHandoffRequest = {
        brief: input.brief.trim(),
        reason: input.reason.trim(),
        variant: input.variant,
      };
      onHandoffRequest(handoff);

      return {
        content: [
          {
            text: `Handoff requested to ${resolveAgentRoleLabel(handoff.variant)}. Stop this turn now.`,
            type: "text" as const,
          },
        ],
        details: {
          handoff,
          result: handoff,
        } satisfies HandoffToolDetails,
        terminate: true,
      };
    },
    executionMode: "sequential",
    label: "Request Handoff",
    name: REQUEST_HANDOFF_TOOL_NAME,
    parameters: prepared.schema as Parameters<
      typeof defineTool
    >[0]["parameters"],
    promptGuidelines: [
      `Use request_handoff when this turn should continue on ${formatHandoffTargets(handoffTargets)} instead of being answered by the current variant.`,
      "Call request_handoff as the only tool in the assistant turn, then stop without answering the user.",
      "Use variant=concierge for Concierge, variant=builder for Builder, and variant=architect for Architect.",
    ],
    promptSnippet:
      "request_handoff: move this same user turn to another Marble Agent variant.",
  });
};
