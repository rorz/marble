import { z } from "zod";

export const ColumnProgramInputSchema = z.object({
  variables: z.record(
    z.string(),
    z.object({
      name: z.string(),
      description: z.string(),
      $marble__use_cell_value: z
        .boolean()
        .nullish()
        .describe(
          "Special override allowing a user-inputtable cell value to be used as the variable input. Not really designed for anything but the base user-input program.",
        ),
    }),
  ),
});

export const ColumnProgramInputValues = z.object({
  variables: z.record(
    z.string(),
    z.object({
      value: z.string(),
    }),
  ),
});

export const ColumnProgramOutputSchema = z.object({});
