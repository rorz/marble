import { MarbleFieldLabel, MarbleSelect } from "@marble/ui";
import type { Dispatch, SetStateAction } from "react";
import { InterpolationEditor } from "../interpolation-editor";
import type { ReferenceableColumn } from "../types";
import type { ColumnFieldValues, ColumnInputField } from "./types";

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
                    setFieldValues((current) => ({
                      ...current,
                      [field.key]: {
                        mode: "static",
                        value:
                          field.defaultValue ?? field.enumValues?.[0] ?? "",
                      },
                    }))
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
                    setFieldValues((current) => ({
                      ...current,
                      [field.key]: {
                        mode: "column",
                        value: referenceColumns[0]?.id ?? "",
                      },
                    }))
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
                    setFieldValues((current) => ({
                      ...current,
                      [field.key]: {
                        ...fieldValue,
                        value: event.target.value,
                      },
                    }))
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
                    setFieldValues((current) => ({
                      ...current,
                      [field.key]: {
                        ...fieldValue,
                        value: nextValue,
                      },
                    }))
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
              <MarbleSelect
                onChange={(event) =>
                  setFieldValues((current) => ({
                    ...current,
                    [field.key]: {
                      ...fieldValue,
                      value: event.target.value,
                    },
                  }))
                }
                size="xs"
                value={fieldValue.value}
                wrapperClassName="w-full"
              >
                <option
                  disabled
                  value=""
                >
                  Pick a column...
                </option>
                {referenceColumns.map((column) => (
                  <option
                    key={column.id}
                    value={column.id}
                  >
                    {column.label}
                    {column.allowManualInput ? " (input)" : ""}
                  </option>
                ))}
              </MarbleSelect>
            )}
          </div>
        );
      })}
    </div>
  );
};
