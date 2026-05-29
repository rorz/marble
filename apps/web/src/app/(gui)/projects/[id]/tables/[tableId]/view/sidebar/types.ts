import type { buildFieldsFromSchema } from "../schema-fields";

type StaticColumnFieldValue = {
  mode: "static";
  value: string;
};

type ColumnDependencyFieldValue = {
  mode: "column";
  path?: string;
  value: string;
};

type ColumnFieldValue = ColumnDependencyFieldValue | StaticColumnFieldValue;

export type ColumnFieldValues = Record<string, ColumnFieldValue>;

export type ColumnInputField = ReturnType<typeof buildFieldsFromSchema>[number];
