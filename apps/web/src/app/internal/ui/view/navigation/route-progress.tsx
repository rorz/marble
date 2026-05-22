import {
  MarbleButton,
  MarbleLink,
  MarbleRouteProgress,
  MarbleSpinner,
  useMarbleRouter,
  useReportRouteProgress,
} from "@marble/ui";
import { ArrowRightIcon } from "@phosphor-icons/react/ssr";
import { useState } from "react";

export const RouteProgressDemo = () => {
  const [pending, setPending] = useState(false);
  useReportRouteProgress(pending);
  return (
    <div className="space-y-3">
      <MarbleRouteProgress />
      <div className="flex flex-wrap items-center gap-3">
        <MarbleButton
          onClick={() => {
            setPending(true);
            window.setTimeout(() => setPending(false), 1600);
          }}
          size="sm"
          variant="orange"
        >
          Trigger pending state
        </MarbleButton>
        <MarbleLink
          className="inline-flex items-center gap-1.5 text-eyebrow text-taupe-500 underline-offset-2 hover:text-taupe-700 hover:underline"
          href="/internal/ui?route-progress-probe=1"
        >
          <span>Or click here for a real route navigation</span>
        </MarbleLink>
      </div>
    </div>
  );
};

export const MarbleRouterDemo = () => {
  const router = useMarbleRouter();
  return (
    <div className="flex flex-wrap items-center gap-3 border-taupe-200 border-t pt-3">
      <span className="text-eyebrow text-taupe-500">useMarbleRouter()</span>
      <MarbleButton
        disabled={router.isPending}
        iconLeft={ArrowRightIcon}
        onClick={() => router.push("/internal/ui?marble-router-probe=1")}
        size="sm"
        variant="light"
      >
        {router.isPending ? "Navigating…" : "router.push()"}
      </MarbleButton>
      {router.isPending ? (
        <MarbleSpinner
          size="xs"
          tone="neutral"
        />
      ) : null}
    </div>
  );
};
