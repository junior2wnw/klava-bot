import { z } from "zod";
import { localRuntimeSchema } from "./system";

export const providerIdSchema = z.enum(["gonka", "openai", "gemini", "groq", "openrouter", "local"]);
export type ProviderId = z.infer<typeof providerIdSchema>;

export const providerSelectionModeSchema = z.enum(["auto", "manual"]);
export type ProviderSelectionMode = z.infer<typeof providerSelectionModeSchema>;

export const providerBalanceSchema = z.object({
  denom: z.string().min(1),
  amount: z.string().min(1),
  displayAmount: z.string().min(1),
  displayDenom: z.string().min(1),
  asOf: z.string(),
  sourceUrl: z.string().min(1),
});

export type ProviderBalance = z.infer<typeof providerBalanceSchema>;

const sharedProviderSettingsSchema = z.object({
  selectionMode: providerSelectionModeSchema,
  model: z.string().min(1),
  availableModels: z.array(z.string().min(1)),
  secretConfigured: z.boolean(),
  validatedAt: z.string().nullable(),
  modelRefreshedAt: z.string().nullable(),
});

export const gonkaProviderSettingsSchema = sharedProviderSettingsSchema.extend({
  provider: z.literal("gonka"),
  selectionMode: z.literal("auto"),
  requesterAddress: z.string().nullable(),
  balance: providerBalanceSchema.nullable(),
});

const sharedApiProviderSettingsSchema = sharedProviderSettingsSchema.extend({
  requesterAddress: z.null(),
  balance: z.null(),
  apiBaseUrl: z.string().min(1),
});

export const openAiProviderSettingsSchema = sharedApiProviderSettingsSchema.extend({
  provider: z.literal("openai"),
});

export const geminiProviderSettingsSchema = sharedApiProviderSettingsSchema.extend({
  provider: z.literal("gemini"),
});

export const groqProviderSettingsSchema = sharedApiProviderSettingsSchema.extend({
  provider: z.literal("groq"),
});

export const openRouterProviderSettingsSchema = sharedApiProviderSettingsSchema.extend({
  provider: z.literal("openrouter"),
});

export const localProviderSettingsSchema = sharedApiProviderSettingsSchema.extend({
  provider: z.literal("local"),
  localRuntime: localRuntimeSchema,
});

export const providerSettingsSchema = z.discriminatedUnion("provider", [
  gonkaProviderSettingsSchema,
  openAiProviderSettingsSchema,
  geminiProviderSettingsSchema,
  groqProviderSettingsSchema,
  openRouterProviderSettingsSchema,
  localProviderSettingsSchema,
]);

export type ProviderSettings = z.infer<typeof providerSettingsSchema>;

const gonkaOnboardingValidateRequestSchema = z.object({
  provider: z.literal("gonka"),
  secret: z.string().trim().optional().nullable(),
  walletAddress: z.string().trim().min(1).optional().nullable(),
  mnemonicPassphrase: z.string().optional().nullable(),
});

const openAiOnboardingValidateRequestSchema = z.object({
  provider: z.literal("openai"),
  secret: z.string().trim().optional().nullable(),
});

const geminiOnboardingValidateRequestSchema = z.object({
  provider: z.literal("gemini"),
  secret: z.string().trim().optional().nullable(),
});

const groqOnboardingValidateRequestSchema = z.object({
  provider: z.literal("groq"),
  secret: z.string().trim().optional().nullable(),
});

const openRouterOnboardingValidateRequestSchema = z.object({
  provider: z.literal("openrouter"),
  secret: z.string().trim().optional().nullable(),
});

const localOnboardingValidateRequestSchema = z.object({
  provider: z.literal("local"),
  secret: z.string().trim().optional().nullable(),
  localRuntime: localRuntimeSchema,
  apiBaseUrl: z.string().trim().min(1).optional().nullable(),
});

export const onboardingValidateRequestSchema = z.discriminatedUnion("provider", [
  gonkaOnboardingValidateRequestSchema,
  openAiOnboardingValidateRequestSchema,
  geminiOnboardingValidateRequestSchema,
  groqOnboardingValidateRequestSchema,
  openRouterOnboardingValidateRequestSchema,
  localOnboardingValidateRequestSchema,
]);

export type OnboardingValidateRequest = z.infer<typeof onboardingValidateRequestSchema>;

const sharedOnboardingValidateResponseSchema = z.object({
  ok: z.boolean(),
  selectionMode: providerSelectionModeSchema,
  model: z.string(),
  availableModels: z.array(z.string().min(1)),
  message: z.string(),
});

const gonkaOnboardingValidateResponseSchema = sharedOnboardingValidateResponseSchema.extend({
  provider: z.literal("gonka"),
  selectionMode: z.literal("auto"),
});

const openAiOnboardingValidateResponseSchema = sharedOnboardingValidateResponseSchema.extend({
  provider: z.literal("openai"),
});

const geminiOnboardingValidateResponseSchema = sharedOnboardingValidateResponseSchema.extend({
  provider: z.literal("gemini"),
});

const groqOnboardingValidateResponseSchema = sharedOnboardingValidateResponseSchema.extend({
  provider: z.literal("groq"),
});

const openRouterOnboardingValidateResponseSchema = sharedOnboardingValidateResponseSchema.extend({
  provider: z.literal("openrouter"),
});

const localOnboardingValidateResponseSchema = sharedOnboardingValidateResponseSchema.extend({
  provider: z.literal("local"),
});

export const onboardingValidateResponseSchema = z.discriminatedUnion("provider", [
  gonkaOnboardingValidateResponseSchema,
  openAiOnboardingValidateResponseSchema,
  geminiOnboardingValidateResponseSchema,
  groqOnboardingValidateResponseSchema,
  openRouterOnboardingValidateResponseSchema,
  localOnboardingValidateResponseSchema,
]);

export type OnboardingValidateResponse = z.infer<typeof onboardingValidateResponseSchema>;

export const setProviderModelRequestSchema = z.object({
  model: z.string().trim().min(1),
});

export type SetProviderModelRequest = z.infer<typeof setProviderModelRequestSchema>;

export const gonkaWalletBalanceQuerySchema = z.object({
  address: z.string().trim().min(1),
});

export type GonkaWalletBalanceQuery = z.infer<typeof gonkaWalletBalanceQuerySchema>;

export const gonkaWalletBalanceResponseSchema = z.object({
  ok: z.literal(true),
  address: z.string(),
  balance: providerBalanceSchema,
});

export type GonkaWalletBalanceResponse = z.infer<typeof gonkaWalletBalanceResponseSchema>;
