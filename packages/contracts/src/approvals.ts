import { z } from "zod";

export const riskClassSchema = z.enum(["safe", "guarded", "restricted"]);
export type RiskClass = z.infer<typeof riskClassSchema>;

export const approvalStatusSchema = z.enum(["pending", "approved", "rejected"]);
export type ApprovalStatus = z.infer<typeof approvalStatusSchema>;

export const approvalRequestSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  action: z.string(),
  command: z.string(),
  riskClass: riskClassSchema,
  impact: z.string(),
  requiresAdmin: z.boolean(),
  status: approvalStatusSchema,
  createdAt: z.string(),
  resolvedAt: z.string().nullable(),
  rollbackHint: z.string().nullable(),
});

export type ApprovalRequest = z.infer<typeof approvalRequestSchema>;
