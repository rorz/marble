"use client";

import { cx } from "@marble/ui";
import {
  BookOpenTextIcon,
  BriefcaseMetalIcon,
  CaretDoubleLeftIcon,
  CaretDoubleRightIcon,
  CaretDownIcon,
  FileCodeIcon,
  IdentificationBadgeIcon,
  KeyIcon,
  LifebuoyIcon,
  RobotIcon,
  TreeStructureIcon,
} from "@phosphor-icons/react";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const routes = [
  {
    icon: (
      <BriefcaseMetalIcon
        size={20}
        weight="regular"
      />
    ),
    name: "Projects",
    path: "/projects",
  },
  {
    icon: (
      <TreeStructureIcon
        size={20}
        weight="regular"
      />
    ),
    name: "Sources",
    path: "/sources",
  },
  {
    icon: (
      <RobotIcon
        size={20}
        weight="regular"
      />
    ),
    name: "Automations",
    path: "/automations",
  },
  {
    icon: (
      <FileCodeIcon
        size={20}
        weight="regular"
      />
    ),
    name: "Programs",
    path: "/programs",
  },
  {
    icon: (
      <IdentificationBadgeIcon
        size={20}
        weight="regular"
      />
    ),
    name: "Profiles",
    path: "/profiles",
  },
  {
    icon: (
      <KeyIcon
        size={20}
        weight="regular"
      />
    ),
    name: "Secrets",
    path: "/secrets",
  },
  {
    icon: (
      <BookOpenTextIcon
        size={28}
        weight="regular"
      />
    ),
    name: "Events",
    path: "/events",
  },
] as const;

type SidebarMode = "collapsed" | "expanded";

const sidebarModes = {
  collapsed: {
    asideClassName: "items-center",
    brandClassName: "justify-center",
    brandInnerClassName: "justify-center",
    gridClassName: "md:grid-cols-[44px_1fr]",
    helpClassName: "justify-center",
    iconOnly: true,
    navClassName: "items-center",
    routeClassName: "w-auto justify-center",
    toggleIcon: CaretDoubleRightIcon,
    toggleLabel: "Expand sidebar",
  },
  expanded: {
    asideClassName: "items-start",
    brandClassName: "justify-between gap-2",
    brandInnerClassName: "gap-2 px-2",
    gridClassName: "md:grid-cols-[190px_1fr]",
    helpClassName: "gap-1",
    iconOnly: false,
    navClassName: "items-stretch",
    routeClassName: "w-full gap-1",
    toggleIcon: CaretDoubleLeftIcon,
    toggleLabel: "Collapse sidebar",
  },
} as const satisfies Record<
  SidebarMode,
  {
    asideClassName: string;
    brandClassName: string;
    brandInnerClassName: string;
    gridClassName: string;
    helpClassName: string;
    iconOnly: boolean;
    navClassName: string;
    routeClassName: string;
    toggleIcon: typeof CaretDoubleLeftIcon;
    toggleLabel: string;
  }
>;

const nextSidebarMode: Record<SidebarMode, SidebarMode> = {
  collapsed: "expanded",
  expanded: "collapsed",
};

export function GuiShell({
  children,
  initialSidebarMode,
}: {
  children: React.ReactNode;
  initialSidebarMode: SidebarMode;
}) {
  const [sidebarMode, setSidebarMode] =
    useState<SidebarMode>(initialSidebarMode);
  const sidebar = sidebarModes[sidebarMode];
  const ToggleIcon = sidebar.toggleIcon;

  const toggleSidebar = () => {
    const nextMode = nextSidebarMode[sidebarMode];

    void fetch("/api/gui/sidebar-mode", {
      body: JSON.stringify({
        mode: nextMode,
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    setSidebarMode(nextMode);
  };

  const pathname = usePathname();
  const topLevelPath = `/${pathname.split("/").at(1)}`;

  return (
    <div
      className={cx(
        "grid min-h-screen grid-cols-1 grid-rows-1 bg-taupe-100 transition-[grid-template-columns] duration-200 ease-out",
        sidebar.gridClassName,
      )}
    >
      <aside
        className={cx(
          "flex w-full flex-col gap-8 px-2 pt-6 transition-[padding] duration-200 ease-out",
          sidebar.asideClassName,
        )}
      >
        <div className={cx("flex w-full items-center", sidebar.brandClassName)}>
          <div className={cx("flex items-center", sidebar.brandInnerClassName)}>
            <div className="size-8 rounded-md bg-taupe-200" />
            {!sidebar.iconOnly ? (
              <>
                <span className="font-medium text-taupe-300">Company</span>
                <CaretDownIcon
                  className="text-taupe-300"
                  size={12}
                  weight="bold"
                />
              </>
            ) : null}
          </div>
          <button
            aria-label={sidebar.toggleLabel}
            className="flex size-8 items-center justify-center rounded-md text-taupe-500 transition-colors hover:bg-taupe-200 hover:text-taupe-800"
            onClick={toggleSidebar}
            title={sidebar.toggleLabel}
            type="button"
          >
            <ToggleIcon
              size={16}
              weight="bold"
            />
          </button>
        </div>
        <nav
          aria-label="Primary"
          className={cx("flex w-full flex-col gap-0.5", sidebar.navClassName)}
        >
          {routes.map((route) => {
            const isActive = topLevelPath === route.path;
            return (
              <Link
                className={cx(
                  "flex items-center rounded-sm px-2 py-0.5 transition-colors text-taupe-700",
                  isActive ? "bg-taupe-300/80" : "bg-transparent",
                  sidebar.routeClassName,
                )}
                href={route.path}
                key={route.name}
                title={sidebar.iconOnly ? route.name : undefined}
              >
                <div className="flex size-6 items-center justify-center">
                  {route.icon}
                </div>
                {!sidebar.iconOnly ? (
                  <span className="text-sm font-medium">{route.name}</span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <button
          className={cx(
            "mt-auto flex items-center rounded-sm px-2 py-1.5 font-bold text-taupe-700 underline transition-colors hover:text-taupe-900",
            sidebar.helpClassName,
          )}
          title={sidebar.iconOnly ? "Help" : undefined}
          type="button"
        >
          <div className="flex size-6 items-center justify-center">
            <LifebuoyIcon
              size={20}
              weight="regular"
            />
          </div>
          {!sidebar.iconOnly ? <span>help</span> : null}
        </button>
      </aside>
      <main className="bg-transparent p-2 pb-8">
        <div className="size-full overflow-hidden rounded-md border border-taupe-200 bg-taupe-50 shadow-md">
          {children}
        </div>
      </main>
    </div>
  );
}
