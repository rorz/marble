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
import { MonacoEditor, sourceSchemaEditorOptions } from "./constants";
import type { Source, SourceEvent } from "./types";
import { buildSourceWebhookEndpoint } from "./webhook";

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
  return (
    <MarbleCard className="flex h-full min-h-0">
      <MarbleCardHeader>
        <MarbleCardTitle>Source settings</MarbleCardTitle>
      </MarbleCardHeader>
      <MarbleCardSection className="space-y-3">
        <MarbleCardTitle>Webhook</MarbleCardTitle>
        <MarbleCopyField
          label="Webhook endpoint"
          value={
            selectedSource
              ? buildSourceWebhookEndpoint(webhookBaseUrl, selectedSource)
              : null
          }
        />
        <MarbleCopyField
          label="Webhook token"
          value={selectedSource?.webhookToken ?? null}
        />
      </MarbleCardSection>
      <MarbleCardSection className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <MarbleCardTitle>Payload schema</MarbleCardTitle>
          <MarbleButton
            disabled={
              !selectedSourceEvent || sourcePending || sourceSchemaInferPending
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
          <div className="min-h-0 flex-1 overflow-hidden rounded-xs border border-taupe-200 bg-white shadow-sm shadow-zinc-950/10">
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
