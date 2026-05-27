import { marbleOperations } from "@marble/contracts";
import type { MarbleAgentVariant } from "./models";

export type MarbleAgentToolName =
  | "browser_navigate"
  | "request_handoff"
  | "web_fetch"
  | "web_search"
  | `marble_${string}`;

export type MarbleAgentHandoffTarget = MarbleAgentVariant;

type ContractToolCatalog = {
  readonly [ResourceName in keyof typeof marbleOperations]: {
    readonly [OperationName in keyof (typeof marbleOperations)[ResourceName]]: `marble_${string}`;
  };
};

type MarbleAgentRole = {
  handoffTargets: readonly MarbleAgentHandoffTarget[];
  label: string;
  prompt: string;
  tools: readonly MarbleAgentToolName[];
};

type ToolMap = Readonly<Record<string, MarbleAgentToolName>>;
type ContractToolSelection = {
  readonly [ResourceName in keyof ContractToolCatalog]?: readonly (keyof ContractToolCatalog[ResourceName] &
    string)[];
};

const camelToSnake = (input: string): string =>
  input.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

const toContractToolName = (
  resourceName: string,
  operationName: string,
): `marble_${string}` =>
  `marble_${camelToSnake(resourceName)}_${camelToSnake(operationName)}`;

const buildContractToolCatalog = (): ContractToolCatalog =>
  Object.fromEntries(
    Object.entries(marbleOperations).map(([resourceName, operations]) => [
      resourceName,
      Object.fromEntries(
        Object.keys(operations).map((operationName) => [
          operationName,
          toContractToolName(resourceName, operationName),
        ]),
      ),
    ]),
  ) as ContractToolCatalog;

const allTools = <Tools extends ToolMap>(
  toolMap: Tools,
): MarbleAgentToolName[] => Object.values(toolMap);

const MARBLE_AGENT_TOOLS = {
  browserNavigate: "browser_navigate",
  requestHandoff: "request_handoff",
  resources: buildContractToolCatalog(),
  webFetch: "web_fetch",
  webSearch: "web_search",
} as const satisfies {
  browserNavigate: MarbleAgentToolName;
  requestHandoff: MarbleAgentToolName;
  resources: ContractToolCatalog;
  webFetch: MarbleAgentToolName;
  webSearch: MarbleAgentToolName;
};

const allResourceTools = (): MarbleAgentToolName[] =>
  Object.values(MARBLE_AGENT_TOOLS.resources).flatMap(allTools);

const pickResourceTools = (
  selection: ContractToolSelection,
): MarbleAgentToolName[] =>
  Object.entries(selection).flatMap(([resourceName, operationNames]) => {
    const toolMap = MARBLE_AGENT_TOOLS.resources[
      resourceName as keyof ContractToolCatalog
    ] as ToolMap;
    return (operationNames ?? []).map(
      (operationName) => toolMap[operationName],
    );
  });

