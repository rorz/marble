import { castCamelKeys } from "@marble/lib/object";
import type { MarbleRouter } from "@marble/ui";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import {
  type MarblePipe,
  type MarbleSource,
  projectTableFromSdkTable,
} from "../../../../../lib/marble-resources";
import { usePrivateBroadcast } from "../../../../../lib/realtime/private-broadcast";
import {
  compareByCreatedAtCamelDesc,
  compareByUpdatedAtCamelDesc,
  removeRow,
  upsertRow,
} from "../../../../../lib/realtime-crud";
import {
  isProjectMutation,
  type ProjectInfo,
  type ProjectState,
} from "./types";

type Sources = MarbleSource[];
type Pipes = MarblePipe[];

type UseProjectBroadcastOptions = {
  project: ProjectState;
  projectRef: MutableRefObject<ProjectState>;
  router: MarbleRouter;
  setNameDraft: Dispatch<SetStateAction<string>>;
  setPipes: Dispatch<SetStateAction<Pipes>>;
  setProject: Dispatch<SetStateAction<ProjectState>>;
  setSources: Dispatch<SetStateAction<Sources>>;
  sourcesRef: MutableRefObject<Sources>;
};

export const useProjectBroadcast = (
  options: UseProjectBroadcastOptions,
): void => {
  const {
    project,
    projectRef,
    router,
    setNameDraft,
    setPipes,
    setProject,
    setSources,
    sourcesRef,
  } = options;

  usePrivateBroadcast({
    event: "project_mutation",
    label: "Project",
    onMessage: (mutation) => {
      if (!isProjectMutation(mutation)) {
        return;
      }

      switch (mutation.type) {
        case "project:delete":
          if (mutation.id === project.id) {
            router.push("/projects");
          }
          break;

        case "project:upsert": {
          const next = castCamelKeys<ProjectState>(mutation.row);

          if (next.id !== project.id) {
            return;
          }

          setProject((current) => ({
            ...current,
            ...next,
            tableCount: current.tableCount,
            tables: current.tables,
          }));
          setNameDraft(next.name);
          break;
        }

        case "table:delete":
          setProject((current) => {
            const tables = removeRow(current.tables, mutation.id);

            return tables.length === current.tables.length
              ? current
              : {
                  ...current,
                  tableCount: tables.length,
                  tables,
                };
          });
          break;

        case "table:upsert":
          setProject((current) => {
            const next = castCamelKeys<ProjectState["tables"][number]>(
              mutation.row,
            );

            if (next.projectId !== current.id) {
              return current;
            }

            const tables = upsertRow(
              current.tables,
              projectTableFromSdkTable(next, current as ProjectInfo["project"]),
              compareByUpdatedAtCamelDesc,
            );

            return {
              ...current,
              tableCount: tables.length,
              tables,
            };
          });
          break;

        case "source:delete":
          setSources((current) => removeRow(current, mutation.id));
          break;

        case "source:upsert": {
          const next = castCamelKeys<MarbleSource>(mutation.row);

          if (next.projectId !== project.id) {
            return;
          }

          setSources((current) =>
            upsertRow(current, next, compareByUpdatedAtCamelDesc),
          );
          break;
        }

        case "pipe:delete":
          setPipes((current) => removeRow(current, mutation.id));
          break;

        case "pipe:upsert": {
          const next = castCamelKeys<MarblePipe>(mutation.row);
          const belongsToProject =
            projectRef.current.tables.some(
              (table) => table.id === next.tableId,
            ) ||
            sourcesRef.current.some((source) => source.id === next.sourceId);

          if (!belongsToProject) {
            return;
          }

          setPipes((current) =>
            upsertRow(current, next, compareByCreatedAtCamelDesc),
          );
          break;
        }
      }
    },
    topic: `project:${project.id}`,
  });
};
