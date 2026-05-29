import {
  cx,
  MarbleContextPopover,
  MarbleFieldLabel,
  MarbleSelect,
} from "@marble/ui";
import { CaretDownIcon, CheckIcon } from "@phosphor-icons/react";
import type { Dispatch, SetStateAction } from "react";
import { InterpolationEditor } from "../interpolation-editor";
import type { ReferenceableColumn } from "../types";
import type { ColumnFieldValues, ColumnInputField } from "./types";

type ColumnDependencySelectProps = {
  columns: ReferenceableColumn[];
  currentTableId: string;
  onChange: (value: string) => void;
  path?: string;
  value: string;
};

type ColumnDependencyTableSection = {
  columns: ReferenceableColumn[];
  tableId: string;
  tableName: string;
};

type ColumnDependencyMenuProps = {
  currentTableId: string;
  onSelect: (value: string) => void;
  sections: ColumnDependencyTableSection[];
  value: string;
};

const findDefaultDependencyColumnId = (
  columns: ReferenceableColumn[],
  currentTableId: string,
) =>
  (columns.find((column) => column.tableId === currentTableId) ?? columns[0])
    ?.id ?? "";

const buildColumnDependencyTableSections = (
  columns: ReferenceableColumn[],
  currentTableId: string,
) => {
  const sectionByTableId = new Map<string, ColumnDependencyTableSection>();

  for (const column of columns) {
    const section = sectionByTableId.get(column.tableId) ?? {
      columns: [],
      tableId: column.tableId,
      tableName: column.tableName,
    };

    section.columns.push(column);
    sectionByTableId.set(column.tableId, section);
  }

  const sections = Array.from(sectionByTableId.values());
  const currentTableSection =
    sections.find((section) => section.tableId === currentTableId) ?? null;
  const otherTableSections = sections
    .filter((section) => section.tableId !== currentTableId)
    .sort((left, right) => left.tableName.localeCompare(right.tableName));

  if (!currentTableSection) {
    return otherTableSections;
  }

  return [
    currentTableSection,
    ...otherTableSections,
  ];
};

const ColumnDependencyMenu = ({
  currentTableId,
  onSelect,
  sections,
  value,
}: ColumnDependencyMenuProps) => (
  <div className="max-h-72 overflow-y-auto p-1.5">
    {sections.map((section, sectionIndex) => (
      <div
        className={cx(
          sectionIndex > 0 ? "mt-1 border-t border-taupe-200 pt-1" : null,
        )}
        key={section.tableId}
      >
        <div className="px-2.5 pb-1 pt-1">
          <span
            className={cx(
              "block truncate text-xs",
              section.tableId === currentTableId
                ? "font-semibold text-taupe-900"
                : "font-medium text-taupe-500",
            )}
          >
            {section.tableId === currentTableId
              ? `This Table (${section.tableName})`
              : section.tableName}
          </span>
        </div>
        <div className="space-y-px">
          {section.columns.map((column) => (
            <button
              className={cx(
                "flex min-h-8 w-full items-center gap-2 rounded-xs px-2.5 py-1.5 text-left text-sm transition-colors focus-visible:outline-none",
                column.id === value
                  ? "bg-taupe-100 text-taupe-950"
                  : "text-taupe-700 hover:bg-taupe-50 hover:text-taupe-950 focus-visible:bg-taupe-50 focus-visible:text-taupe-950",
              )}
              key={column.id}
              onClick={() => onSelect(column.id)}
              type="button"
            >
              <span
                className={cx(
                  "min-w-0 flex-1 truncate",
                  column.id === value ? "font-semibold" : "font-medium",
                )}
              >
                {column.name}
              </span>
              {column.id === value ? (
                <CheckIcon
                  className="shrink-0 text-orange-600"
                  size={14}
                  weight="bold"
                />
              ) : null}
            </button>
          ))}
        </div>
      </div>
    ))}
  </div>
);

