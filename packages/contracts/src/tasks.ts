import { z } from "zod";
import { approvalRequestSchema } from "./approvals";
import { operationRunSchema } from "./operations";

export const taskStatusSchema = z.enum([
  "idle",
  "running",
  "awaiting_approval",
  "succeeded",
  "failed",
]);

export const surfaceModeSchema = z.enum(["chat", "terminal", "pro"]);
export const guardModeSchema = z.enum(["strict", "balanced", "off"]);

export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type SurfaceMode = z.infer<typeof surfaceModeSchema>;
export type GuardMode = z.infer<typeof guardModeSchema>;

export const taskSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  status: taskStatusSchema,
  guardMode: guardModeSchema,
  updatedAt: z.string(),
  createdAt: z.string(),
  lastMessagePreview: z.string().nullable(),
  pendingApprovalCount: z.number().int().nonnegative(),
});

export type TaskSummary = z.infer<typeof taskSummarySchema>;

export const messageRoleSchema = z.enum(["system", "user", "assistant", "tool"]);
export type MessageRole = z.infer<typeof messageRoleSchema>;

export const taskMessageSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  role: messageRoleSchema,
  content: z.string(),
  createdAt: z.string(),
  meta: z
    .object({
      terminalCommand: z.string().nullable().optional(),
      pendingApprovalId: z.string().nullable().optional(),
    })
    .default({}),
});

export type TaskMessage = z.infer<typeof taskMessageSchema>;

export const terminalEntrySchema = z.object({
  id: z.string(),
  taskId: z.string(),
  command: z.string(),
  output: z.string(),
  exitCode: z.number().int(),
  status: z.enum(["completed", "failed", "blocked", "pending_approval"]),
  createdAt: z.string(),
});

export type TerminalEntry = z.infer<typeof terminalEntrySchema>;

export const taskDetailSchema = taskSummarySchema.extend({
  messages: z.array(taskMessageSchema),
  terminalEntries: z.array(terminalEntrySchema),
  approvals: z.array(approvalRequestSchema),
  operations: z.array(operationRunSchema),
});

export type TaskDetail = z.infer<typeof taskDetailSchema>;

export const createTaskRequestSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
});

export type CreateTaskRequest = z.infer<typeof createTaskRequestSchema>;

export const sendMessageRequestSchema = z.object({
  content: z.string().min(1),
});

export type SendMessageRequest = z.infer<typeof sendMessageRequestSchema>;

export const executeTerminalRequestSchema = z.object({
  command: z.string().min(1),
});

export type ExecuteTerminalRequest = z.infer<typeof executeTerminalRequestSchema>;

export const setGuardModeRequestSchema = z.object({
  mode: guardModeSchema,
});

export type SetGuardModeRequest = z.infer<typeof setGuardModeRequestSchema>;
