"use client";

import { MarbleButton } from "@marble/ui";
import {
  FunnelIcon,
  PipeIcon,
  TableIcon,
} from "@phosphor-icons/react/dist/ssr";
import {
  Background,
  BackgroundVariant,
  type EdgeMouseHandler,
  type NodeMouseHandler,
  ReactFlow,
} from "@xyflow/react";
import { useMemo } from "react";
import type { ProjectState } from "../types";
import {
  buildProjectFlowEdges,
  buildProjectFlowNodes,
  isPipeMappingNode,
  isResourceNode,
  type Pipe,
  type ProjectFlowEdge,
  type ProjectFlowNode,
  pipeEdgeStyle,
  type Source,
} from "./model";
import { projectFlowNodeTypes } from "./nodes";

type ProjectFlowDiagramProps = {
  creatingPipe: boolean;
  creatingSource: boolean;
  creatingTable: boolean;
  inputColumnLabelById: Map<string, string>;
  onCreatePipe: () => void;
  onCreateSource: () => void;
  onCreateTable: () => void;
  onSelectPipe: (pipeId: string) => void;
  onSelectSource: (sourceId: string) => void;
  onSelectTable: (tableId: string) => void;
  pipes: Pipe[];
  project: ProjectState;
  sourceEventCountBySourceId: Map<string, number>;
  sources: Source[];
};

export const ProjectFlowDiagram = ({
  creatingPipe,
  creatingSource,
  creatingTable,
  inputColumnLabelById,
  onCreatePipe,
  onCreateSource,
  onCreateTable,
  onSelectPipe,
  onSelectSource,
  onSelectTable,
  pipes,
  project,
  sourceEventCountBySourceId,
  sources,
}: ProjectFlowDiagramProps) => {
  const nodes = useMemo(
    () =>
      buildProjectFlowNodes(
        project,
        sources,
        sourceEventCountBySourceId,
        pipes,
        inputColumnLabelById,
      ),
    [
      inputColumnLabelById,
      pipes,
      project,
      sourceEventCountBySourceId,
      sources,
    ],
  );
  const edges = useMemo(
    () => buildProjectFlowEdges(pipes, project, sources),
    [
      pipes,
      project,
      sources,
    ],
  );

  const handleNodeClick: NodeMouseHandler<ProjectFlowNode> = (_event, node) => {
    if (isPipeMappingNode(node)) {
      onSelectPipe(node.data.pipeId);
      return;
    }

    if (!isResourceNode(node) || !node.data.entityId) {
      return;
    }

    if (node.data.kind === "source") {
      onSelectSource(node.data.entityId);
      return;
    }

    onSelectTable(node.data.entityId);
  };

  const handleEdgeClick: EdgeMouseHandler<ProjectFlowEdge> = (event, edge) => {
    event.stopPropagation();
    const pipeId = edge.data?.pipeId;

    if (!pipeId) {
      return;
    }

    onSelectPipe(pipeId);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <MarbleButton
          disabled={creatingSource}
          iconLeft={FunnelIcon}
          onClick={onCreateSource}
          size="sm"
          variant="light"
        >
          {creatingSource ? "Creating" : "New source"}
        </MarbleButton>
        <MarbleButton
          disabled={creatingPipe}
          iconLeft={PipeIcon}
          onClick={onCreatePipe}
          size="sm"
          variant="light"
        >
          {creatingPipe ? "Creating" : "New pipe"}
        </MarbleButton>
        <MarbleButton
          disabled={creatingTable}
          iconLeft={TableIcon}
          onClick={onCreateTable}
          size="sm"
          variant="light"
        >
          {creatingTable ? "Creating" : "New table"}
        </MarbleButton>
      </div>

      <div className="min-h-96 flex-1 overflow-hidden rounded-sm border border-taupe-200 bg-workbench-surface inset-shadow-2xs inset-shadow-white/45">
        <ReactFlow<ProjectFlowNode, ProjectFlowEdge>
          defaultEdgeOptions={{
            style: pipeEdgeStyle,
            type: "smoothstep",
          }}
          edges={edges}
          fitView
          fitViewOptions={{
            padding: 0.08,
          }}
          maxZoom={1.35}
          minZoom={0.45}
          nodes={nodes}
          nodesConnectable={false}
          nodesDraggable={false}
          nodeTypes={projectFlowNodeTypes}
          onEdgeClick={handleEdgeClick}
          onNodeClick={handleNodeClick}
          panOnScroll
          proOptions={{
            hideAttribution: true,
          }}
        >
          <Background
            color="var(--color-zinc-300)"
            gap={24}
            size={1}
            variant={BackgroundVariant.Dots}
          />
        </ReactFlow>
      </div>
    </div>
  );
};
