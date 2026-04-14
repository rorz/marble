"use client";

import { MarbleButton } from "@marble/ui";
import { useRouter } from "next/navigation";
import * as actions from "./[id]/actions";

export function CreateTableButton({ projectId }: { projectId: string }) {
  const router = useRouter();

  const handleCreate = async () => {
    const table = await actions.createTable(projectId);
    router.push(`/tables/${table.id}`);
  };

  return (
    <MarbleButton
      onClick={handleCreate}
      variant="orange"
    >
      + New Table
    </MarbleButton>
  );
}
