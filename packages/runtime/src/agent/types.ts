import { z } from "zod";

export const agentDecisionPlanItemSchema = z.object({
  title: z.string().trim().min(1).max(160),
  detail: z.string().trim().max(320).nullable().optional(),
  status: z.enum(["pending", "running", "completed", "failed", "blocked"]).default("pending"),
});

export const computerInspectToolSchema = z.object({
  name: z.literal("computer.inspect"),
  instruction: z.string().trim().min(3).max(600),
});

export const filesystemReadToolSchema = z.object({
  name: z.literal("filesystem.read"),
  path: z.string().trim().min(1).max(500),
  maxLines: z.number().int().positive().max(400).optional(),
});

export const filesystemSearchToolSchema = z.object({
  name: z.literal("filesystem.search"),
  pattern: z.string().trim().min(1).max(300),
  path: z.string().trim().max(500).optional(),
  maxResults: z.number().int().positive().max(100).optional(),
});

export const contextRetrieveToolSchema = z.object({
  name: z.literal("context.retrieve"),
  query: z.string().trim().min(2).max(320),
  scope: z.enum(["auto", "workspace", "history"]).optional(),
  maxResults: z.number().int().positive().max(12).optional(),
});

export const shellCommandToolSchema = z.object({
  name: z.literal("shell.command"),
  command: z.string().trim().min(1).max(800),
  reason: z.string().trim().max(300).optional(),
});

export const agentToolSchema = z.discriminatedUnion("name", [
  computerInspectToolSchema,
  filesystemReadToolSchema,
  filesystemSearchToolSchema,
  contextRetrieveToolSchema,
  shellCommandToolSchema,
]);

export const agentDecisionSchema = z
  .object({
    kind: z.enum(["tool", "final", "need_input", "blocked"]),
    summary: z.string().trim().min(1).max(600),
    message: z.string().trim().min(1).max(4_000),
    plan: z.array(agentDecisionPlanItemSchema).max(10).default([]),
    tool: agentToolSchema.optional(),
  })
  .superRefine((value, context) => {
    if (value.kind === "tool" && !value.tool) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "`tool` is required when kind is `tool`.",
        path: ["tool"],
      });
    }

    if (value.kind !== "tool" && value.tool) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "`tool` must be omitted unless kind is `tool`.",
        path: ["tool"],
      });
    }
  });

export type AgentDecision = z.infer<typeof agentDecisionSchema>;
export type AgentDecisionPlanItem = z.infer<typeof agentDecisionPlanItemSchema>;
export type AgentToolRequest = z.infer<typeof agentToolSchema>;
