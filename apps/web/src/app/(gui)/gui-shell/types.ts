import type { ReactNode } from "react";

export type TreeCollectionKey = "programs" | "projects";

export type SidebarGroup = {
  name: string;
  routes: {
    icon: ReactNode;
    id: string;
    isTree?: boolean;
    name: string;
    path: `/${string}`;
  }[];
}[];

type CommandPaletteItem = {
  detail: string;
  icon: ReactNode;
  id: string;
  keywords: string[];
  label: string;
  onSelect: () => void;
};

export type CommandPaletteSection = {
  heading: string;
  id: string;
  items: CommandPaletteItem[];
};

export type CommandPalettePage =
  | "create-pipe-project"
  | "create-source-project"
  | "create-table-project";

export type SupportSheetView = "contact" | "handbook";
