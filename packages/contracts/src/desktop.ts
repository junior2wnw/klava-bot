import { z } from "zod";

export const openClawBridgeModeSchema = z.enum(["embedded_only", "embedded_plus_openclaw"]);
export type OpenClawBridgeMode = z.infer<typeof openClawBridgeModeSchema>;

export const openClawGatewayStatusSchema = z.enum([
  "starting",
  "running",
  "degraded",
  "stopped",
  "unreachable",
  "not_installed",
  "unknown",
]);
export type OpenClawGatewayStatus = z.infer<typeof openClawGatewayStatusSchema>;

export const openClawCapabilitySchema = z.object({
  id: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(240),
  available: z.boolean(),
});
export type OpenClawCapability = z.infer<typeof openClawCapabilitySchema>;

export const openClawBridgeStateSchema = z.object({
  detectedAt: z.string(),
  bridgeMode: openClawBridgeModeSchema,
  managedByDesktop: z.boolean(),
  desktopOwnsGatewayProcess: z.boolean(),
  embeddedRuntimeAvailable: z.boolean(),
  embeddedRuntimeVersion: z.string().nullable(),
  cliAvailable: z.boolean(),
  cliVersion: z.string().nullable(),
  gatewayUrl: z.string().nullable(),
  controlUiUrl: z.string().nullable(),
  gatewayStatus: openClawGatewayStatusSchema,
  controlUiReachable: z.boolean(),
  browserAutomationReady: z.boolean(),
  authConfigured: z.boolean(),
  summary: z.string(),
  notes: z.array(z.string()),
  suggestedActions: z.array(z.string()),
  capabilities: z.array(openClawCapabilitySchema),
});
export type OpenClawBridgeState = z.infer<typeof openClawBridgeStateSchema>;
