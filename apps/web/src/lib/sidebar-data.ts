import "server-only";

import { createServerMarbleSdk } from "./marble-sdk-server";
import { buildSidebarTreeData } from "./sidebar-snapshot";
import type { SidebarTreeData } from "./sidebar-tree";

export const listSidebarDataForUser = async (
  _userId: string,
): Promise<SidebarTreeData> => {
  const sdk = await createServerMarbleSdk();
  const snapshot = await sdk.sidebar.getData({});

  return buildSidebarTreeData(snapshot);
};
