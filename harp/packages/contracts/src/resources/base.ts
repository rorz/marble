import z from "zod";

const timestampSchema = z.iso.datetime({
  offset: true,
});

export const baseEntitySchema = z.object({
  createdAt: timestampSchema,
  id: z.string(),
  updatedAt: timestampSchema,
});
