import type { MarbleReviewNavigatorDetailItem } from "@marble/ui";

export type ChangeTargetDescriptor =
  | {
      kind: "column";
      columnId: string;
    }
  | {
      pipeId: string;
      kind: "pipe";
    }
  | {
      kind: "cell";
      columnId: string;
      rowId: string;
    }
  | {
      kind: "profiles";
    }
  | {
      kind: "program";
      programId: string;
    }
  | {
      kind: "program-file";
      filename: string;
      programId: string;
    }
  | {
      kind: "program-version";
      versionId: string;
    }
  | {
      kind: "project";
      projectId: string;
    }
  | {
      kind: "row";
      rowId: string;
    }
  | {
      kind: "source";
      sourceId: string;
    }
  | {
      kind: "table";
      tableId: string;
    };

export type ChangeSpotlightQueueGroup = {
  description?: string;
  detailItems?: MarbleReviewNavigatorDetailItem[];
  href: string;
  id: string;
  label: string;
  targetKeys: string[];
};

export type ChangeSpotlightGroup = {
  description: string;
  detailItems: MarbleReviewNavigatorDetailItem[];
  href: string;
  id: string;
  label: string;
  targetKeys: string[];
};

export type PendingChangeSpotlight = {
  activeGroupId: string;
  createdAt: number;
  groups: ChangeSpotlightGroup[];
};

export type SpotlightRect = {
  height: number;
  left: number;
  radius: number;
  top: number;
  width: number;
};

export type SpotlightVisibleTarget = {
  rect: SpotlightRect;
  targetKey: string;
};

export type SpotlightSession = {
  activeGroupIndex: number;
  detail: string;
  detailItems: MarbleReviewNavigatorDetailItem[];
  groups: ChangeSpotlightGroup[];
  summary: string;
  targetKeys: string[];
  visibleTargets: SpotlightVisibleTarget[];
};

export type SpotlightPreview = {
  visibleTargets: SpotlightVisibleTarget[];
};

export type ChangeSpotlightResolver = {
  findElement?: (descriptor: ChangeTargetDescriptor) => HTMLElement | null;
  match: (descriptor: ChangeTargetDescriptor) => boolean;
  reveal?: (
    descriptor: ChangeTargetDescriptor,
  ) => boolean | Promise<boolean | undefined> | undefined;
};

export type ParsedTarget = {
  descriptor: ChangeTargetDescriptor;
  key: string;
};
