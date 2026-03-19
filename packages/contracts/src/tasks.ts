import { z } from "zod";
import { agentRunSchema } from "./agent";
import { approvalRequestSchema } from "./approvals";
import { operationRunSchema } from "./operations";

export const taskStatusSchema = z.enum([
  "idle",
  "running",
  "awaiting_approval",
  "succeeded",
  "failed",
]);

export const surfaceModeSchema = z.enum(["chat", "terminal", "pro", "openclaw"]);
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

export const taskMessagePresentationSchema = z.enum(["message", "status", "artifact"]);
export type TaskMessagePresentation = z.infer<typeof taskMessagePresentationSchema>;

export const taskMessageStatusStateSchema = z.enum(["info", "running", "awaiting_approval", "succeeded", "failed"]);
export type TaskMessageStatusState = z.infer<typeof taskMessageStatusStateSchema>;

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
      computerSkill: z.string().nullable().optional(),
      computerIntent: z.string().nullable().optional(),
      agentRunId: z.string().nullable().optional(),
      agentToolCallId: z.string().nullable().optional(),
      agentToolKind: z.string().nullable().optional(),
      presentation: taskMessagePresentationSchema.optional(),
      statusState: taskMessageStatusStateSchema.nullable().optional(),
      terminalEntryId: z.string().nullable().optional(),
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

export const taskMemoryEntryKindSchema = z.enum(["goal", "constraint", "preference", "decision", "fact", "open_loop"]);
export type TaskMemoryEntryKind = z.infer<typeof taskMemoryEntryKindSchema>;

export const taskMemoryEntryStatusSchema = z.enum(["active", "resolved", "stale"]);
export type TaskMemoryEntryStatus = z.infer<typeof taskMemoryEntryStatusSchema>;

export const taskMemoryEntrySchema = z.object({
  id: z.string(),
  kind: taskMemoryEntryKindSchema,
  content: z.string(),
  sourceMessageId: z.string().nullable(),
  sourceRunId: z.string().nullable(),
  score: z.number().nonnegative(),
  status: taskMemoryEntryStatusSchema,
  updatedAt: z.string(),
});

export type TaskMemoryEntry = z.infer<typeof taskMemoryEntrySchema>;

export const taskMemorySchema = z.object({
  summary: z.string().nullable(),
  updatedAt: z.string().nullable(),
  entries: z.array(taskMemoryEntrySchema),
});

export type TaskMemory = z.infer<typeof taskMemorySchema>;

export const taskResumeModeSchema = z.enum(["continue_agent", "awaiting_approval", "retry_operation"]);
export type TaskResumeMode = z.infer<typeof taskResumeModeSchema>;

export const taskResumeStateSchema = z.object({
  mode: taskResumeModeSchema,
  taskId: z.string(),
  reason: z.string(),
  preferredLanguage: z.enum(["en", "ru"]).nullable(),
  recoverable: z.boolean(),
  agentRunId: z.string().nullable(),
  operationId: z.string().nullable(),
  approvalId: z.string().nullable(),
  updatedAt: z.string(),
});

export type TaskResumeState = z.infer<typeof taskResumeStateSchema>;

export const taskJournalScopeSchema = z.enum([
  "task",
  "message",
  "agent",
  "terminal",
  "approval",
  "operation",
  "runtime",
  "retrieval",
]);
export type TaskJournalScope = z.infer<typeof taskJournalScopeSchema>;

export const taskJournalLevelSchema = z.enum(["info", "warning", "error"]);
export type TaskJournalLevel = z.infer<typeof taskJournalLevelSchema>;

export const taskJournalEventSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  scope: taskJournalScopeSchema,
  kind: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(200),
  detail: z.string().trim().max(2_000).nullable(),
  level: taskJournalLevelSchema,
  taskStatus: taskStatusSchema,
  createdAt: z.string(),
  agentRunId: z.string().nullable(),
  operationId: z.string().nullable(),
  approvalId: z.string().nullable(),
  terminalEntryId: z.string().nullable(),
  toolCallId: z.string().nullable(),
});

export type TaskJournalEvent = z.infer<typeof taskJournalEventSchema>;

export const taskExecutionJournalSchema = z.object({
  updatedAt: z.string().nullable(),
  activeResume: taskResumeStateSchema.nullable(),
  events: z.array(taskJournalEventSchema),
});

export type TaskExecutionJournal = z.infer<typeof taskExecutionJournalSchema>;

export const taskDetailSchema = taskSummarySchema.extend({
  messages: z.array(taskMessageSchema),
  terminalEntries: z.array(terminalEntrySchema),
  approvals: z.array(approvalRequestSchema),
  operations: z.array(operationRunSchema),
  agentRuns: z.array(agentRunSchema),
  memory: taskMemorySchema,
  journal: taskExecutionJournalSchema,
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
