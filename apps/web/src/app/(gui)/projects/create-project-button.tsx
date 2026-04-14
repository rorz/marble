"use client";

import { MarbleButton } from "@marble/ui";
import { useRouter } from "next/navigation";
import * as actions from "./actions";

export function CreateProjectButton() {
  const router = useRouter();

  const handleCreate = async () => {
    const project = await actions.createProject();
    router.push(`/projects/${project.id}`);
  };

  return (
    <MarbleButton
      onClick={handleCreate}
      variant="orange"
    >
      + New Project
    </MarbleButton>
  );
}
