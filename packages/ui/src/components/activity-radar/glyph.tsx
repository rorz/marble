import { cx } from "../../utils/cx";
import { MarbleBadge } from "../badge";
import {
  MarbleProfileAttribution,
  type MarbleProfileAttributionProfile,
} from "../profile-attribution";

export type MarbleActivityRadarSegmentTone =
  | "create"
  | "delete"
  | "neutral"
  | "update";

export type MarbleActivityRadarSegment = {
  tone: MarbleActivityRadarSegmentTone;
  value: number;
};

export type MarbleActivityRadarBatch = {
  actors?: MarbleProfileAttributionProfile[];
  description: string;
  id: string;
  label: string;
  onPreviewEnd?: () => void;
  onPreviewStart?: () => void;
  onSelect: () => void;
  segments: MarbleActivityRadarSegment[];
  timestampLabel?: string;
  unread?: boolean;
};

const SEGMENT_TONE_CLASS_NAMES: Record<MarbleActivityRadarSegmentTone, string> =
  {
    create: "bg-emerald-500",
    delete: "bg-red-500",
    neutral: "bg-taupe-300",
    update: "bg-amber-500",
  };

const getSegmentTotal = (segments: MarbleActivityRadarSegment[]) => {
  return segments.reduce((total, segment) => total + segment.value, 0);
};

export const ActivityMeter = ({
  className,
  segments,
}: {
  className?: string;
  segments: MarbleActivityRadarSegment[];
}) => {
  const filteredSegments = segments.filter((segment) => segment.value > 0);
  const total = getSegmentTotal(filteredSegments);
  const resolvedSegments: MarbleActivityRadarSegment[] =
    filteredSegments.length > 0
      ? filteredSegments
      : [
          {
            tone: "neutral",
            value: 1,
          },
        ];
  const resolvedTotal = total > 0 ? total : 1;

  return (
    <div
      className={cx(
        "flex h-2.5 w-full min-w-0 overflow-hidden rounded-full border border-taupe-200/80 bg-white/70 inset-shadow-2xs inset-shadow-white/90",
        className,
      )}
    >
      {resolvedSegments.map((segment) => (
        <div
          className={cx(
            "h-full shrink-0",
            SEGMENT_TONE_CLASS_NAMES[segment.tone],
          )}
          key={`${segment.tone}:${segment.value}`}
          style={{
            width: `${(segment.value / resolvedTotal) * 100}%`,
          }}
        />
      ))}
    </div>
  );
};

export const ActivityGlyph = ({
  pulse = false,
  segments,
}: {
  pulse?: boolean;
  segments: MarbleActivityRadarSegment[];
}) => {
  return (
    <div className="relative flex size-8 shrink-0 items-center justify-center">
      <div
        className={cx(
          "absolute inset-0 rounded-full bg-orange-200/60 blur-[10px] transition-opacity duration-200",
          pulse ? "opacity-100" : "opacity-0",
        )}
      />
      <div className="relative flex size-8 items-center justify-center rounded-xs border border-taupe-200/90 bg-white inset-shadow-2xs inset-shadow-white/90">
        <div className="flex w-4 flex-col gap-[2px]">
          <ActivityMeter
            className="h-[3px] rounded-[999px] border-0 bg-transparent shadow-none"
            segments={segments}
          />
          <ActivityMeter
            className="h-[3px] rounded-[999px] border-0 bg-transparent shadow-none"
            segments={[
              ...segments.slice(1),
              ...segments.slice(0, 1),
            ]}
          />
          <ActivityMeter
            className="h-[3px] rounded-[999px] border-0 bg-transparent shadow-none"
            segments={[
              ...segments.slice(2),
              ...segments.slice(0, 2),
            ]}
          />
        </div>
      </div>
    </div>
  );
};

const formatUnreadCount = (value: number) => {
  if (value > 99) {
    return "99+";
  }

  return String(value);
};

export const ActivityUnreadBadge = ({ count }: { count: number }) => {
  return (
    <MarbleBadge
      aria-label={`${count} unread changesets`}
      className="pointer-events-none absolute -right-1.5 -top-1.5 min-h-5 min-w-5 items-center justify-center rounded-full border-white bg-orange-500 px-1.5 py-0 text-center font-mono text-[10px] leading-[18px] text-white shadow-[0_6px_16px_rgba(84,57,26,0.18)]"
    >
      {formatUnreadCount(count)}
    </MarbleBadge>
  );
};

export const ActivityBatchDescription = ({
  batch,
}: {
  batch: MarbleActivityRadarBatch;
}) => {
  return batch.actors && batch.actors.length > 0 ? (
    <div className="space-y-1">
      <MarbleProfileAttribution profiles={batch.actors} />
      <div className="line-clamp-2 text-xs text-taupe-600">
        {batch.description}
      </div>
    </div>
  ) : (
    <div className="line-clamp-2 text-xs text-taupe-600">
      {batch.description}
    </div>
  );
};

export const CaretDownGlyph = ({ className }: { className?: string }) => {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height="16"
      viewBox="0 0 16 16"
      width="16"
    >
      <path
        d="M4.25 6.5 8 10.25 11.75 6.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
};
