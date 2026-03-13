import { z } from "zod";
import { providerIdSchema } from "./onboarding";

export const healthResponseSchema = z.object({
  ok: z.boolean(),
  runtimeVersion: z.string(),
  shellVersion: z.string(),
  startedAt: z.string(),
  uptimeMs: z.number().int().nonnegative(),
  storagePath: z.string(),
  activeProvider: providerIdSchema,
  providerConfigured: z.boolean(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
