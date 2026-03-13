import { z } from "zod";
import { healthResponseSchema } from "./health";
import { providerSettingsSchema } from "./onboarding";
import { localRuntimeAdviceSchema, machineProfileSchema } from "./system";
import { taskDetailSchema, taskSummarySchema } from "./tasks";

export const workspaceSnapshotSchema = z.object({
  health: healthResponseSchema,
  provider: providerSettingsSchema,
  machineProfile: machineProfileSchema,
  localRuntimeAdvice: localRuntimeAdviceSchema,
  tasks: z.array(taskSummarySchema),
  selectedTaskId: z.string().nullable(),
  selectedTask: taskDetailSchema.nullable(),
});

export type WorkspaceSnapshot = z.infer<typeof workspaceSnapshotSchema>;
