"use client";

import {
  MarbleBadge,
  MarbleCard,
  MarbleCardDescription,
  MarbleCardHeader,
  MarbleCardTitle,
} from "@marble/ui";
import { useState } from "react";
import { Topics } from "./topics";
import { WorkspaceActions } from "./workspace-actions";

export function HelpCommandExamples() {
  const [selectedAction, setSelectedAction] = useState("Create project");
  const [selectedTopic, setSelectedTopic] = useState("Profiles overview");

  return (
    <div className="flex flex-col gap-6">
      <MarbleCard tone="orange">
        <MarbleCardHeader className="gap-3 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <MarbleBadge
              caps
              tone="solid"
            >
              cmdk
            </MarbleBadge>
            <MarbleBadge
              caps
              tone="warning"
            >
              Temporary help surface
            </MarbleBadge>
          </div>
          <MarbleCardTitle>
            Help is an interactive prototype for now
          </MarbleCardTitle>
          <MarbleCardDescription>
            This replaces the placeholder help page with live `cmdk` examples.
            Filtering, grouping, separators, and item selection are all wired up
            here so the eventual help surface can grow from a shared primitive
            instead of bespoke route code.
          </MarbleCardDescription>
        </MarbleCardHeader>
      </MarbleCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <WorkspaceActions
          onSelect={setSelectedAction}
          selectedAction={selectedAction}
        />
        <Topics
          onSelect={setSelectedTopic}
          selectedTopic={selectedTopic}
        />
      </div>
    </div>
  );
}
