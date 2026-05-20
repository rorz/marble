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
    inputSchema: unknown;
    name: string;
    outputConfig: unknown;
    secretConfig: unknown;
  },
) => {
  const program = await sdk.programs.create({
    forkedFromVersionId: input.forkedFromVersionId ?? null,
    initialVersion: {
      inputSchema: input.inputSchema,
      outputConfig: input.outputConfig,
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
    inputSchema: DEFAULT_PROGRAM_INPUT_SCHEMA,
    name: DEFAULT_PROGRAM_NAME,
    outputConfig: DEFAULT_PROGRAM_OUTPUT_CONFIG,
    secretConfig: [],
  });
};
