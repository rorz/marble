import {
  MarbleField,
  MarbleFieldLabel,
  MarbleInput,
  MarbleJsonPreview,
  MarbleSearchSelect,
  type MarbleSearchSelectOption,
  MarbleSelect,
  MarbleSelectableTile,
  MarbleStat,
  MarbleTextarea,
} from "@marble/ui";
import { CodeIcon, SparkleIcon } from "@phosphor-icons/react/ssr";
import { DemoPanel, Section } from "./chrome";

const inputSizes = [
  "md",
  "sm",
  "xs",
] as const;

const selectSizes = [
  "md",
  "sm",
  "xs",
] as const;

const textareaSizes = [
  "md",
  "sm",
  "xs",
] as const;

const providerOptions = [
  {
    label: "Codex (default)",
    value: "Codex",
  },
  {
    label: "Claude Code",
    value: "Claude Code",
  },
  {
    label: "OpenCode",
    value: "OpenCode",
  },
  {
    label: "Gemini CLI",
    value: "Gemini CLI",
  },
] satisfies MarbleSearchSelectOption[];

export const FormsSection = () => {
  return (
    <Section
      description="Form primitives now cover size variants, disabled states, select/search input paths, and both prose and code-style textareas."
      id="forms"
      title="Forms"
    >
      <div className="space-y-4">
        <DemoPanel
          description="Labels plus every input size."
          title="Inputs"
        >
          <div className="space-y-3">
            {inputSizes.map((size) => (
              <div key={size}>
                <MarbleFieldLabel>{size} input</MarbleFieldLabel>
                <MarbleInput
                  defaultValue={`Sample ${size} value`}
                  size={size}
                  wrapperClassName="w-full"
                />
              </div>
            ))}
            <div>
              <MarbleFieldLabel>Disabled input</MarbleFieldLabel>
              <MarbleInput
                defaultValue="Read only in this state"
                disabled
                wrapperClassName="w-full"
              />
            </div>
          </div>
        </DemoPanel>

        <DemoPanel
          description="Selects and datalist-backed search selects."
          title="Selects"
        >
          <div className="space-y-3">
            {selectSizes.map((size) => (
              <div key={size}>
                <MarbleFieldLabel>{size} select</MarbleFieldLabel>
                <MarbleSelect
                  defaultValue="uppercase"
                  size={size}
                  wrapperClassName="w-full"
                >
                  <option value="uppercase">Uppercase String</option>
                  <option value="formula">Formula</option>
                  <option value="http-request">HTTP Request</option>
                </MarbleSelect>
              </div>
            ))}

            <div>
              <MarbleFieldLabel>Search select</MarbleFieldLabel>
              <MarbleSearchSelect
                defaultValue="Codex"
                options={providerOptions}
                placeholder="Search or select a provider"
                wrapperClassName="w-full"
              />
            </div>
          </div>
        </DemoPanel>

        <DemoPanel
          description="Default prose entry and monospace code entry."
          title="Textareas"
        >
          <div className="space-y-3">
            {textareaSizes.map((size) => (
              <div key={size}>
                <MarbleFieldLabel>{size} textarea</MarbleFieldLabel>
                <MarbleTextarea
                  defaultValue={
                    size === "xs"
                      ? `{\n  "companyName.$": "$.columns.company.value",\n  "tone": "warm"\n}`
                      : "A reusable textarea should stay calm on prose and dense structured content."
                  }
                  monospace={size === "xs"}
                  rows={size === "xs" ? 6 : 3}
                  size={size}
                  wrapperClassName="w-full"
                />
              </div>
            ))}
          </div>
        </DemoPanel>

        <DemoPanel
          description="Pair a label with a single input. Drop the boilerplate `space-y-1.5` wrapper. Optional description renders below the control."
          title="Field"
        >
          <div className="space-y-4">
            <MarbleField label="Display name">
              <MarbleInput
                defaultValue="Audience Enrichment"
                wrapperClassName="w-full"
              />
            </MarbleField>
            <MarbleField
              description="Auto-run only happens after upstream cells execute."
              label="Execution"
            >
              <MarbleSelect
                defaultValue="manual"
                wrapperClassName="w-full"
              >
                <option value="manual">Manual only</option>
                <option value="auto">Auto when ready</option>
              </MarbleSelect>
            </MarbleField>
          </div>
        </DemoPanel>

        <DemoPanel
          description="Selectable tile primitive for icon pickers, toggle chips, and library docks. Active state ships baked in."
          title="Selectable tiles"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-6 gap-2">
              {[
                "🪄",
                "🤖",
                "🛠️",
                "🚀",
                "🦄",
                "💎",
              ].map((icon, index) => (
                <MarbleSelectableTile
                  active={index === 0}
                  aria-label={`Select ${icon}`}
                  className="text-2xl"
                  key={icon}
                  shape="square"
                >
                  {icon}
                </MarbleSelectableTile>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MarbleSelectableTile
                active
                shape="card"
              >
                <div className="mb-2 flex size-10 items-center justify-center rounded-xs border border-orange-200 bg-white text-orange-700">
                  <SparkleIcon size={20} />
                </div>
                <span className="font-medium text-sm text-taupe-950">
                  Active
                </span>
                <span className="text-xs text-taupe-500">
                  Card shape, pressed
                </span>
              </MarbleSelectableTile>
              <MarbleSelectableTile shape="card">
                <div className="mb-2 flex size-10 items-center justify-center rounded-xs border border-taupe-200 bg-taupe-50 text-taupe-700">
                  <CodeIcon size={20} />
                </div>
                <span className="font-medium text-sm text-taupe-950">Idle</span>
                <span className="text-xs text-taupe-500">
                  Card shape, not pressed
                </span>
              </MarbleSelectableTile>
            </div>
          </div>
        </DemoPanel>

        <DemoPanel
          description="Labelled value tiles for read-only data surfaces. Framed for emphasis, plain for inline detail."
          title="Stats"
        >
          <div className="grid gap-3 md:grid-cols-2">
            <MarbleStat
              framed
              label="Selected action"
              value="Create project"
            />
            <MarbleStat
              framed
              label="Run mode"
              tone="subtle"
              value="Auto when ready"
            />
            <MarbleStat
              label="Profile"
              tone="subtle"
              value="schema-agent@marble"
            />
            <MarbleStat
              label="Request"
              tone="subtle"
              value="req_8f31b4e0"
            />
          </div>
        </DemoPanel>

        <DemoPanel
          description="Tokenized JSON preview. Renders with proper monospace + leading + max-height handling."
          title="JSON preview"
        >
          <MarbleJsonPreview
            value={{
              edges: [
                {
                  from: "rows.cells.company",
                  mode: "fanout",
                  to: "rows.cells.summary",
                },
              ],
              ok: true,
              outputs: {
                summary: "Marble enriches messy CRM data with AI.",
              },
              ran: 14,
            }}
          />
        </DemoPanel>
      </div>
    </Section>
  );
};
