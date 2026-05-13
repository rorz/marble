export type SidebarMode = "collapsed" | "expanded";

export const SIDEBAR_MODE_COOKIE_NAME = "gui-sidebar-mode";
export const SIDEBAR_TREE_STATE_COOKIE_NAME = "gui-sidebar-tree-state";
export const SIDEBAR_WIDTH_COOKIE_NAME = "gui-sidebar-width";
export const AGENT_SIDEBAR_MODE_COOKIE_NAME = "gui-agent-sidebar-mode";
export const AGENT_SIDEBAR_WIDTH_COOKIE_NAME = "gui-agent-sidebar-width";

export const COLLAPSED_SIDEBAR_WIDTH = 44;
const DEFAULT_SIDEBAR_WIDTH = 260;
export const MIN_SIDEBAR_WIDTH = 190;
export const MAX_SIDEBAR_WIDTH = 380;
const DEFAULT_AGENT_SIDEBAR_WIDTH = 320;
export const COLLAPSED_AGENT_SIDEBAR_WIDTH = 0;
export const MIN_AGENT_SIDEBAR_WIDTH = 260;
export const MAX_AGENT_SIDEBAR_WIDTH = 520;

const SIDEBAR_TREE_STATE_KEY_PATTERN = /^(node|section):[a-z0-9-]+$/i;
const MAX_SIDEBAR_TREE_STATE_KEYS = 64;

export type SidebarTreeState = {
  closedKeys: string[];
  openKeys: string[];
};

const EMPTY_SIDEBAR_TREE_STATE: SidebarTreeState = {
  closedKeys: [],
  openKeys: [],
};

export const clampSidebarWidth = (width: number) => {
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width));
};

export const clampAgentSidebarWidth = (width: number) => {
  return Math.min(
    MAX_AGENT_SIDEBAR_WIDTH,
    Math.max(MIN_AGENT_SIDEBAR_WIDTH, width),
  );
};

export const parseSidebarWidth = (value: null | string | undefined) => {
  if (!value) {
    return DEFAULT_SIDEBAR_WIDTH;
  }

  const width = Number(value);

  return Number.isFinite(width)
    ? clampSidebarWidth(width)
    : DEFAULT_SIDEBAR_WIDTH;
};

export const parseAgentSidebarWidth = (value: null | string | undefined) => {
  if (!value) {
    return DEFAULT_AGENT_SIDEBAR_WIDTH;
  }

  const width = Number(value);

  return Number.isFinite(width)
    ? clampAgentSidebarWidth(width)
    : DEFAULT_AGENT_SIDEBAR_WIDTH;
};

const normalizeSidebarTreeStateKeys = (keys: readonly string[]) => {
  return [
    ...new Set(keys.filter((key) => SIDEBAR_TREE_STATE_KEY_PATTERN.test(key))),
  ]
    .sort()
    .slice(0, MAX_SIDEBAR_TREE_STATE_KEYS);
};

export const parseSidebarTreeState = (value: null | string | undefined) => {
  if (!value) {
    return EMPTY_SIDEBAR_TREE_STATE;
  }

  try {
    const parsed = JSON.parse(value) as {
      closedKeys?: unknown;
      openKeys?: unknown;
    } | null;

    return {
      closedKeys: normalizeSidebarTreeStateKeys(
        Array.isArray(parsed?.closedKeys) ? parsed.closedKeys : [],
      ),
      openKeys: normalizeSidebarTreeStateKeys(
        Array.isArray(parsed?.openKeys) ? parsed.openKeys : [],
      ),
    };
  } catch {
    return EMPTY_SIDEBAR_TREE_STATE;
  }
};

export const serializeSidebarTreeState = (state: SidebarTreeState) => {
  return JSON.stringify({
    closedKeys: normalizeSidebarTreeStateKeys(state.closedKeys),
    openKeys: normalizeSidebarTreeStateKeys(state.openKeys),
  });
};

export const applySidebarTreeState = (
  defaultOpenKeys: ReadonlySet<string>,
  state: SidebarTreeState,
) => {
  const next = new Set(defaultOpenKeys);

  for (const key of state.closedKeys) {
    next.delete(key);
  }

  for (const key of state.openKeys) {
    next.add(key);
  }

  return next;
};

export const updateSidebarTreeStateForKey = (
  state: SidebarTreeState,
  key: string,
  nextIsOpen: boolean,
  defaultOpenKeys: ReadonlySet<string>,
): SidebarTreeState => {
  const openKeys = new Set(state.openKeys);
  const closedKeys = new Set(state.closedKeys);

  openKeys.delete(key);
  closedKeys.delete(key);

  if (nextIsOpen !== defaultOpenKeys.has(key)) {
    if (nextIsOpen) {
      openKeys.add(key);
    } else {
      closedKeys.add(key);
    }
  }

  return {
    closedKeys: normalizeSidebarTreeStateKeys([
      ...closedKeys,
    ]),
    openKeys: normalizeSidebarTreeStateKeys([
      ...openKeys,
    ]),
  };
};
