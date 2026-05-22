"use client";

import { ActionsSection } from "./actions";
import { CommandsSection } from "./commands";
import { sectionLinks } from "./constants";
import { FormsSection } from "./forms";
import { MenusSection } from "./menus";
import { NavigationSection } from "./navigation";
import { OverlaysSection } from "./overlays";
import { SurfacesSection } from "./surfaces";
import { TokensSection } from "./tokens";
import { UploadsSection } from "./uploads";

export const UiView = () => {
  return (
    <main className="min-h-screen bg-white px-6 py-8 text-taupe-800">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <header className="space-y-3">
          <p className="font-medium text-eyebrow-lg text-orange-600">
            Marble UI
          </p>
          <h1 className="font-semibold text-3xl tracking-tight text-taupe-950">
            Kitchen Sink
          </h1>
          <p className="max-w-2xl text-sm text-taupe-600">
            Full variant coverage for the shared `@marble/ui` primitives, with
            the page flattened back into a simpler single-column reference.
          </p>
          <div className="flex flex-wrap gap-2">
            {sectionLinks.map((link) => (
              <a
                className="rounded-xs border border-taupe-200 bg-white px-3 py-1.5 font-medium text-xs text-taupe-700 transition-colors hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700"
                href={`#${link.id}`}
                key={link.id}
              >
                {link.label}
              </a>
            ))}
          </div>
        </header>

        <TokensSection />
        <ActionsSection />
        <SurfacesSection />
        <FormsSection />
        <UploadsSection />
        <NavigationSection />
        <MenusSection />
        <CommandsSection />
        <OverlaysSection />
      </div>
    </main>
  );
};
