import type { buildFieldsFromSchema } from "../schema-fields";

type ColumnFieldValue = {
  mode: "column" | "static";
  value: string;
};

export type ColumnFieldValues = Record<string, ColumnFieldValue>;

export type ColumnInputField = ReturnType<typeof buildFieldsFromSchema>[number];
