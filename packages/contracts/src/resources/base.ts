import z from "zod";

export const baseEntitySchema = z.object({
  createdAt: z.iso.datetime(),
  id: z.uuidv7(),
  updatedAt: z.iso.datetime(),
});
