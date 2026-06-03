import { defineTool } from "@earendil-works/pi-coding-agent";
import { z } from "zod";
import { prepareToolSchema } from "./schema";
import {
  type ExplorerState,
  type ProbeExecutor,
  probeAndMerge,
  recordMerge,
  recordRename,
  summarizeModel,
} from "./state";

/**
 * The explorer's tool surface. `read_model` shows the agent the current map;
 * `probe` actively confirms/enriches endpoints in-page (read-only);
 * `rename_resource` + `merge_instance` fix semantic mislabels.
 */

const textResult = (text: string) => ({
  content: [
    {
      text,
      type: "text" as const,
    },
  ],
  details: {
    text,
  },
});

const buildTool = <Schema extends z.ZodType>(config: {
  description: string;
  input: Schema;
  label: string;
  name: string;
  promptSnippet: string;
  run: (input: z.infer<Schema>) => Promise<string> | string;
}): ReturnType<typeof defineTool> => {
  const prepared = prepareToolSchema(z.toJSONSchema(config.input));
  return defineTool({
    description: config.description,
    execute: async (_toolCallId, params) => {
      const raw = prepared.wrapped
        ? (
            params as {
              input: unknown;
            }
          ).input
        : params;
      return textResult(await config.run(config.input.parse(raw)));
    },
    label: config.label,
    name: config.name,
    parameters: prepared.schema as Parameters<
      typeof defineTool
    >[0]["parameters"],
    promptSnippet: config.promptSnippet,
  });
};

export const buildExplorerTools = (
  state: ExplorerState,
  executor: ProbeExecutor,
): ReturnType<typeof defineTool>[] => [
  buildTool({
    description:
      "Return the current reverse-engineered model: surfaces, endpoints, sample counts, and which still lack a captured response.",
    input: z.object({}),
    label: "Read model",
    name: "read_model",
    promptSnippet: "read_model: see the current API map and its gaps.",
    run: () => summarizeModel(state),
  }),
  buildTool({
    description:
      "Send a READ-ONLY request (GET/HEAD/OPTIONS) to the target API in-page with the user's session, and merge the response schema into the model. Path may be relative (/users/123) or absolute.",
    input: z.object({
      method: z.string().describe("HTTP method; read-only methods only."),
      path: z.string().describe("Relative or absolute request path/URL."),
    }),
    label: "Probe endpoint",
    name: "probe",
    promptSnippet: "probe: GET an endpoint and merge its schema (read-only).",
    run: async (input) => (await probeAndMerge(state, executor, input)).summary,
  }),
  buildTool({
    description:
      "Rename a surface to a clearer resource name (e.g. an awkward path segment to a meaningful collection name).",
    input: z.object({
      from: z.string().describe("Current surface name."),
      to: z.string().describe("New surface name."),
    }),
    label: "Rename resource",
    name: "rename_resource",
    promptSnippet: "rename_resource: give a surface a clearer name.",
    run: (input) => {
      recordRename(state, input.from, input.to);
      return `Renamed surface '${input.from}' → '${input.to}'.`;
    },
  }),
  buildTool({
    description:
      "Fold an instance surface (a specific record mistaken for a type, e.g. a username) into its parent collection.",
    input: z.object({
      into: z.string().describe("Parent collection surface to fold into."),
      resource: z.string().describe("Instance surface to fold."),
    }),
    label: "Merge instance",
    name: "merge_instance",
    promptSnippet: "merge_instance: fold an instance surface into its parent.",
    run: (input) => {
      recordMerge(state, input.resource, input.into);
      return `Folded instance surface '${input.resource}' into '${input.into}'.`;
    },
  }),
];
