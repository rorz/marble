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

function createDefaultProgramFiles(name: string): EditableProgramFile[] {
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
}

export async function createDefaultProgram(sdk: MarbleClient) {
  const files = createDefaultProgramFiles(DEFAULT_PROGRAM_NAME);
  const program = await sdk.programs.create({
    initialVersion: {
      inputSchema: DEFAULT_PROGRAM_INPUT_SCHEMA,
      outputConfig: DEFAULT_PROGRAM_OUTPUT_CONFIG,
      publish: false,
      secretConfig: [],
    },
    name: DEFAULT_PROGRAM_NAME,
  });

  const initialVersion = program.initialVersion;

  if (!initialVersion) {
    throw new Error("Could not create initial program version.");
  }

  await sdk.programFiles.syncForVersion({
    files,
    versionId: initialVersion.id,
  });

  return {
    programId: program.id,
    versionId: initialVersion.id,
  };
}
