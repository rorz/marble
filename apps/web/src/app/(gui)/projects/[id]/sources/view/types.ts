import type { ProjectSourceWorkspaceData } from "../../../../../../lib/source-data";

export type Source = ProjectSourceWorkspaceData["sources"][number];
export type SourceEvent = ProjectSourceWorkspaceData["sourceEvents"][number];
export type SourceEditingSurface = null | "crumb" | "title";
export type SourceSchemaValidation =
  | {
      ok: true;
      value: unknown;
    }
  | {
      message: string;
      ok: false;
    };
