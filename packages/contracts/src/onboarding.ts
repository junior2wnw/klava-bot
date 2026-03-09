import { z } from "zod";

export const providerSelectionModeSchema = z.literal("auto");

export const providerSettingsSchema = z.object({
  provider: z.literal("openai"),
  selectionMode: providerSelectionModeSchema,
  model: z.string().min(1),
  apiKeyConfigured: z.boolean(),
  validatedAt: z.string().nullable(),
  modelRefreshedAt: z.string().nullable(),
});

export type ProviderSettings = z.infer<typeof providerSettingsSchema>;

export const onboardingValidateRequestSchema = z.object({
  provider: z.literal("openai"),
  apiKey: z.string().min(10),
});

export type OnboardingValidateRequest = z.infer<typeof onboardingValidateRequestSchema>;

export const onboardingValidateResponseSchema = z.object({
  ok: z.boolean(),
  provider: z.literal("openai"),
  selectionMode: providerSelectionModeSchema,
  model: z.string(),
  message: z.string(),
});

export type OnboardingValidateResponse = z.infer<typeof onboardingValidateResponseSchema>;
