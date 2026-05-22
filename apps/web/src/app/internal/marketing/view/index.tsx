"use client";

import { MarketingCodeMark } from "../../../homepage/ui/code-block";
import { SECTIONS } from "./constants";
import { ControlShowcases } from "./controls";
import { FoundationShowcases } from "./foundation";
import { MotionShowcases } from "./motion";
import { SurfaceShowcases } from "./surfaces";
import { SystemShowcases } from "./systems";

export const MarketingShowcaseView = () => {
  return (
    <main className="min-h-screen bg-taupe-100">
      <header className="border-b-2 border-taupe-300 bg-taupe-50 px-6 py-8 md:px-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-4">
          <span className="font-mono text-eyebrow text-taupe-700">
            INTERNAL · MARKETING UI CATALOG
          </span>
          <h1 className="font-display font-medium text-5xl tracking-tight text-taupe-950 md:text-7xl">
            Marketing primitives
          </h1>
          <p className="max-w-2xl text-base text-taupe-700 md:text-lg">
            Every primitive from{" "}
            <MarketingCodeMark>
              apps/web/src/app/homepage/ui/*
            </MarketingCodeMark>
            demoed in one place. Distinct from{" "}
            <a
              className="underline decoration-orange-400 underline-offset-2 hover:text-orange-600"
              href="/internal/ui"
            >
              /internal/ui
            </a>{" "}
            (the app design system). Marketing primitives live{" "}
            <strong>outside</strong> <code>@marble/ui</code> by convention (see{" "}
            <code>AGENTS.md</code> rule 7).
          </p>
          <nav className="flex flex-wrap gap-2">
            {SECTIONS.map((section) => (
              <a
                className="rounded-full border-2 border-taupe-300 bg-taupe-100 px-3 py-1 font-mono text-eyebrow-xs text-taupe-700 transition-colors hover:border-orange-500 hover:bg-orange-100 hover:text-orange-700"
                href={`#${section.id}`}
                key={section.id}
              >
                {section.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-12 md:px-10">
        <FoundationShowcases />
        <SurfaceShowcases />
        <SystemShowcases />
        <ControlShowcases />
        <MotionShowcases />
      </div>
    </main>
  );
};
