import { cx } from "@marble/ui";
import {
  BriefcaseMetalIcon,
  CaretDownIcon,
  FileCodeIcon,
  IdentificationBadgeIcon,
  KeyIcon,
  RobotIcon,
  TreeStructureIcon,
} from "@phosphor-icons/react/ssr";
import { requireUser } from "../../lib/auth";

export default async function GuiLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireUser();

  const routes = [
    {
      active: false,
      icon: <BriefcaseMetalIcon weight="regular" />,
      name: "Projects",
    },
    {
      active: true,
      icon: <TreeStructureIcon weight="regular" />,
      name: "Sources",
    },
    {
      active: false,
      icon: <RobotIcon weight="regular" />,
      name: "Automations",
    },
    {
      active: false,
      icon: <FileCodeIcon weight="regular" />,
      name: "Programs",
    },
    {
      active: false,
      icon: <IdentificationBadgeIcon weight="regular" />,
      name: "Profiles",
    },
    {
      active: false,
      icon: <KeyIcon weight="regular" />,
      name: "Secrets",
    },
  ];

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[250px_1fr] grid-rows-1 bg-taupe-100">
      {/* <header className="md:col-span-2 w-full p-2 bg-taupe-50">NAV_BAR</header> */}
      <aside className="px-2 pt-6 flex flex-col gap-8 items-start w-full">
        <div className="px-2 flex gap-2 items-center">
          <div className="size-8 bg-taupe-200 rounded-md" />
          <span className="font-medium text-taupe-300">Company</span>
          <CaretDownIcon
            className="text-taupe-300"
            size={12}
            weight="bold"
          />
        </div>
        <div className="flex flex-col gap-0.5 w-full">
          {routes.map((route) => (
            <div
              className={cx(
                "flex gap-1 items-center w-full py-1.5 px-2 rounded-sm cursor-pointer",
                route.active ? "bg-taupe-300/80" : "bg-transparent",
              )}
              key={route.name}
            >
              <div className="size-6 flex items-center justify-center">
                {route.icon}
              </div>
              <span className="text-sm font-medium">{route.name}</span>
            </div>
          ))}
        </div>
        <span className="mt-auto underline text-taupe-700 font-bold">help</span>
      </aside>
      <main className="p-2 bg-transparent pb-8">
        <div className="bg-taupe-50 size-full rounded-md overflow-hidden shadow-md border border-taupe-200">
          {children}
        </div>
      </main>
    </div>
  );
}
