import {
  MarbleButton,
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
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold text-zinc-900">{title}</h2>
      {children}
    </section>
  );
}

export default function UiPage() {
  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-8 text-zinc-950">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-orange-600">
            Marble UI
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
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

        <Section title="Toolbar Example">
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-100 p-4">
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
