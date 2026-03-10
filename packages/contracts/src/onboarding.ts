import { z } from "zod";

export const providerSelectionModeSchema = z.literal("auto");

export const providerBalanceSchema = z.object({
  denom: z.string().min(1),
  amount: z.string().min(1),
  displayAmount: z.string().min(1),
  displayDenom: z.string().min(1),
  asOf: z.string(),
  sourceUrl: z.string().min(1),
});

export type ProviderBalance = z.infer<typeof providerBalanceSchema>;

export const providerSettingsSchema = z.object({
  provider: z.literal("gonka"),
  selectionMode: providerSelectionModeSchema,
  model: z.string().min(1),
  secretConfigured: z.boolean(),
  requesterAddress: z.string().nullable(),
  balance: providerBalanceSchema.nullable(),
  validatedAt: z.string().nullable(),
  modelRefreshedAt: z.string().nullable(),
});

export type ProviderSettings = z.infer<typeof providerSettingsSchema>;

export const onboardingValidateRequestSchema = z.object({
  provider: z.literal("gonka"),
  secret: z.string().trim().min(1),
  walletAddress: z.string().trim().min(1).optional().nullable(),
  mnemonicPassphrase: z.string().optional().nullable(),
});

export type OnboardingValidateRequest = z.infer<typeof onboardingValidateRequestSchema>;

export const onboardingValidateResponseSchema = z.object({
  ok: z.boolean(),
  provider: z.literal("gonka"),
  selectionMode: providerSelectionModeSchema,
  model: z.string(),
  message: z.string(),
});

export type OnboardingValidateResponse = z.infer<typeof onboardingValidateResponseSchema>;

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
