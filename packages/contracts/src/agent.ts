import { z } from "zod";
import { providerIdSchema } from "./onboarding";

export const agentRunStatusSchema = z.enum([
  "running",
  "awaiting_approval",
  "needs_input",
  "succeeded",
  "failed",
  "blocked",
]);
export type AgentRunStatus = z.infer<typeof agentRunStatusSchema>;

export const agentPlanItemStatusSchema = z.enum(["pending", "running", "completed", "failed", "blocked"]);
export type AgentPlanItemStatus = z.infer<typeof agentPlanItemStatusSchema>;

export const agentToolKindSchema = z.enum(["computer.inspect", "shell.command", "filesystem.read", "filesystem.search"]);
export type AgentToolKind = z.infer<typeof agentToolKindSchema>;

export const agentToolCallStatusSchema = z.enum(["completed", "failed", "awaiting_approval", "blocked"]);
export type AgentToolCallStatus = z.infer<typeof agentToolCallStatusSchema>;

export const agentPlanItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  detail: z.string().nullable(),
  status: agentPlanItemStatusSchema,
});
export type AgentPlanItem = z.infer<typeof agentPlanItemSchema>;

export const agentToolCallSchema = z.object({
  id: z.string(),
  kind: agentToolKindSchema,
  status: agentToolCallStatusSchema,
  summary: z.string(),
  input: z.string().nullable(),
  command: z.string().nullable(),
  outputPreview: z.string().nullable(),
  terminalEntryId: z.string().nullable(),
  approvalId: z.string().nullable(),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
});
export type AgentToolCall = z.infer<typeof agentToolCallSchema>;

export const agentRunSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  title: z.string(),
  goal: z.string(),
  status: agentRunStatusSchema,
  provider: providerIdSchema.nullable(),
  model: z.string().nullable(),
  autoResume: z.boolean(),
  maxIterations: z.number().int().positive(),
  iteration: z.number().int().nonnegative(),
  startedAt: z.string(),
  updatedAt: z.string(),
  finishedAt: z.string().nullable(),
  pendingApprovalId: z.string().nullable(),
  lastAssistantMessage: z.string().nullable(),
  summary: z.string().nullable(),
  plan: z.array(agentPlanItemSchema),
  toolCalls: z.array(agentToolCallSchema),
});
export type AgentRun = z.infer<typeof agentRunSchema>;
