import {
  type CaretDoubleLeftIcon,
  CaretDoubleRightIcon,
  SidebarIcon,
} from "@phosphor-icons/react";

import type { SidebarMode } from "../../../lib/gui-sidebar";

export const GUI_SIDEBAR_FIRST_PARTY_PROGRAMS_TOPIC =
  "gui-sidebar:first-party-programs";

export const guiSidebarUserTopic = (userId: string) =>
  `gui-sidebar:user:${userId}`;

export const supportSheetWidthClassName = "w-[min(32rem,calc(100vw-1rem))]";

export const sidebarModes = {
  collapsed: {
    asideClassName: "items-center px-0 gap-10",
    brandClassName: "justify-center",
    brandInnerClassName: "justify-center",
    iconOnly: true,
    navClassName: "items-center",
    routeClassName: "w-auto justify-center",
    toggleIcon: CaretDoubleRightIcon,
    toggleLabel: "Expand sidebar",
  },
  expanded: {
    asideClassName: "items-start px-2 gap-8",
    brandClassName: "justify-between gap-2",
    brandInnerClassName: "gap-2",
    iconOnly: false,
    navClassName: "items-stretch",
    routeClassName: "w-full gap-1",
    toggleIcon: SidebarIcon,
    toggleLabel: "Collapse sidebar",
  },
} as const satisfies Record<
  SidebarMode,
  {
    asideClassName: string;
    brandClassName: string;
    brandInnerClassName: string;
    iconOnly: boolean;
    navClassName: string;
    routeClassName: string;
    toggleIcon: typeof CaretDoubleLeftIcon;
    toggleLabel: string;
  }
>;

export const nextSidebarMode: Record<SidebarMode, SidebarMode> = {
  collapsed: "expanded",
  expanded: "collapsed",
};
