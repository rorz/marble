"use client";

import {
  Background,
  BackgroundVariant,
  ConnectionLineType,
  type EdgeMouseHandler,
  type IsValidConnection,
  type NodeMouseHandler,
  type OnConnect,
  ReactFlow,
  useReactFlow,
} from "@xyflow/react";
import { useEffect, useMemo, useRef } from "react";
import type { ProjectState } from "../types";
import {
  buildProjectFlowEdges,
  type ProjectFlowEdge,
  pipeEdgeStyle,
} from "./edges";
import {
  buildProjectFlowNodes,
  isAddNode,
  isPipeMappingNode,
  isResourceNode,
  type Pipe,
  type ProjectFlowNode,
  parseSourceNodeId,
  parseTableNodeId,
  type Source,
} from "./model";
import { projectFlowNodeTypes } from "./nodes";

export type ProjectFlowDiagramProps = {
  creatingPipe: boolean;
  creatingSource: boolean;
  creatingTable: boolean;
  inputColumnLabelById: Map<string, string>;
  onCreatePipe: (connection?: { sourceId: string; tableId: string }) => void;
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

const FIT_VIEW_OPTIONS = {
  padding: 0.16,
};

const buildStructureSignature = (
  sources: Source[],
  tables: ProjectState["tables"],
  pipes: Pipe[],
) =>
  [
    sources.map((source) => source.id).join(","),
    tables.map((table) => table.id).join(","),
    pipes
      .map((pipe) => `${pipe.id}:${pipe.sourceId}:${pipe.tableId}`)
      .join(","),
  ].join("|");

export const ProjectFlowCanvas = ({
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
  const { fitView } = useReactFlow();

  const nodes = useMemo(
    () =>
      buildProjectFlowNodes(
        project,
        sources,
        sourceEventCountBySourceId,
        pipes,
        inputColumnLabelById,
        {
          creatingPipe,
          creatingSource,
          creatingTable,
        },
      ),
    [
      creatingPipe,
      creatingSource,
      creatingTable,
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

  const structureSignature = useMemo(
    () => buildStructureSignature(sources, project.tables, pipes),
    [
      pipes,
      project.tables,
      sources,
    ],
  );
  const lastSignatureRef = useRef(structureSignature);

  useEffect(() => {
    if (lastSignatureRef.current === structureSignature) {
      return;
    }

    lastSignatureRef.current = structureSignature;
    const frame = requestAnimationFrame(() => {
      void fitView({
        duration: 320,
        padding: FIT_VIEW_OPTIONS.padding,
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [
    fitView,
    structureSignature,
  ]);

  const handleNodeClick: NodeMouseHandler<ProjectFlowNode> = (_event, node) => {
    if (isAddNode(node)) {
      if (node.data.disabled) {
        return;
      }

      if (node.data.kind === "source") {
        onCreateSource();
        return;
      }

      if (node.data.kind === "table") {
        onCreateTable();
        return;
      }

      onCreatePipe();
      return;
    }

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

  const handleConnect: OnConnect = (connection) => {
    if (creatingPipe) {
      return;
    }

    const sourceId = parseSourceNodeId(connection.source);
    const tableId = parseTableNodeId(connection.target);

    if (!sourceId || !tableId) {
      return;
    }

    onCreatePipe({
      sourceId,
      tableId,
    });
  };

  const isValidConnection: IsValidConnection<ProjectFlowEdge> = (connection) =>
    parseSourceNodeId(connection.source) !== null &&
    parseTableNodeId(connection.target) !== null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-96 flex-1 overflow-hidden rounded-sm border border-taupe-200 bg-workbench-surface inset-shadow-2xs inset-shadow-white/45">
        <ReactFlow<ProjectFlowNode, ProjectFlowEdge>
          connectionLineStyle={pipeEdgeStyle}
          connectionLineType={ConnectionLineType.SmoothStep}
          connectionRadius={42}
          defaultEdgeOptions={{
            style: pipeEdgeStyle,
            type: "smoothstep",
          }}
          edges={edges}
          fitView
          fitViewOptions={FIT_VIEW_OPTIONS}
          isValidConnection={isValidConnection}
          maxZoom={1.15}
          minZoom={0.4}
          nodes={nodes}
          nodesDraggable={false}
          nodeTypes={projectFlowNodeTypes}
          onConnect={handleConnect}
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
