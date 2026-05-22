import { useMemo, useState } from "react";
import {
  applySidebarTreeState,
  type SidebarMode,
  type SidebarTreeState,
  updateSidebarTreeStateForKey,
} from "../../../lib/gui-sidebar";
import type { SidebarTreeData } from "../../../lib/sidebar-tree";
import type { ChangeTargetDescriptor } from "../change-spotlight";
import { buildDefaultSidebarOpenKeys } from "./nodes";

type SidebarTreeParams = {
  initialSidebarTreeState: SidebarTreeState;
  pathname: string;
  previewDescriptors: ChangeTargetDescriptor[];
  selectedProgramId: string | null;
  sidebarData: SidebarTreeData;
  sidebarMode: SidebarMode;
};

const persistSidebarTreeState = (nextState: SidebarTreeState) => {
  void fetch("/api/gui/sidebar-mode", {
    body: JSON.stringify({
      treeState: nextState,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
};

export const useSidebarTree = ({
  initialSidebarTreeState,
  pathname,
  previewDescriptors,
  selectedProgramId,
  sidebarData,
  sidebarMode,
}: SidebarTreeParams) => {
  const [sidebarTreeState, setSidebarTreeState] = useState<SidebarTreeState>(
    initialSidebarTreeState,
  );
  const projectIdByChildId = useMemo(() => {
    const next = new Map<string, string>();

    for (const project of sidebarData.projects) {
      for (const child of project.children) {
        if (
          child.kind === "table" ||
          child.kind === "source" ||
          child.kind === "pipe"
        ) {
          next.set(child.id, project.id);
        }
      }
    }

    return next;
  }, [
    sidebarData.projects,
  ]);
  const defaultOpenKeys = useMemo(
    () =>
      buildDefaultSidebarOpenKeys({
        pathname,
        selectedProgramId,
        sidebarData,
        sidebarMode,
      }),
    [
      pathname,
      selectedProgramId,
      sidebarData,
      sidebarMode,
    ],
  );
  const previewOpenKeys = useMemo(() => {
    const next = new Set<string>();

    for (const descriptor of previewDescriptors) {
      if (
        descriptor.kind === "project" ||
        descriptor.kind === "table" ||
        descriptor.kind === "source" ||
        descriptor.kind === "pipe" ||
        descriptor.kind === "row" ||
        descriptor.kind === "column" ||
        descriptor.kind === "cell"
      ) {
        next.add("section:projects");
      }

      if (
        descriptor.kind === "program" ||
        descriptor.kind === "program-file" ||
        descriptor.kind === "program-version"
      ) {
        next.add("section:programs");
      }

      if (descriptor.kind === "project") {
        next.add(`node:${descriptor.projectId}`);
      }

      if (descriptor.kind === "table") {
        const projectId = projectIdByChildId.get(descriptor.tableId);

        if (projectId) {
          next.add(`node:${projectId}`);
        }
      }

      if (descriptor.kind === "source") {
        const projectId = projectIdByChildId.get(descriptor.sourceId);

        if (projectId) {
          next.add(`node:${projectId}`);
        }
      }

      if (descriptor.kind === "pipe") {
        const projectId = projectIdByChildId.get(descriptor.pipeId);

        if (projectId) {
          next.add(`node:${projectId}`);
        }
      }
    }

    return next;
  }, [
    previewDescriptors,
    projectIdByChildId,
  ]);
  const effectiveOpenKeys = useMemo(
    () =>
      new Set([
        ...applySidebarTreeState(defaultOpenKeys, sidebarTreeState),
        ...previewOpenKeys,
      ]),
    [
      defaultOpenKeys,
      previewOpenKeys,
      sidebarTreeState,
    ],
  );
  const toggleOpen = (key: string) => {
    setSidebarTreeState((current) => {
      const nextState = updateSidebarTreeStateForKey(
        current,
        key,
        !applySidebarTreeState(defaultOpenKeys, current).has(key),
        defaultOpenKeys,
      );

      persistSidebarTreeState(nextState);

      return nextState;
    });
  };

  return {
    effectiveOpenKeys,
    toggleOpen,
  };
};
