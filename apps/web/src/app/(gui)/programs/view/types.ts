import type * as actions from "../actions";
import type { ProgramsPageData } from "../actions";

export type FullProgram = ProgramsPageData["programs"][number];
export type ProgramVersionWithFiles = FullProgram["programVersions"][number];
export type ProgramFile = ProgramVersionWithFiles["programFiles"][number];
export type ProgramVersionMutation = Awaited<
  ReturnType<typeof actions.createDraftVersion>
>["version"];
export type PublishedProgramVersionWithFiles = ProgramVersionWithFiles & {
  publishedAt: string;
  version: number;
};
export type EditableProgramFile = Pick<
  ProgramFile,
  "content" | "filename" | "filetype"
>;
export type MonacoLanguage = "json" | "markdown" | "typescript";
export type LibrarySurface = "marble" | "marketplace" | "mine";
export type PendingChange = {
  badgeTone: "info" | "neutral" | "warning";
  id: string;
  label: string;
  summary: string;
  tag: string;
};
export type SecretRecord = Awaited<ProgramsPageData["secrets"][number]>;
export type SecretBindingInput = Awaited<
  ReturnType<typeof actions.updateProgramSecretBindings>
>[number];
export type MissingSecretConfigurationDetail = {
  missingSecrets: Array<{
    bindingSource: "column" | "implicit" | "program";
    description?: string;
    envName: string;
    label: string;
    required: boolean;
  }>;
  sentinel?: string;
};
export type EditableProgramSecretDeclaration = {
  description: string;
  env: string;
  id: string;
  label: string;
  required: boolean;
};

export const workbenchPanelHeightLimits = {
  draftStack: {
    max: 360,
    min: 180,
  },
  inputSchema: {
    max: 360,
    min: 180,
  },
  outputConfig: {
    max: 360,
    min: 180,
  },
  secrets: {
    max: 280,
    min: 140,
  },
  testInputs: {
    max: 460,
    min: 240,
  },
  versions: {
    max: 360,
    min: 150,
  },
} as const;

export type ResizablePanelId = keyof typeof workbenchPanelHeightLimits;
export type RightWorkbenchPanelId = Exclude<
  ResizablePanelId,
  "draftStack" | "versions"
>;
