import {
  type EditableProgramFile,
  type PendingChange,
  type ResizablePanelId,
  workbenchPanelHeightLimits,
} from "./types";

export function clampWorkbenchPanelHeight(
  panelId: ResizablePanelId,
  nextHeight: number,
) {
  const { max, min } = workbenchPanelHeightLimits[panelId];

  return Math.min(max, Math.max(min, nextHeight));
}

export function buildFieldsFromSchema(schema: Record<string, unknown>): {
  defaultValue?: string;
  enumValues?: string[];
  key: string;
  title: string;
  type: string;
}[] {
  const properties = (schema?.properties ?? {}) as Record<
    string,
    Record<string, unknown>
  >;

  return Object.entries(properties).map(([key, definition]) => ({
    defaultValue: definition.default as string | undefined,
    enumValues: definition.enum as string[] | undefined,
    key,
    title: (definition.title as string) ?? key,
    type: (definition.type as string) ?? "string",
  }));
}

export function buildPendingChanges({
  files,
  inputSchemaStr,
  isDraftProgram,
  latestFileContentByName,
  latestInputSchemaStr,
  latestOutputConfigStr,
  latestSecretConfigStr,
  outputConfigStr,
  programName,
  savedProgramName,
  secretConfigStr,
}: {
  files: EditableProgramFile[];
  inputSchemaStr: string;
  isDraftProgram: boolean;
  latestFileContentByName: Map<string, string>;
  latestInputSchemaStr: string;
  latestOutputConfigStr: string;
  latestSecretConfigStr: string;
  outputConfigStr: string;
  programName: string;
  savedProgramName: string;
  secretConfigStr: string;
}): PendingChange[] {
  const changes: PendingChange[] = [];
  const nextProgramName = programName.trim() || "Untitled Program";

  if (!isDraftProgram && nextProgramName !== savedProgramName) {
    changes.push({
      badgeTone: "warning",
      id: "rename",
      label: `Rename to ${nextProgramName}`,
      summary:
        "The next saved version will publish under the updated program name.",
      tag: "Rename",
    });
  }

  if (inputSchemaStr !== latestInputSchemaStr) {
    changes.push({
      badgeTone: "warning",
      id: "input-schema",
      label: "Edited input schema",
      summary:
        "Input requirements are staged in the draft until you mint the next version.",
      tag: "Schema",
    });
  }

  if (outputConfigStr !== latestOutputConfigStr) {
    changes.push({
      badgeTone: "warning",
      id: "output-config",
      label: "Edited output config",
      summary:
        "Output mapping changes stay isolated from live columns until save.",
      tag: "Output",
    });
  }

  if (secretConfigStr !== latestSecretConfigStr) {
    changes.push({
      badgeTone: "warning",
      id: "secret-config",
      label: "Updated secret requirements",
      summary:
        "Secret requirements travel with the draft version until you publish it.",
      tag: "Secrets",
    });
  }

  const currentFileNames = new Set(files.map((file) => file.filename));

  for (const file of files) {
    const previousContent = latestFileContentByName.get(file.filename);

    if (previousContent === undefined) {
      changes.push({
        badgeTone: "info",
        id: `file:add:${file.filename}`,
        label: `Added ${file.filename}`,
        summary: "This file will only exist in the next saved version.",
        tag: "Added",
      });
      continue;
    }

    if (previousContent !== file.content) {
      changes.push({
        badgeTone: "warning",
        id: `file:edit:${file.filename}`,
        label: `Edited ${file.filename}`,
        summary:
          "File edits are layered onto the draft stack without touching the saved version.",
        tag: "Edited",
      });
    }
  }

  for (const filename of latestFileContentByName.keys()) {
    if (!currentFileNames.has(filename)) {
      changes.push({
        badgeTone: "warning",
        id: `file:remove:${filename}`,
        label: `Removed ${filename}`,
        summary:
          "The file will disappear only after you save the next version.",
        tag: "Removed",
      });
    }
  }

  if (isDraftProgram && changes.length === 0) {
    changes.push({
      badgeTone: "info",
      id: "draft",
      label: "Draft scaffold",
      summary:
        "Nothing references this workspace until you create the first version.",
      tag: "Draft",
    });
  }

  return changes;
}

export function getDefaultDraftInputSchema() {
  return JSON.stringify(
    {
      properties: {
        param1: {
          type: "string",
        },
      },
      type: "object",
    },
    null,
    2,
  );
}

export function getDefaultDraftOutputConfig() {
  return JSON.stringify(
    {
      schema: {
        type: "object",
      },
    },
    null,
    2,
  );
}
