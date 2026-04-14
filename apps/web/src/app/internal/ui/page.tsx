import {
  MarbleButton,
  MarbleCard,
  MarbleCardContent,
  MarbleCardDescription,
  MarbleCardFooter,
  MarbleCardHeader,
  MarbleCardTitle,
  MarbleFieldLabel,
  MarbleInput,
  MarbleSelect,
  MarbleTextarea,
} from "@marble/ui";

function Section({
  children,
  title,
}: Readonly<{
  children: React.ReactNode;
  title: string;
}>) {
  return (
    <MarbleCard>
      <MarbleCardHeader className="pb-4">
        <MarbleCardTitle>{title}</MarbleCardTitle>
      </MarbleCardHeader>
      <MarbleCardContent>{children}</MarbleCardContent>
    </MarbleCard>
  );
}

export default function UiPage() {
  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-8 text-zinc-950">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="space-y-2">
          <p className="font-medium text-[11px] text-orange-600 uppercase tracking-[0.24em]">
            Marble UI
          </p>
          <h1 className="font-semibold text-3xl tracking-tight">
            Kitchen sink
          </h1>
          <p className="max-w-2xl text-sm text-zinc-600">
            A small preview surface for the shared Marble-specific controls.
          </p>
        </header>

        <Section title="Buttons">
          <div className="flex flex-wrap items-center gap-3">
            <MarbleButton variant="orange">Run All</MarbleButton>
            <MarbleButton>Add</MarbleButton>
            <MarbleButton variant="dark">Inspect</MarbleButton>
            <MarbleButton variant="red">Delete</MarbleButton>
            <MarbleButton
              disabled
              variant="orange"
            >
              Running...
            </MarbleButton>
          </div>
        </Section>

        <Section title="Cards">
          <div className="grid gap-4 md:grid-cols-3">
            <MarbleCard>
              <MarbleCardHeader>
                <MarbleCardTitle>Default</MarbleCardTitle>
                <MarbleCardDescription>
                  Neutral chrome for standard workspace panels.
                </MarbleCardDescription>
              </MarbleCardHeader>
              <MarbleCardContent>
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600">
                  Rows: 128
                </div>
              </MarbleCardContent>
              <MarbleCardFooter>
                <MarbleButton size="sm">Inspect</MarbleButton>
              </MarbleCardFooter>
            </MarbleCard>

            <MarbleCard tone="subtle">
              <MarbleCardHeader>
                <MarbleCardTitle>Subtle</MarbleCardTitle>
                <MarbleCardDescription>
                  Low-contrast framing for dense UI surfaces.
                </MarbleCardDescription>
              </MarbleCardHeader>
              <MarbleCardContent className="space-y-2">
                <MarbleFieldLabel>Table Name</MarbleFieldLabel>
                <MarbleInput
                  defaultValue="Prospects"
                  wrapperClassName="w-full"
                />
              </MarbleCardContent>
            </MarbleCard>

            <MarbleCard tone="orange">
              <MarbleCardHeader>
                <MarbleCardTitle>Orange</MarbleCardTitle>
                <MarbleCardDescription>
                  Accent treatment for active or important surfaces.
                </MarbleCardDescription>
              </MarbleCardHeader>
              <MarbleCardContent className="space-y-2">
                <div className="rounded-xl border border-orange-200 bg-white/80 p-3 text-sm text-zinc-700">
                  14 runnable columns ready.
                </div>
              </MarbleCardContent>
              <MarbleCardFooter>
                <MarbleButton
                  size="sm"
                  variant="orange"
                >
                  Run All
                </MarbleButton>
              </MarbleCardFooter>
            </MarbleCard>
          </div>
        </Section>

        <Section title="Toolbar Example">
          <div className="flex flex-wrap items-center gap-0.5 rounded-xs border border-neutral-200 bg-neutral-100 p-2">
            <MarbleButton variant="orange">Run All</MarbleButton>
            <MarbleButton>Add</MarbleButton>
            <MarbleInput
              defaultValue={12}
              max="100"
              min="1"
              size="sm"
              type="number"
              wrapperClassName="w-20"
            />
            <span className="text-sm text-zinc-600">Rows</span>
          </div>
        </Section>

        <Section title="Form Controls">
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <MarbleFieldLabel>Name</MarbleFieldLabel>
              <MarbleInput
                defaultValue="Uppercased Company"
                placeholder="Column name"
                wrapperClassName="w-full"
              />
            </div>

            <div>
              <MarbleFieldLabel>Program</MarbleFieldLabel>
              <MarbleSelect
                defaultValue="uppercase"
                wrapperClassName="w-full"
              >
                <option value="uppercase">Uppercase String</option>
                <option value="http-request">HTTP Request</option>
                <option value="formula">Formula</option>
              </MarbleSelect>
            </div>

            <div className="md:col-span-2">
              <MarbleFieldLabel>Input Template</MarbleFieldLabel>
              <MarbleTextarea
                defaultValue={`{\n  "companyName.$": "$.columns.company.value",\n  "tone": "warm"\n}`}
                monospace
                rows={8}
                size="xs"
                wrapperClassName="w-full"
              />
            </div>
          </div>
        </Section>
      </div>
    </main>
  );
}
