"use client";

import { MarbleButton } from "@marble/ui";
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useState } from "react";

const DOWNLOAD_URL = "/account/download-workspace";

const triggerBrowserDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const filenameFromResponse = (response: Response) => {
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="([^"]+)"/);
  return match?.[1] ?? "marble-workspace.json";
};

export const DownloadWorkspaceButton = () => {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = async () => {
    setPending(true);
    setError(null);

    try {
      const response = await fetch(DOWNLOAD_URL);

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || `Download failed (${response.status}).`);
      }

      triggerBrowserDownload(
        await response.blob(),
        filenameFromResponse(response),
      );
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "Could not download your workspace.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <MarbleButton
        disabled={pending}
        iconLeft={DownloadSimpleIcon}
        onClick={() => {
          void download();
        }}
        type="button"
        variant="dark"
      >
        {pending ? "Preparing download..." : "Download workspace"}
      </MarbleButton>
      {error ? <p className="text-red-600 text-xs">{error}</p> : null}
    </div>
  );
};
