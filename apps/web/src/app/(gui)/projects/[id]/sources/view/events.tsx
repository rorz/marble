import {
  MarbleAlert,
  MarbleBadge,
  MarbleCard,
  MarbleCardContent,
  MarbleCardHeader,
  MarbleCardTitle,
  MarbleEmptyState,
  MarbleField,
  MarbleJsonPreview,
  MarbleListRow,
} from "@marble/ui";
import { DATE_TIME_FORMATTER } from "./constants";
import type { Source, SourceEvent } from "./types";

type SourceEventsCardProps = {
  onSelectSourceEvent: (sourceEventId: string) => void;
  selectedSource: Source | null;
  selectedSourceEvent: SourceEvent | null;
  selectedSourceEvents: SourceEvent[];
};

export const SourceEventsCard = ({
  onSelectSourceEvent,
  selectedSource,
  selectedSourceEvent,
  selectedSourceEvents,
}: SourceEventsCardProps) => {
  return (
    <MarbleCard className="flex h-full min-h-0">
      <MarbleCardHeader>
        <MarbleCardTitle className="inline-flex items-center gap-2">
          <span
            aria-hidden="true"
            className="size-2 rounded-full bg-taupe-800 animate-pulse"
          />
          Live event preview
        </MarbleCardTitle>
      </MarbleCardHeader>
      <MarbleCardContent className="flex min-h-0 flex-1 flex-col gap-4">
        {!selectedSource ? (
          <MarbleEmptyState
            description="Select a source to inspect captured webhook payloads."
            title="No source selected"
          />
        ) : selectedSourceEvents.length === 0 ? (
          <MarbleEmptyState
            description="Post JSON to the webhook endpoint to preview the latest payload."
            title="No events captured yet"
          />
        ) : (
          <div className="grid h-full min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.28fr)]">
            <div className="h-full min-h-0 overflow-y-auto rounded-xs border border-taupe-200">
              {selectedSourceEvents.map((event) => (
                <MarbleListRow
                  active={selectedSourceEvent?.id === event.id}
                  description={
                    <div className="space-y-1">
                      <div>
                        {DATE_TIME_FORMATTER.format(new Date(event.createdAt))}
                      </div>
                      <div className="font-mono text-[11px] text-zinc-400">
                        {event.id}
                      </div>
                    </div>
                  }
                  key={event.id}
                  meta={
                    <MarbleBadge
                      caps
                      tone={event.parseError ? "warning" : "neutral"}
                    >
                      {event.parseError ? "Parse error" : "Parsed"}
                    </MarbleBadge>
                  }
                  onClick={() => onSelectSourceEvent(event.id)}
                  title="Source event"
                  tone="orange"
                />
              ))}
            </div>

            <div className="flex min-h-0 flex-col gap-3">
              {selectedSourceEvent ? (
                <>
                  <MarbleField label="Raw payload">
                    <MarbleJsonPreview
                      className="min-h-[12rem]"
                      value={selectedSourceEvent.rawPayload}
                    />
                  </MarbleField>

                  <MarbleField label="Parsed payload">
                    <MarbleJsonPreview
                      className="min-h-[12rem]"
                      value={selectedSourceEvent.parsedPayload}
                    />
                  </MarbleField>

                  {selectedSourceEvent.parseError ? (
                    <MarbleAlert tone="warning">
                      {selectedSourceEvent.parseError}
                    </MarbleAlert>
                  ) : null}
                </>
              ) : (
                <MarbleEmptyState
                  description="Select an event to inspect its payload."
                  title="Choose a captured event"
                />
              )}
            </div>
          </div>
        )}
      </MarbleCardContent>
    </MarbleCard>
  );
};
