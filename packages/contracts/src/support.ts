import { z } from "zod";
import { healthResponseSchema } from "./health";
import { providerSettingsSchema } from "./onboarding";
import { localRuntimeAdviceSchema, machineProfileSchema } from "./system";
import { guardModeSchema, taskStatusSchema } from "./tasks";

export const supportBundleTaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: taskStatusSchema,
  guardMode: guardModeSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  pendingApprovalCount: z.number().int().nonnegative(),
  messageCount: z.number().int().nonnegative(),
  terminalEntryCount: z.number().int().nonnegative(),
  approvalCount: z.number().int().nonnegative(),
  operationCount: z.number().int().nonnegative(),
  agentRunCount: z.number().int().nonnegative(),
});

export const supportBundleLogsSchema = z.object({
  path: z.string(),
  recentEvents: z.array(z.string()),
});

export const supportBundleSchema = z.object({
  generatedAt: z.string(),
  health: healthResponseSchema,
  provider: providerSettingsSchema,
  machineProfile: machineProfileSchema,
  localRuntimeAdvice: localRuntimeAdviceSchema,
  tasks: z.array(supportBundleTaskSchema),
  logs: supportBundleLogsSchema,
});

export type SupportBundle = z.infer<typeof supportBundleSchema>;
