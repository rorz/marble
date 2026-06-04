import { defineTool } from "@earendil-works/pi-coding-agent";
import { z } from "zod";
import { prepareToolSchema } from "./schema";
import {
  currentSurfaceNames,
  type ExplorerState,
  hasEndpoint,
  hasSurface,
  type ProbeExecutor,
  probeAndMerge,
  probeTargets,
  recordAddedEndpoint,
  recordAuth,
  recordDrop,
  recordMerge,
  recordOperationName,
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
  executor?: ProbeExecutor,
): ReturnType<typeof defineTool>[] => {
  const tools = [
    buildTool({
      description:
        "Return the current reverse-engineered model: surfaces, endpoints, sample counts, and which still lack a captured response.",
      input: z.object({}),
      label: "Read model",
      name: "read_model",
      promptSnippet: "read_model: see the current API map and its gaps.",
      run: () => summarizeModel(state) + probeTargets(state),
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
        if (!hasSurface(state, input.from)) {
          return `No surface '${input.from}' in the model. Current surfaces: ${currentSurfaceNames(state).join(", ") || "(none — probe to discover endpoints first)"}.`;
        }
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
      promptSnippet:
        "merge_instance: fold an instance surface into its parent.",
      run: (input) => {
        if (!hasSurface(state, input.resource)) {
          return `No surface '${input.resource}' to fold. Current surfaces: ${currentSurfaceNames(state).join(", ") || "(none)"}.`;
        }
        recordMerge(state, input.resource, input.into);
        return `Folded instance surface '${input.resource}' into '${input.into}'.`;
      },
    }),
    buildTool({
      description:
        "Give an operation a precise, unique, camelCase name — this becomes the operationId in the generated oRPC contract and the method name in the SDK/CLI. Use it to kill duplicate names and make the surface read like a hand-authored API (e.g. getPackageProvenance, listVersions).",
      input: z.object({
        method: z.string().describe("HTTP method of the endpoint."),
        name: z
          .string()
          .describe(
            "New camelCase operation name, unique within its resource.",
          ),
        path: z
          .string()
          .describe("Endpoint path template, exactly as shown by read_model."),
      }),
      label: "Name operation",
      name: "name_operation",
      promptSnippet:
        "name_operation: give an endpoint a precise, unique operation name.",
      run: (input) => {
        if (!hasEndpoint(state, input.method, input.path)) {
          return `No endpoint ${input.method.toUpperCase()} ${input.path} in the model — probe it first, or copy the exact method + path from read_model.`;
        }
        recordOperationName(state, input.method, input.path, input.name);
        return `Named ${input.method} ${input.path} → ${input.name}.`;
      },
    }),
    buildTool({
      description:
        "Declare an endpoint the user knows exists but that can't be safely probed — typically a write (POST/PUT/PATCH/DELETE). Adds it to the model (method + path) so the contract isn't limited to the GETs you could probe. Use this when the user asks for a specific endpoint you cannot or should not hit live.",
      input: z.object({
        method: z.string().describe("HTTP method, e.g. POST."),
        path: z
          .string()
          .describe("Path template, e.g. /comment or /items/{id}."),
      }),
      label: "Add endpoint",
      name: "add_endpoint",
      promptSnippet:
        "add_endpoint: declare a known/write endpoint without probing it.",
      run: (input) =>
        recordAddedEndpoint(state, input.method, input.path)
          ? `Added ${input.method.toUpperCase()} ${input.path} to the model.`
          : `Couldn't add '${input.method} ${input.path}' — check the method + path.`,
    }),
    buildTool({
      description:
        "Document how authentication works for this API: the scheme (cookie session / bearer token / API key / CSRF), WHERE the credential lives (which cookie or header), how it's obtained (the login flow), and which surfaces require it. Infer it from how probes behaved (401/403 without a session vs 200 with cookies), the request shapes, and what you know about this product. Write clear markdown — this becomes the auth.md tab.",
      input: z.object({
        notes: z
          .string()
          .describe("Markdown describing how + where the API uses auth."),
      }),
      label: "Record auth",
      name: "record_auth",
      promptSnippet:
        "record_auth: document how + where the API authenticates (markdown).",
      run: (input) => {
        recordAuth(state, input.notes);
        return "Recorded auth notes.";
      },
    }),
    buildTool({
      description:
        "Exclude a noise endpoint from the contract entirely — telemetry, analytics pings, health checks, asset fetches. Keep the surface tight and elite.",
      input: z.object({
        method: z.string().describe("HTTP method of the endpoint."),
        path: z
          .string()
          .describe("Endpoint path template, exactly as shown by read_model."),
      }),
      label: "Drop endpoint",
      name: "drop_endpoint",
      promptSnippet:
        "drop_endpoint: remove a noise endpoint from the contract.",
      run: (input) => {
        if (!hasEndpoint(state, input.method, input.path)) {
          return `No endpoint ${input.method.toUpperCase()} ${input.path} in the model — nothing to drop.`;
        }
        recordDrop(state, input.method, input.path);
        return `Dropped ${input.method} ${input.path} from the contract.`;
      },
    }),
  ];
  if (executor) {
    tools.push(
      buildTool({
        description:
          "Send a READ-ONLY request (GET/HEAD/OPTIONS) to the target in-page with the user's session. Any endpoint that responds is ADDED to the model (its path + query shape), and when the body is JSON its response schema is merged too — so probing is how you grow the map. Path may be relative (/users/123) or absolute.",
        input: z.object({
          method: z.string().describe("HTTP method; read-only methods only."),
          path: z.string().describe("Relative or absolute request path/URL."),
        }),
        label: "Probe endpoint",
        name: "probe",
        promptSnippet:
          "probe: GET an endpoint to add it to the map + merge its schema (read-only).",
        run: async (input) =>
          (await probeAndMerge(state, executor, input)).summary,
      }),
    );
  }
  return tools;
};