const ColumnDependencySelect = ({
  columns,
  currentTableId,
  onChange,
  path,
  value,
}: ColumnDependencySelectProps) => {
  const selectedColumn = columns.find((column) => column.id === value) ?? null;
  const sections = buildColumnDependencyTableSections(columns, currentTableId);
  const selectedLabel = selectedColumn
    ? `${selectedColumn.label}${path ?? ""}`
    : null;

  return (
    <MarbleContextPopover
      align="start"
      ariaLabel={
        selectedLabel
          ? `Dependency column: ${selectedLabel}`
          : "Pick a dependency column"
      }
      asChild
      className="w-full"
      content={({ dismissMenu }) => (
        <ColumnDependencyMenu
          currentTableId={currentTableId}
          onSelect={(nextValue) => {
            onChange(nextValue);
            dismissMenu();
          }}
          sections={sections}
          value={value}
        />
      )}
      contentClassName="p-0"
      disabled={columns.length === 0}
      menuClassName="w-80"
      triggerClassName="w-full"
    >
      <button
        className={cx(
          "flex min-h-9 w-full items-center justify-between gap-2 rounded-md border-x border-t border-b-2 border-taupe-200 border-b-taupe-300 bg-white px-2.5 py-1.5 text-left shadow-sm transition-colors hover:border-b-orange-300 focus-visible:border-b-orange-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-orange-400 disabled:cursor-not-allowed disabled:opacity-50",
          selectedColumn ? "text-taupe-900" : "text-taupe-400",
        )}
        type="button"
      >
        <span className="min-w-0 flex-1 truncate text-xs font-medium">
          {selectedLabel ?? "Pick a column..."}
        </span>
        <CaretDownIcon
          className="shrink-0 text-taupe-400"
          size={14}
          weight="bold"
        />
      </button>
    </MarbleContextPopover>
  );
};

type InputTemplateProps = {
  currentTableId: string;
  fieldValues: ColumnFieldValues;
  fields: ColumnInputField[];
  referenceColumns: ReferenceableColumn[];
  setFieldValues: Dispatch<SetStateAction<ColumnFieldValues>>;
};

export const InputTemplate = ({
  currentTableId,
  fieldValues,
  fields,
  referenceColumns,
  setFieldValues,
}: InputTemplateProps) => {
  const updateFieldValue = (key: string, value: ColumnFieldValues[string]) =>
    setFieldValues((current) => ({
      ...current,
      [key]: value,
    }));

  if (fields.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2.5">
      <MarbleFieldLabel className="text-taupe-700">
        Input Template
      </MarbleFieldLabel>
      {fields.map((field) => {
        const fieldValue = fieldValues[field.key] ?? {
          mode: "static",
          value: "",
        };

        return (
          <div
            className="space-y-2 rounded-xs border border-taupe-200 bg-taupe-50/60 p-3"
            key={field.key}
          >
            <div className="space-y-0.5">
              <span className="block font-mono text-[11px] text-taupe-950">
                {field.key}
              </span>
              <span className="block text-xs text-taupe-600">
                {field.title}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-taupe-700">
              <label className="flex cursor-pointer items-center gap-1.5">
                <input
                  checked={fieldValue.mode === "static"}
                  className="accent-orange-500"
                  name={`mode-${field.key}`}
                  onChange={() =>
                    updateFieldValue(field.key, {
                      mode: "static",
                      value: field.defaultValue ?? field.enumValues?.[0] ?? "",
                    })
                  }
                  type="radio"
                />
                Formula
              </label>
              <label className="flex cursor-pointer items-center gap-1.5">
                <input
                  checked={fieldValue.mode === "column"}
                  className="accent-orange-500"
                  name={`mode-${field.key}`}
                  onChange={() =>
                    updateFieldValue(field.key, {
                      mode: "column",
                      value: findDefaultDependencyColumnId(
                        referenceColumns,
                        currentTableId,
                      ),
                    })
                  }
                  type="radio"
                />
                From column
              </label>
            </div>
            {fieldValue.mode === "static" ? (
              field.enumValues ? (
                <MarbleSelect
                  onChange={(event) =>
                    updateFieldValue(field.key, {
                      ...fieldValue,
                      value: event.target.value,
                    })
                  }
                  size="xs"
                  value={fieldValue.value}
                  wrapperClassName="w-full"
                >
                  {field.enumValues.map((value) => (
                    <option
                      key={value}
                      value={value}
                    >
                      {value}
                    </option>
                  ))}
                </MarbleSelect>
              ) : (
                <InterpolationEditor
                  currentTableId={currentTableId}
                  onChange={(nextValue) =>
                    updateFieldValue(field.key, {
                      ...fieldValue,
                      value: nextValue,
                    })
                  }
                  placeholder={
                    field.type === "object"
                      ? field.required
                        ? '{"key": "value"}'
                        : "leave blank or JSON"
                      : field.type === "array"
                        ? "[]"
                        : undefined
                  }
                  referenceColumns={referenceColumns}
                  value={fieldValue.value}
                />
              )
            ) : (
              <ColumnDependencySelect
                columns={referenceColumns}
                currentTableId={currentTableId}
                onChange={(value) =>
                  updateFieldValue(field.key, {
                    mode: "column",
                    value,
                  })
                }
                path={fieldValue.path}
                value={fieldValue.value}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};
