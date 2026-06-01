"use client";

import { ReactFlowProvider } from "@xyflow/react";
import { ProjectFlowCanvas, type ProjectFlowDiagramProps } from "./canvas";

export const ProjectFlowDiagram = (props: ProjectFlowDiagramProps) => {
  return (
    <ReactFlowProvider>
      <ProjectFlowCanvas {...props} />
    </ReactFlowProvider>
  );
};
