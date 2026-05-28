type ToolPromptMetadata = {
  description?: string;
  promptGuidelines?: string[];
  promptSnippet?: string;
};

const TOOL_PROMPT_METADATA: Record<string, ToolPromptMetadata> = {
  "cells.run": {
    description:
      "Execute one materialized cell. Run user-input cells after setting manual values so output state is written and downstream runCondition columns can queue.",
    promptGuidelines: [
      "Use marble_cells_run after marble_cells_set_manual_value when the user expects visible output, downstream work, or a populated workflow.",
      "Call marble_cells_run once per source/input cell; Marble batches compatible work server-side.",
    ],
    promptSnippet:
      "marble_cells_run: execute one materialized cell and wake ready downstream columns.",
  },
  "cells.setManualValue": {
    description:
      "Store manual input on an existing cell. This does not execute the program or write final cell output by itself.",
    promptGuidelines: [
      "marble_cells_set_manual_value only stores operator input; follow it with marble_cells_run on the same source cell when work should proceed.",
      "Set manual values on dedicated user-input cells, not directly on enrichment or business-logic cells.",
    ],
    promptSnippet:
      "marble_cells_set_manual_value: store operator input on a cell without running it.",
  },
  "columns.create": {
    description:
      "Create a table column backed by an existing program version. For simple operator/source input columns, first find the first-party User Input program version with marble_programs_list_for_editor, then create the column with that version.",
    promptGuidelines: [
      "For simple manual inputs like name, company, email, URL, count, or yes/no fields, do not create a new Input: ... program; use marble_programs_list_for_editor to find the first-party User Input program and pass its latest published version to marble_columns_create.",
      'For User Input columns, set marble_columns_create inputTemplate to {"format":"string"}, {"format":"number"}, or {"format":"boolean"}; set runCondition false.',
      "For downstream columns, set inputTemplate to reference source columns and set runCondition true when the column should run after dependencies execute.",
    ],
    promptSnippet:
      "marble_columns_create: add a program-backed table step; raw inputs reuse the first-party User Input version from programs.listForEditor.",
  },
  "columns.listReferenceable": {
    description:
      "List project-local columns with labels and allowManualInput so the agent can choose safe source columns for templates or manual values.",
    promptGuidelines: [
      "Use marble_columns_list_referenceable with the current projectId before wiring ambiguous inputTemplate mappings or deciding where a manual value belongs.",
    ],
    promptSnippet:
      "marble_columns_list_referenceable: find existing project columns and whether each accepts manual input.",
  },
  "pipes.create": {
    description:
      "Connect a source to a table by mapping source event JSON paths into table columns. Map incoming payload fields into user-input/source columns unless raw payload should intentionally feed a downstream column.",
    promptGuidelines: [
      "Use marble_pipes_create to map webhook/source fields to dedicated source or user-input columns, then let downstream columns consume those values.",
    ],
    promptSnippet:
      "marble_pipes_create: map source event JSON paths into table columns.",
  },
  "programFiles.create": {
    description:
      "Create one file for an existing program version. Program code belongs here or in syncForVersion, not in programs.create.",
    promptGuidelines: [
      "Use marble_program_files_create only after a program version exists; do not pass file content to marble_programs_create.",
    ],
    promptSnippet:
      "marble_program_files_create: add one source file to an existing program version.",
  },
  "programFiles.syncForVersion": {
    description:
      "Replace/sync the file set for an existing program version. This is the preferred way to write authored program code.",
    promptGuidelines: [
      "Use marble_program_files_sync_for_version to write complete program code after creating the program and version.",
      "Authored program versions must include main.ts, package.json, and marbleconfig.jsonc. The executor imports main.ts; do not use index.ts as the entrypoint.",
    ],
    promptSnippet:
      "marble_program_files_sync_for_version: sync authored files for an existing program version; include main.ts, package.json, and marbleconfig.jsonc.",
  },
  "programs.create": {
    description:
      "Create the program identity/name, optionally with an initial schema-only version. Do not send source files or code here; write code with programFiles after a version exists.",
    promptGuidelines: [
      "Use marble_programs_create once to create the program record; if code is needed, create or use a program version next, then sync files.",
      "Do not retry marble_programs_create with file payloads when authoring code; the files belong to marble_program_files_sync_for_version or marble_program_files_create.",
    ],
    promptSnippet:
      "marble_programs_create: create a program record only; code files belong to programFiles after a version exists.",
  },
  "programs.listForEditor": {
    description:
      "List visible programs with versions and files. Use this to find existing first-party programs such as User Input before creating columns or authoring new code.",
    promptGuidelines: [
      "Use marble_programs_list_for_editor before creating raw input columns; select the first-party program named User Input and its latest published version.",
      "Do not create custom Input: ... programs for raw values when the first-party User Input program is available from marble_programs_list_for_editor.",
    ],
    promptSnippet:
      "marble_programs_list_for_editor: list programs, versions, and files; find the first-party User Input version for raw input columns.",
  },
  "programVersions.create": {
    description:
      "Create a draft program version. Program input/output config lives in marbleconfig.jsonc, which must be synced with the source files before publishing.",
    promptGuidelines: [
      "Use marble_program_versions_create after marble_programs_create to get a version id, then sync files including main.ts, package.json, and marbleconfig.jsonc with marble_program_files_sync_for_version.",
      "For manual-input programs, set outputConfig.flags.allowManualInput true in marbleconfig.jsonc and read cell.manualInputValue in code.",
    ],
    promptSnippet:
      "marble_program_versions_create: create a draft version; sync main.ts, package.json, and marbleconfig.jsonc next.",
  },
  "programVersions.test": {
    description:
      "Test an existing program version with inputConfig and optional manualInput before wiring it into columns.",
    promptGuidelines: [
      "Use marble_program_versions_test before wiring newly authored program code into a table when practical.",
    ],
    promptSnippet:
      "marble_program_versions_test: test a program version with inputConfig and optional manualInput.",
  },
  "tables.insertRows": {
    description:
      "Insert rows into a table. This materializes cells but returns only counts; list rows/cells afterwards to get cell IDs.",
    promptGuidelines: [
      "After marble_tables_insert_rows, list rows and cells before setting manual values or running cells.",
    ],
    promptSnippet:
      "marble_tables_insert_rows: materialize rows and cells, then fetch cells for follow-up work.",
  },
};

export const toolPromptMetadataFor = (
  operationId: string,
): ToolPromptMetadata => TOOL_PROMPT_METADATA[operationId] ?? {};
