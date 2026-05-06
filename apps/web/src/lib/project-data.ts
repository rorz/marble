import "server-only";

import { createServerMarbleSdk } from "./marble-sdk-server";

type SidebarData = Awaited<
  ReturnType<
    Awaited<ReturnType<typeof createServerMarbleSdk>>["sidebar"]["getData"]
  >
>;
type SidebarProject = SidebarData["projects"][number];

export type ProjectSummary = SidebarProject & {
  tableCount: number;
};

export async function listProjectIndexData() {
  const sdk = await createServerMarbleSdk();
  const data = await sdk.sidebar.getData({});
  const tableCounts = new Map<string, number>();

  for (const table of data.tables) {
    tableCounts.set(
      table.projectId,
      (tableCounts.get(table.projectId) ?? 0) + 1,
    );
  }

  return {
    ownerProfileIds: data.ownerProfileIds,
    projects: data.projects.map((project) => ({
      ...project,
      tableCount: tableCounts.get(project.id) ?? 0,
    })),
    userId: data.userId,
  };
}
