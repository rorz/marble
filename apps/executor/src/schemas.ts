import { RunReturnValue } from "@marble/contracts";
import { z } from "zod";

export const BODY_LIMIT_BYTES = 1024 * 1024;

export const RunQuerySchema = z.object({
  run_id: z.string().uuid(),
});

export const TestQuerySchema = z.object({
  programVersionId: z.string().uuid(),
  testKey: z.string().min(1).optional(),
});

export const JsonContentTypeSchema = z.object({
  "content-type": z
    .string()
    .refine(
      (value) => value.toLowerCase().includes("application/json"),
      "Content-Type must be application/json",
    ),
});

export const TestBodySchema = z.object({
  input: z.json(),
});

export const BatchRunBodySchema = z.object({
  runIds: z.array(z.string().uuid()).min(1),
});

export const RunEnvelopeSchema = z.object({
  output: RunReturnValue,
  success: z.boolean(),
});

export const BatchRunItemSchema = z.object({
  cellId: z.string().uuid(),
  output: RunReturnValue,
  runId: z.string().uuid(),
  success: z.boolean(),
});

export const BatchRunEnvelopeSchema = z.object({
  results: z.array(BatchRunItemSchema),
  success: z.boolean(),
});

export const ErrorResponseSchema = z.object({
  detail: z.json().optional(),
  error: z.literal(true),
  message: z.string(),
  requestId: z.string(),
});

export type LiveRunValidatedRequest = {
  valid(target: "query"): z.infer<typeof RunQuerySchema>;
};

export type TestValidatedRequest = {
  valid(target: "json"): z.infer<typeof TestBodySchema>;
  valid(target: "query"): z.infer<typeof TestQuerySchema>;
};

export type LiveBatchValidatedRequest = {
  valid(target: "json"): z.infer<typeof BatchRunBodySchema>;
};
