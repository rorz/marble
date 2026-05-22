import { DemoPanel, Section } from "./chrome";

export const TokensSection = () => {
  return (
    <Section
      // harness-ignore: no-inline-shadow-token -- documentation copy describes the forbidden pattern; the showcase is the catalog, not a consumer.
      description="Design tokens that primitives and route code lean on. Use these named utilities instead of open-coding `text-[Xpx] tracking-[X.XXem] uppercase` or `shadow-[inset_0_1px_0_rgba(...)]` strings."
      id="tokens"
      title="Tokens"
    >
      <div className="space-y-4">
        <DemoPanel
          description="Eyebrow typography for small uppercase labels. Apply your own font-weight + color on top."
          title="Typography"
        >
          <div className="space-y-3">
            <div className="flex items-baseline gap-3">
              <span className="font-medium text-eyebrow-xs text-taupe-500">
                text-eyebrow-xs
              </span>
              <span className="font-mono text-[11px] text-taupe-400">
                10px · 0.18em tracking
              </span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="font-medium text-eyebrow text-taupe-500">
                text-eyebrow
              </span>
              <span className="font-mono text-[11px] text-taupe-400">
                11px · 0.22em tracking
              </span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="font-medium text-eyebrow-lg text-taupe-500">
                text-eyebrow-lg
              </span>
              <span className="font-mono text-[11px] text-taupe-400">
                11px · 0.24em tracking
              </span>
            </div>
          </div>
        </DemoPanel>

        <DemoPanel
          description="Inset highlight shadows for subtle dimensional lift — compose Tailwind's inset-shadow utilities directly. Apply on top of border + bg, never as the sole surface treatment."
          title="Inset highlights"
        >
          <div className="grid grid-cols-3 gap-3">
            <div className="flex h-20 flex-col justify-end rounded-xs border border-taupe-200 bg-white p-2 inset-shadow-2xs inset-shadow-white/70">
              <span className="font-mono text-[11px] text-taupe-500">
                inset-shadow-2xs inset-shadow-white/70
              </span>
            </div>
            <div className="flex h-20 flex-col justify-end rounded-xs border border-taupe-200 bg-white p-2 inset-shadow-2xs inset-shadow-white/90">
              <span className="font-mono text-[11px] text-taupe-500">
                inset-shadow-2xs inset-shadow-white/90
              </span>
            </div>
            <div className="flex h-20 flex-col justify-end rounded-xs border border-taupe-200 bg-white p-2 inset-shadow-2xs inset-shadow-white/45">
              <span className="font-mono text-[11px] text-taupe-500">
                inset-shadow-2xs inset-shadow-white/45
              </span>
            </div>
          </div>
        </DemoPanel>

        <DemoPanel
          description="Accent stripes for active or selected items in lists and tabs."
          title="Accent stripes"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="flex h-20 flex-col justify-end rounded-xs border border-taupe-200 bg-white p-2 shadow-marble-stripe-left">
              <span className="font-mono text-[11px] text-taupe-500">
                shadow-marble-stripe-left
              </span>
            </div>
            <div className="flex h-20 flex-col justify-end rounded-xs border border-taupe-200 bg-white p-2 shadow-marble-stripe-top">
              <span className="font-mono text-[11px] text-taupe-500">
                shadow-marble-stripe-top
              </span>
            </div>
          </div>
        </DemoPanel>

        <DemoPanel
          description="Workbench surface gradient for editor/dock canvases. Use as the dense work-area backdrop."
          title="Surfaces"
        >
          <div className="flex h-24 items-end rounded-sm border border-taupe-300 bg-workbench-surface p-3">
            <span className="font-mono text-[11px] text-taupe-500">
              bg-workbench-surface
            </span>
          </div>
        </DemoPanel>
      </div>
    </Section>
  );
};