const MARBLE_AGENT_ROLES = {
  architect: {
    handoffTargets: [
      "concierge",
      "builder",
    ],
    label: "Architect",
    prompt: `
You are a Marble Architect, the deep-work agent for debugging, design planning, debugging, and authoring of complex programs or broad mutations.

> [IMPORTANT!]: STOP! 🚨
> Is the user asking a simple question that can answered expressly and easily? Or are they asking you to do something which is simple or procedural? If so -- your expertise is needed elsewhere! Please handoff this task to a Builder (if it's resource-related) or Concierge (if it's navigational, query-based, or perfunctory) colleague!

Your job is to help research, design, or debug projects and workflows. You are treated as an oracle of Marble and as such you have a reputation to uphold and maintain. Use as much time as you need to ponder and plan a response to a user's query. You are the only agent who has access to the World Wide Web. Use this access to your advantage and ensure you think every design decision through thoroughly before proceeding or reverting back to the user.

NEVER spiral, assume, or chain-of-thought compound ideas WITHOUT first EXPLICITLY re-contacting the user to clarification or help.

When you are done planning or thinking about a task, there is **no need to try to execute it all yourself.** Again, your expertise will be needed elsewhere and that's what your Builder colleagues are for! Concentrate all your concluding efforts on summarising an execution plan that a Builder can parse and "just get on with it". Hand it off as soon as you are ready and able to.
      `,
    tools: [
      // MARBLE_AGENT_TOOLS.browserNavigate,
      MARBLE_AGENT_TOOLS.requestHandoff,
      ...allResourceTools(),
      MARBLE_AGENT_TOOLS.webFetch,
      MARBLE_AGENT_TOOLS.webSearch,
    ],
  },
  builder: {
    handoffTargets: [
      "concierge",
      "architect",
    ],
    label: "Builder",
    prompt: `
You are a Marble Builder, the hands-on agent for execution. Most of your work is concentrated around parsing specs from Architects or fulfilling more straightforward resource requests from Concierges. You don't often interact with users directly -- you prefer to hand this kind of interaction off to your colleagues.

> [IMPORTANT!]: STOP! 🚨
> Is the user asking a simple question that can answered expressly and easily? Or are they asking you to do something which is simple or procedural? If so -- your expertise is needed elsewhere! Please handoff this task to a Concierge colleague! If the user is asking you something that is too left-field or ambiguous for your liking, don't be afraid to approach an Architect colleague for help -- that is what they are here for! Your focus _must_ be on execution and building. You keep this ship ticking after all.

Use all the tools at your disposal to make surgical CRUD operations across the user's Marble base. You are the only agent with access to a lot of these tools, so don't take your responsibility lightly and do think through each operation you're making. If something starts going awry, don't be afraid to poke around a bit broader or more deeply to better understand the context in which you are working.

If it transpires that the work you're doing is actually a bit of an ambiguous iceberg (i.e. a spec that turned out to be gappy, or a design decision that had inaccurate predictions about its effects), do not be afraid to contact the user and ask clarifying questions. If it's all becoming a bit of a mess, go back to the Architect you worked with originally and regroup on next steps.

NEVER ask the user to do things for you. ALWAYS do the engineering yourself.

Once you're done, explain what you did to the user in a friendly, helpful message. Revert back to Concierge for follow-ups.
      `,
    tools: [
      MARBLE_AGENT_TOOLS.browserNavigate,
      MARBLE_AGENT_TOOLS.requestHandoff,
      ...allResourceTools(),
    ],
  },
  concierge: {
    handoffTargets: [
      // "builder",
      "architect",
    ],
    label: "Concierge",
    prompt: `
You are a Marble Concierge, the MVP of the team and the warmest and most helpful of colleagues. You take pride in rapid answers and actions (within your remit) to user queries. You act as a filter for your Builder and Architect colleagues to protect their time and allow them to do involved engineering work, while you help users face-to-face.

> [IMPORTANT!]: STOP! 🚨
> Is the user asking an ambiguous or complex question that cannot answered expressly or easily? Or are they asking you to do something which is not straightforward? If so -- your presence and helpfulness is needed elsewhere! Please handoff this task to a Builder or Architect colleague! The rule of thumb here is: a) A question involving compound, but _well defined_ resource operations goes to a Builder, b) Everything else pretty much goes to an Architect.

Use the tools available to you to make precise and speedy actions and provide responses to surface-level queries. DO NOT converse with your user about product-planning or problems. Save your energy for top-level operations -- you also have a budget for chit-chat too!
`,
    tools: [
      MARBLE_AGENT_TOOLS.browserNavigate,
      MARBLE_AGENT_TOOLS.requestHandoff,
      ...pickResourceTools({
        // cells: [
        //   "get",
        //   "list",
        // ],
        // columns: [
        //   "get",
        //   "list",
        //   "listReferenceable",
        // ],
        // events: [
        //   "listForCurrentUser",
        //   "resolveTargets",
        // ],
        // keys: [
        //   "list",
        // ],
        // pipes: [
        //   "get",
        //   "list",
        // ],
        // profiles: [
        //   "get",
        //   "list",
        // ],
        // programFiles: [
        //   "get",
        //   "list",
        // ],
        // programs: [
        //   "listForEditor",
        // ],
        // projects: [
        //   "get",
        //   "getMostRecentProject",
        //   "list",
        // ],
        // rows: [
        //   "get",
        //   "list",
        // ],
        // secretBindings: [
        //   "listColumns",
        //   "listPrograms",
        // ],
        // secrets: [
        //   "get",
        //   "list",
        // ],
        // sourceEvents: [
        //   "get",
        //   "list",
        // ],
        // sources: [
        //   "get",
        //   "list",
        // ],
        // tables: [
        //   "get",
        //   "list",
        // ],
      } satisfies ContractToolSelection),
    ],
  },
} as const satisfies Record<MarbleAgentVariant, MarbleAgentRole>;

export const resolveAgentRole = (
  variant: MarbleAgentVariant,
): MarbleAgentRole => MARBLE_AGENT_ROLES[variant];

export const resolveAgentRoleLabel = (variant: MarbleAgentVariant): string =>
  resolveAgentRole(variant).label;
