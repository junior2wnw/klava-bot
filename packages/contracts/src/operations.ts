import { z } from "zod";

export const operationStatusSchema = z.enum(["draft", "running", "awaiting_approval", "succeeded", "failed"]);
export const operationStepStatusSchema = z.enum([
  "pending",
  "running",
  "awaiting_approval",
  "succeeded",
  "failed",
  "blocked",
]);
export const operationStepKindSchema = z.enum(["note", "terminal"]);

export type OperationStatus = z.infer<typeof operationStatusSchema>;
export type OperationStepStatus = z.infer<typeof operationStepStatusSchema>;
export type OperationStepKind = z.infer<typeof operationStepKindSchema>;

export const operationStepSchema = z.object({
  id: z.string(),
  title: z.string(),
  detail: z.string().nullable(),
  kind: operationStepKindSchema,
  command: z.string().nullable(),
  status: operationStepStatusSchema,
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  terminalEntryId: z.string().nullable(),
  approvalId: z.string().nullable(),
});

export type OperationStep = z.infer<typeof operationStepSchema>;

export const operationRunSchema = z.object({
  id: z.string(),
  title: z.string(),
  goal: z.string(),
  summary: z.string().nullable(),
  status: operationStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  activeStepId: z.string().nullable(),
  steps: z.array(operationStepSchema),
});

export type OperationRun = z.infer<typeof operationRunSchema>;

export const createOperationRequestSchema = z.object({
  title: z.string().trim().min(1).max(120),
  goal: z.string().trim().min(1).max(300),
  summary: z.string().trim().max(280).optional(),
  steps: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(120),
        detail: z.string().trim().max(280).optional(),
        command: z.string().trim().min(1).max(400).nullable(),
      }),
    )
    .min(1)
    .max(12),
});

export type CreateOperationRequest = z.infer<typeof createOperationRequestSchema>;
