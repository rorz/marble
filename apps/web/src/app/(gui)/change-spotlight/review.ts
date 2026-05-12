import { dedupeTargetKeys, parseTargetKeys } from "./target-keys";
import type { ChangeTargetDescriptor, ParsedTarget } from "./types";

export function isBroadPreviewDescriptor(
  descriptor: ChangeTargetDescriptor | null,
) {
  return (
    descriptor?.kind === "profiles" ||
    descriptor?.kind === "program" ||
    descriptor?.kind === "project" ||
    descriptor?.kind === "table"
  );
}

export function hasSpecificPreviewDescriptor(
  descriptor: ChangeTargetDescriptor | null,
) {
  return (
    descriptor?.kind === "cell" ||
    descriptor?.kind === "column" ||
    descriptor?.kind === "program-file" ||
    descriptor?.kind === "program-version" ||
    descriptor?.kind === "row"
  );
}

function compactTableReviewTargets(targets: ParsedTarget[]) {
  const cellTargets = targets.filter(
    (
      target,
    ): target is ParsedTarget & {
      descriptor: Extract<
        ChangeTargetDescriptor,
        {
          kind: "cell";
        }
      >;
    } => target.descriptor.kind === "cell",
  );
  const rowTargets = targets.filter(
    (
      target,
    ): target is ParsedTarget & {
      descriptor: Extract<
        ChangeTargetDescriptor,
        {
          kind: "row";
        }
      >;
    } => target.descriptor.kind === "row",
  );
  const columnTargets = targets.filter(
    (
      target,
    ): target is ParsedTarget & {
      descriptor: Extract<
        ChangeTargetDescriptor,
        {
          kind: "column";
        }
      >;
    } => target.descriptor.kind === "column",
  );
  const tableTargets = targets.filter(
    (
      target,
    ): target is ParsedTarget & {
      descriptor: Extract<
        ChangeTargetDescriptor,
        {
          kind: "table";
        }
      >;
    } => target.descriptor.kind === "table",
  );

  if (cellTargets.length > 0) {
    return dedupeTargetKeys(cellTargets.map((target) => target.key));
  }

  if (rowTargets.length > 0 || columnTargets.length > 0) {
    return dedupeTargetKeys([
      ...rowTargets.map((target) => target.key),
      ...columnTargets.map((target) => target.key),
    ]);
  }

  return tableTargets.length > 0
    ? [
        tableTargets[0].key,
      ]
    : [];
}

export function buildReviewTargetKeys(targetKeys: string[]) {
  const parsedTargets = parseTargetKeys(targetKeys);
  const results: string[] = [];

  const tableTargets = parsedTargets.filter((target) =>
    [
      "cell",
      "column",
      "row",
      "table",
    ].includes(target.descriptor.kind),
  );
  const programFileTargets = parsedTargets.filter(
    (target) => target.descriptor.kind === "program-file",
  );
  const programVersionTargets = parsedTargets.filter(
    (target) => target.descriptor.kind === "program-version",
  );
  const programTargets = parsedTargets.filter(
    (target) => target.descriptor.kind === "program",
  );
  const projectTargets = parsedTargets.filter(
    (target) => target.descriptor.kind === "project",
  );
  const profileTargets = parsedTargets.filter(
    (target) => target.descriptor.kind === "profiles",
  );

  const compactedTableKeys = compactTableReviewTargets(tableTargets);

  if (compactedTableKeys.length > 0) {
    results.push(...compactedTableKeys);
  } else if (projectTargets.length > 0) {
    results.push(projectTargets[0].key);
  }

  if (programFileTargets.length > 0 || programVersionTargets.length > 0) {
    results.push(
      ...dedupeTargetKeys([
        ...programFileTargets.map((target) => target.key),
        ...programVersionTargets.map((target) => target.key),
      ]),
    );
  } else if (programTargets.length > 0) {
    results.push(programTargets[0].key);
  }

  if (
    results.length === 0 &&
    compactedTableKeys.length === 0 &&
    projectTargets.length > 0
  ) {
    results.push(projectTargets[0].key);
  }

  if (results.length === 0 && profileTargets.length > 0) {
    results.push(profileTargets[0].key);
  }

  if (results.length === 0) {
    results.push(...parsedTargets.map((target) => target.key));
  }

  return dedupeTargetKeys(results);
}

export function buildPreviewTargetKeys(targetKeys: string[]) {
  const parsedTargets = parseTargetKeys(targetKeys);
  const anchorTargetKeys = [
    parsedTargets.find((target) => target.descriptor.kind === "table")?.key,
    parsedTargets.find((target) => target.descriptor.kind === "program")?.key,
    parsedTargets.find((target) => target.descriptor.kind === "project")?.key,
    parsedTargets.find((target) => target.descriptor.kind === "profiles")?.key,
  ].filter((targetKey): targetKey is string => Boolean(targetKey));

  return dedupeTargetKeys([
    ...buildReviewTargetKeys(targetKeys),
    ...anchorTargetKeys,
  ]);
}
