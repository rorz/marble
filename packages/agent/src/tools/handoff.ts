import { defineTool } from "@earendil-works/pi-coding-agent";
import { z } from "zod";
import type { MarbleAgentModelTier } from "../models";
import { prepareToolSchema } from "../schema";

export type MarbleAgentHandoffTarget = Extract<
  MarbleAgentModelTier,
  "expert" | "standard"
>;

export type MarbleAgentHandoffRequest = {
  brief: string;
  reason: string;
  tier: MarbleAgentHandoffTarget;
};

export type HandoffToolBuildOptions = {
  handoffTargets: MarbleAgentHandoffTarget[];
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
    .describe("Short context the next tier needs to continue the same turn."),
  reason: z
    .string()
    .min(1)
    .describe("Why this turn needs a stronger agent tier."),
  tier: z
    .enum([
      "standard",
      "expert",
    ])
    .describe("The stronger agent tier to continue this user turn."),
});

const formatHandoffTargets = (targets: MarbleAgentHandoffTarget[]): string =>
  targets.join(" or ");

export const buildRequestHandoffTool = ({
  handoffTargets,
  onHandoffRequest,
}: HandoffToolBuildOptions): ReturnType<typeof defineTool> => {
  const prepared = prepareToolSchema(z.toJSONSchema(requestHandoffInput));
  const targetSet = new Set<MarbleAgentHandoffTarget>(handoffTargets);

  return defineTool({
    description: `Ask Marble infrastructure to continue this same user turn with the ${formatHandoffTargets(handoffTargets)} tier. Use this for work that needs more reasoning or orchestration than the current tier should spend.`,
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

      if (!targetSet.has(input.tier)) {
        throw new Error(
          `This session can only hand off to ${formatHandoffTargets(handoffTargets)}.`,
        );
      }

      const handoff: MarbleAgentHandoffRequest = {
        brief: input.brief.trim(),
        reason: input.reason.trim(),
        tier: input.tier,
      };
      onHandoffRequest(handoff);

      return {
        content: [
          {
            text: `Handoff requested to ${handoff.tier}. Stop this turn now.`,
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
      `Use request_handoff when this turn should continue on ${formatHandoffTargets(handoffTargets)} instead of being answered by the current tier.`,
      "Call request_handoff as the only tool in the assistant turn, then stop without answering the user.",
      "Use standard for bounded multi-step assistant work. Use expert for orchestration, coordination, ambiguous workflows, or risky broad mutations.",
    ],
    promptSnippet:
      "request_handoff: escalate this same user turn to a stronger Marble Agent tier.",
  });
};
