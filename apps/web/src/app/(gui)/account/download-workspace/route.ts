import { getCurrentUser } from "@/lib/auth";
import { buildWorkspaceSnapshot } from "@/lib/workspace-snapshot";

export const runtime = "nodejs";

const downloadFilename = () => {
  const stamp = new Date().toISOString().slice(0, 10);
  return `marble-workspace-${stamp}.json`;
};

export const GET = async () => {
  const user = await getCurrentUser();

  if (!user) {
    return new Response("Unauthorized", {
      status: 401,
    });
  }

  const snapshot = await buildWorkspaceSnapshot();
  const filename = downloadFilename();

  return new Response(JSON.stringify(snapshot, null, 2), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
};
