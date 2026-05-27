import { PROGRAM_CONFIG_FILENAME } from "@marble/contracts";
import { stringifyPretty } from "@marble/lib/json";
import type { MarbleClient } from "@marble/sdk";

type EditableProgramFile = {
  content: string;
  filename: string;
  filetype: "Json" | "Markdown" | "TypeScript";
};

const DEFAULT_PROGRAM_NAME = "Untitled Program";
const DEFAULT_PROGRAM_INPUT_SCHEMA = {
  additionalProperties: true,
  properties: {},
  type: "object",
} satisfies Record<string, unknown>;
const DEFAULT_PROGRAM_OUTPUT_CONFIG = {
  flags: {
    allowInference: true,
  },
  schema: {
    additionalProperties: true,
    description: "Program result",
    type: "object",
  },
} satisfies Record<string, unknown>;
const DEFAULT_PROGRAM_CONFIG = {
  inputSchema: DEFAULT_PROGRAM_INPUT_SCHEMA,
  outputConfig: DEFAULT_PROGRAM_OUTPUT_CONFIG,
};
const DEFAULT_PROGRAM_MAIN_FILE = `export default async function ({ input, cell, system }) {
  void cell;
  void system;

  return input;
}
`;

const createDefaultProgramFiles = (name: string): EditableProgramFile[] => {
  return [
    {
      content: `{
  "name": ${JSON.stringify(name)}
}
`,
      filename: "package.json",
      filetype: "Json",
    },
    {
      content: `${stringifyPretty(DEFAULT_PROGRAM_CONFIG)}\n`,
      filename: PROGRAM_CONFIG_FILENAME,
      filetype: "Json",
    },
    {
      content: DEFAULT_PROGRAM_MAIN_FILE,
      filename: "main.ts",
      filetype: "TypeScript",
    },
  ];
};

export const createProgramFromVersion = async (
  sdk: MarbleClient,
  input: {
    files: EditableProgramFile[];
    forkedFromVersionId?: null | string;
    name: string;
    secretConfig: unknown;
  },
) => {
  const program = await sdk.programs.create({
    forkedFromVersionId: input.forkedFromVersionId ?? null,
    initialVersion: {
      publish: false,
      secretConfig: input.secretConfig,
    },
    name: input.name,
  });

  const initialVersion = program.initialVersion;

  if (!initialVersion) {
    throw new Error("Could not create initial program version.");
  }

  await sdk.programFiles.syncForVersion({
    files: input.files,
    versionId: initialVersion.id,
  });

  return {
    programId: program.id,
    versionId: initialVersion.id,
  };
};

export const createDefaultProgram = async (sdk: MarbleClient) => {
  const files = createDefaultProgramFiles(DEFAULT_PROGRAM_NAME);
  return createProgramFromVersion(sdk, {
    files,
    name: DEFAULT_PROGRAM_NAME,
    secretConfig: [],
  });
};
