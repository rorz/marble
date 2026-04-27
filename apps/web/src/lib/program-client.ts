import type { Database } from "@marble/supabase";
import { callMarbleClient } from "./marble-client";

type Program = Database["public"]["Tables"]["program"]["Row"];
type ProgramFile = Database["public"]["Tables"]["program_file"]["Row"];
type ProgramVersion = Database["public"]["Tables"]["program_version"]["Row"];
type EditableProgramFile = {
  content: string;
  filename: string;
  filetype: "Json" | "Markdown" | "TypeScript";
};
type ProgramVersionWithFiles = ProgramVersion & {
  files: ProgramFile[];
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

export async function createDefaultProgram() {
  const files = createDefaultProgramFiles(DEFAULT_PROGRAM_NAME);
  const program = await callMarbleClient<
    Program & {
      initialVersion: ProgramVersionWithFiles;
    }
  >("/programs", {
    body: {
      initialVersion: {
        files,
        inputSchema: DEFAULT_PROGRAM_INPUT_SCHEMA,
        outputConfig: DEFAULT_PROGRAM_OUTPUT_CONFIG,
        publish: false,
        secretConfig: [],
      },
      name: DEFAULT_PROGRAM_NAME,
    },
    method: "POST",
  });

  return {
    programId: program.id,
    versionId: program.initialVersion.id,
  };
}
