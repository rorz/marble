import type { SidebarMode } from "../../../../lib/gui-sidebar";
import type { sidebarModes } from "../constants";

export type SidebarChrome = (typeof sidebarModes)[SidebarMode];
