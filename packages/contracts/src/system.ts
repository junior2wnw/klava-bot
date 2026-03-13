import { z } from "zod";

export const gpuVendorSchema = z.enum(["nvidia", "amd", "intel", "apple", "unknown"]);
export type GpuVendor = z.infer<typeof gpuVendorSchema>;

export const gpuDeviceSchema = z.object({
  name: z.string().min(1),
  vendor: gpuVendorSchema,
  integrated: z.boolean(),
  memoryGb: z.number().nonnegative().nullable(),
});

export type GpuDevice = z.infer<typeof gpuDeviceSchema>;

export const machineProfileSchema = z.object({
  detectedAt: z.string(),
  platform: z.string().min(1),
  platformLabel: z.string().min(1),
  osVersion: z.string().min(1),
  architecture: z.string().min(1),
  cpuModel: z.string().nullable(),
  physicalCores: z.number().int().nonnegative().nullable(),
  logicalCores: z.number().int().positive(),
  memoryGb: z.number().positive(),
  gpus: z.array(gpuDeviceSchema),
});

export type MachineProfile = z.infer<typeof machineProfileSchema>;

export const localRuntimeSchema = z.enum(["ollama", "vllm"]);
export type LocalRuntime = z.infer<typeof localRuntimeSchema>;

export const localRuntimeVerdictSchema = z.enum(["recommended", "workable", "not_recommended"]);
export type LocalRuntimeVerdict = z.infer<typeof localRuntimeVerdictSchema>;

export const localModelRecommendationSchema = z.object({
  modelId: z.string().min(1),
  summary: z.string().min(1),
  rationale: z.string().min(1),
  installCommand: z.string().min(1).nullable(),
});

export type LocalModelRecommendation = z.infer<typeof localModelRecommendationSchema>;

export const localRuntimeOptionSchema = z.object({
  runtime: localRuntimeSchema,
  recommended: z.boolean(),
  summary: z.string().min(1),
  reasons: z.array(z.string().min(1)),
  apiBaseUrl: z.string().min(1),
  modelRecommendation: localModelRecommendationSchema.nullable(),
});

export type LocalRuntimeOption = z.infer<typeof localRuntimeOptionSchema>;

export const localRuntimeAdviceSchema = z.object({
  verdict: localRuntimeVerdictSchema,
  summary: z.string().min(1),
  reasons: z.array(z.string().min(1)),
  recommendedRuntime: localRuntimeSchema.nullable(),
  cloudFallbackProvider: z.enum(["openai", "gemini", "groq", "openrouter"]).nullable(),
  options: z.array(localRuntimeOptionSchema),
});

export type LocalRuntimeAdvice = z.infer<typeof localRuntimeAdviceSchema>;
