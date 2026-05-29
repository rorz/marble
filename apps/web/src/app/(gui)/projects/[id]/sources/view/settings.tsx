import {
  MarbleAlert,
  MarbleButton,
  MarbleCard,
  MarbleCardFooter,
  MarbleCardHeader,
  MarbleCardSection,
  MarbleCardTitle,
  MarbleCopyField,
  MarbleField,
} from "@marble/ui";
import { CaretRightIcon } from "@phosphor-icons/react";
import { keyboardCaptureOwnerProps } from "../../../../keyboard-capture";
import { MonacoEditor, sourceSchemaEditorOptions } from "./constants";
import type { Source, SourceEvent } from "./types";
import {
  buildSourceWebhookCurlSnippet,
  buildSourceWebhookEndpoint,
} from "./webhook";

type SourceSettingsCardProps = {
  onInferSourceSchema: () => void;
  onSaveSource: () => void;
  onSourceSchemaDraftChange: (value: string) => void;
  selectedSource: Source | null;
  selectedSourceEvent: SourceEvent | null;
  sourcePending: boolean;
  sourceSchemaDraft: string;
  sourceSchemaError: string | null;
  sourceSchemaInferPending: boolean;
  sourceSchemaValid: boolean;
  webhookBaseUrl: string;
};

export const SourceSettingsCard = ({
  onInferSourceSchema,
  onSaveSource,
  onSourceSchemaDraftChange,
  selectedSource,
  selectedSourceEvent,
  sourcePending,
  sourceSchemaDraft,
  sourceSchemaError,
  sourceSchemaInferPending,
  sourceSchemaValid,
  webhookBaseUrl,
}: SourceSettingsCardProps) => {
  const webhookEndpoint = selectedSource
    ? buildSourceWebhookEndpoint(webhookBaseUrl, selectedSource)
    : null;
  const webhookCurlSnippet = selectedSource
    ? buildSourceWebhookCurlSnippet(webhookBaseUrl, selectedSource)
    : null;

  return (
    <MarbleCard className="flex h-full min-h-0">
      <MarbleCardHeader>
        <MarbleCardTitle>Source settings</MarbleCardTitle>
      </MarbleCardHeader>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <MarbleCardSection className="space-y-3">
          <MarbleCardTitle>Webhook</MarbleCardTitle>
          <MarbleCopyField
            label="Webhook endpoint"
            value={webhookEndpoint}
          />
          <MarbleCopyField
            label="Webhook token"
            value={selectedSource?.webhookToken ?? null}
          />
          <details className="group overflow-hidden rounded-xs border border-taupe-200 bg-white/80">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-taupe-50/80 px-3 py-2 text-left transition-colors hover:bg-white [&::-webkit-details-marker]:hidden">
              <span className="inline-flex min-w-0 items-center gap-2">
                <CaretRightIcon
                  aria-hidden="true"
                  className="shrink-0 text-taupe-500 transition-transform group-open:rotate-90"
                  size={13}
                  weight="bold"
                />
                <span className="min-w-0 truncate font-medium text-eyebrow-xs text-zinc-500">
                  Try it yourself
                </span>
              </span>
              <span className="shrink-0 font-medium text-eyebrow-xs text-taupe-600 group-open:hidden">
                Expand
              </span>
              <span className="hidden shrink-0 font-medium text-eyebrow-xs text-taupe-600 group-open:inline">
                Collapse
              </span>
            </summary>
            <div className="border-t border-taupe-200 p-3">
              <MarbleCopyField
                copiedLabel="Copied"
                copyLabel="Copy cURL"
                display="block"
                label="cURL snippet"
                value={webhookCurlSnippet}
              />
            </div>
          </details>
        </MarbleCardSection>
        <MarbleCardSection className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <MarbleCardTitle>Payload schema</MarbleCardTitle>
            <MarbleButton
              disabled={
                !selectedSourceEvent ||
                sourcePending ||
                sourceSchemaInferPending
              }
              onClick={() => void onInferSourceSchema()}
              size="xs"
              variant="light"
            >
              {sourceSchemaInferPending
                ? "Inferring"
                : "Infer from selected event"}
            </MarbleButton>
          </div>
          {sourceSchemaError ? (
            <MarbleAlert tone="error">{sourceSchemaError}</MarbleAlert>
          ) : null}

          <MarbleField
            className="flex min-h-[18rem] flex-1 flex-col"
            label="Schema"
          >
            <div
              className="min-h-0 flex-1 overflow-hidden rounded-xs border border-taupe-200 bg-white shadow-sm shadow-zinc-950/10"
              {...keyboardCaptureOwnerProps}
            >
              <MonacoEditor
                height="100%"
                language="json"
                loading={
                  <div className="flex h-full items-center justify-center text-taupe-500 text-xs">
                    Loading editor...
                  </div>
                }
                onChange={(value) => onSourceSchemaDraftChange(value ?? "")}
                options={sourceSchemaEditorOptions}
                path={
                  selectedSource
                    ? `source://${selectedSource.id}/payload-schema.json`
                    : "source://payload-schema.json"
                }
                theme="vs"
                value={sourceSchemaDraft}
              />
            </div>
          </MarbleField>
        </MarbleCardSection>
      </div>
      <MarbleCardFooter>
        <MarbleButton
          disabled={
            sourcePending || sourceSchemaInferPending || !sourceSchemaValid
          }
          onClick={() => void onSaveSource()}
          variant="dark"
        >
          {sourcePending ? "Saving" : "Save schema"}
        </MarbleButton>
      </MarbleCardFooter>
    </MarbleCard>
  );
};
