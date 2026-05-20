import { z } from "zod";

export const requestSchema = z.object({
  context: z
    .object({
      currentResource: z
        .object({
          href: z.string(),
          id: z.string(),
          kind: z.enum([
            "pipe",
            "program",
            "project",
            "source",
            "table",
          ]),
          label: z.string(),
          parent: z
            .object({
              href: z.string(),
              id: z.string(),
              kind: z.literal("project"),
              label: z.string(),
            })
            .optional(),
        })
        .optional(),
      pathname: z.string(),
      search: z.string(),
    })
    .optional(),
  history: z
    .array(
      z.object({
        content: z.string(),
        role: z.enum([
          "assistant",
          "user",
        ]),
      }),
    )
    .max(12)
    .optional(),
  message: z.string().min(1),
});

export type AgentChatRequest = z.infer<typeof requestSchema>;
