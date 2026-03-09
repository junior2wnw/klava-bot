import { z } from "zod";
import { healthResponseSchema } from "./health";
import { providerSettingsSchema } from "./onboarding";
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
});

export const supportBundleSchema = z.object({
  generatedAt: z.string(),
  health: healthResponseSchema,
  provider: providerSettingsSchema,
  tasks: z.array(supportBundleTaskSchema),
});

export type SupportBundle = z.infer<typeof supportBundleSchema>;
