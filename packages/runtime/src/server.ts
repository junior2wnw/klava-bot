import Fastify from "fastify";
import type {
  AgentRun,
  ApprovalRequest,
  CreateOperationRequest,
  ExecuteTerminalRequest,
  GonkaWalletBalanceQuery,
  LocalRuntime,
  OnboardingValidateRequest,
  OperationRun,
  OperationStatus,
  OperationStep,
  ProviderId,
  ProviderSettings,
  SetProviderModelRequest,
  SendMessageRequest,
  TaskDetail,
  TaskMessage,
  TerminalEntry,
} from "@klava/contracts";
import {
  createTaskRequestSchema,
  createOperationRequestSchema,
  executeTerminalRequestSchema,
  gonkaWalletBalanceQuerySchema,
  onboardingValidateRequestSchema,
  sendMessageRequestSchema,
  setProviderModelRequestSchema,
  setGuardModeRequestSchema,
} from "@klava/contracts";
import { runAgentLoop } from "./agent/orchestrator";
import { assessAgentObjective, buildBlockedObjectiveMessage } from "./agent/safety";
import {
  DEFAULT_GONKA_MODEL,
  DEFAULT_RUNTIME_HOST,
  DEFAULT_RUNTIME_PORT,
  GONKA_BALANCE_REFRESH_INTERVAL_MS,
  GONKA_PROVIDER_PAUSED_MESSAGE,
  KLAVA_VERSION,
  MODEL_REFRESH_INTERVAL_MS,
} from "./constants";
import { ComputerOperator } from "./computer-operator";
import { GeminiService } from "./gemini-service";
import { GonkaService } from "./gonka-service";
import { GroqService } from "./groq-service";
import { LocalAiService } from "./local-ai-service";
import { RuntimeLogger } from "./logging";
import { OpenAIService } from "./openai-service";
import { OpenRouterService } from "./openrouter-service";
import {
  defaultApiBaseUrlForProvider,
  defaultModelForProvider,
  providerLabel,
  providerSecretName,
  providerSupportsChat,
} from "./provider-catalog";
import { SecretVault } from "./secrets";
import { RuntimeStore, getAppPaths, type AppPaths } from "./storage";
import { analyzeLocalRuntime, detectMachineProfile } from "./system-profile";
import { assessCommand, runCommand } from "./terminal";

type CreateRuntimeOptions = {
  host?: string;
  port?: number;
  paths?: AppPaths;
};

type ExecutionBinding = {
  operationId?: string;
  stepId?: string;
  agentRunId?: string;
  agentToolCallId?: string;
  agentToolKind?: string;
};

type TerminalExecutionResult =
  | {
      kind: "blocked";
      terminalEntry: TerminalEntry;
    }
  | {
      kind: "awaiting_approval";
      terminalEntry: TerminalEntry;
      approval: ApprovalRequest;
    }
  | {
      kind: "completed";
      terminalEntry: TerminalEntry;
      succeeded: boolean;
    };

type ProviderSelectionOptions = {
  force?: boolean;
  throwOnError?: boolean;
  preserveManualSelection?: boolean;
  validateConnection?: boolean;
};

type ApiProviderId = Exclude<ProviderId, "gonka">;

function nowIso() {
  return new Date().toISOString();
}

function isTimestampStale(value: string | null, maxAgeMs: number) {
  if (!value) {
    return true;
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return true;
  }

  return Date.now() - timestamp >= maxAgeMs;
}

function uniqueModels(models: string[]) {
  return [...new Set(models.filter((model) => model.trim().length > 0))];
}

function createMessage(
  taskId: string,
  role: TaskMessage["role"],
  content: string,
  meta: TaskMessage["meta"] = {},
): TaskMessage {
  return {
    id: crypto.randomUUID(),
    taskId,
    role,
    content,
    createdAt: nowIso(),
    meta,
  };
}

function createTerminalEntry(
  taskId: string,
  command: string,
  output: string,
  exitCode: number,
  status: TerminalEntry["status"],
): TerminalEntry {
  return {
    id: crypto.randomUUID(),
    taskId,
    command,
    output,
    exitCode,
    status,
    createdAt: nowIso(),
  };
}

function createApproval(taskId: string, command: string, impact: string, binding?: ExecutionBinding): ApprovalRequest {
  return {
    id: crypto.randomUUID(),
    taskId,
    action: "Guarded terminal command",
    command,
    riskClass: "guarded",
    impact,
    requiresAdmin: false,
    status: "pending",
    createdAt: nowIso(),
    resolvedAt: null,
    rollbackHint: "Review the command and revert the changed package, file, or service manually if needed.",
    meta: {
      operationId: binding?.operationId ?? null,
      operationStepId: binding?.stepId ?? null,
      agentRunId: binding?.agentRunId ?? null,
      agentToolCallId: binding?.agentToolCallId ?? null,
    },
  };
}

function createOperationRun(body: CreateOperationRequest): OperationRun {
  const timestamp = nowIso();
  return {
    id: crypto.randomUUID(),
    title: body.title.trim(),
    goal: body.goal.trim(),
    summary: body.summary?.trim() || null,
    status: "draft",
    createdAt: timestamp,
    updatedAt: timestamp,
    activeStepId: null,
    steps: body.steps.map((step) => ({
      id: crypto.randomUUID(),
      title: step.title.trim(),
      detail: step.detail?.trim() || null,
      kind: step.command ? "terminal" : "note",
      command: step.command?.trim() || null,
      status: "pending",
      startedAt: null,
      finishedAt: null,
      terminalEntryId: null,
      approvalId: null,
    })),
  };
}

function operationStatusToTaskStatus(status: OperationStatus): TaskDetail["status"] {
  return status === "awaiting_approval"
    ? "awaiting_approval"
    : status === "running"
      ? "running"
      : status === "succeeded"
        ? "succeeded"
        : status === "failed"
          ? "failed"
          : "idle";
}

function getActiveOperation(task: TaskDetail) {
  return task.operations.find((operation) =>
    operation.status === "draft" || operation.status === "running" || operation.status === "awaiting_approval",
  );
}

function getNextPendingStep(operation: OperationRun) {
  return operation.steps.find((step) => step.status === "pending") ?? null;
}

function settleOperationStatus(operation: OperationRun) {
  const pendingStep = operation.steps.find((step) => step.status === "pending");
  const awaitingApproval = operation.steps.find((step) => step.status === "awaiting_approval");
  const failedStep = operation.steps.find((step) => step.status === "failed" || step.status === "blocked");

  if (failedStep) {
    operation.status = "failed";
    operation.activeStepId = null;
    return;
  }

  if (awaitingApproval) {
    operation.status = "awaiting_approval";
    operation.activeStepId = awaitingApproval.id;
    return;
  }

  if (pendingStep) {
    operation.status = operation.steps.some((step) => step.status === "succeeded") ? "running" : "draft";
    operation.activeStepId = null;
    return;
  }

  operation.status = "succeeded";
  operation.activeStepId = null;
}

function agentStatusToTaskStatus(status: AgentRun["status"]): TaskDetail["status"] {
  return status === "awaiting_approval"
    ? "awaiting_approval"
    : status === "running"
      ? "running"
      : status === "succeeded"
        ? "succeeded"
        : status === "failed" || status === "blocked"
          ? "failed"
          : "idle";
}

function getActiveAgentRun(task: TaskDetail) {
  return task.agentRuns.find((run) =>
    run.status === "running" || run.status === "awaiting_approval" || run.status === "needs_input",
  );
}

function agentTitleFromGoal(goal: string) {
  const trimmed = goal.trim().replace(/\s+/g, " ");
  return trimmed.length > 84 ? `${trimmed.slice(0, 81)}...` : trimmed;
}

export async function createKlavaRuntime(options: CreateRuntimeOptions = {}) {
  const appPaths = options.paths ?? getAppPaths();
  const store = new RuntimeStore(appPaths);
  const vault = new SecretVault(appPaths);
  const gonka = new GonkaService();
  const openai = new OpenAIService();
  const gemini = new GeminiService();
  const groq = new GroqService();
  const openrouter = new OpenRouterService();
  const localAi = new LocalAiService();
  const runtimeLog = new RuntimeLogger(appPaths);
  const machineProfile = await detectMachineProfile();
  const localRuntimeAdvice = analyzeLocalRuntime(machineProfile);
  const computerOperator = new ComputerOperator({
    machineProfile,
    localRuntimeAdvice,
    logger: runtimeLog,
  });
  await store.init();
  await runtimeLog.log("Runtime initialized.");
  await runtimeLog.log(
    `Machine profile detected. platform=${machineProfile.platform} ram=${machineProfile.memoryGb.toFixed(1)}GB gpus=${machineProfile.gpus.length}.`,
  );

  function preferredLocalRuntime(current?: ProviderSettings | null): LocalRuntime {
    if (current?.provider === "local") {
      return current.localRuntime;
    }

    return localRuntimeAdvice.recommendedRuntime ?? "ollama";
  }

  function labelForProvider(providerId: ProviderId, current?: ProviderSettings | null, localRuntime?: LocalRuntime) {
    return providerLabel(providerId, providerId === "local" ? localRuntime ?? preferredLocalRuntime(current) : "ollama");
  }

  function machineSummaryText() {
    const gpuSummary =
      machineProfile.gpus.length > 0
        ? machineProfile.gpus
            .slice(0, 3)
            .map((gpu) => `${gpu.name}${gpu.memoryGb ? ` ${gpu.memoryGb.toFixed(1)}GB` : ""}`)
            .join("; ")
        : "No GPU details detected";
    return [
      `${machineProfile.platformLabel} ${machineProfile.osVersion} (${machineProfile.architecture})`,
      `CPU ${machineProfile.cpuModel ?? "unknown"} with ${machineProfile.logicalCores} logical cores`,
      `RAM ${machineProfile.memoryGb.toFixed(1)}GB`,
      `GPU ${gpuSummary}`,
    ].join("; ");
  }

  function providerReadyForChat(provider: ProviderSettings) {
    return providerSupportsChat(provider.provider) && provider.secretConfigured;
  }

  function resolveApiBaseUrl(
    providerId: ApiProviderId,
    current?: ProviderSettings | null,
    requestedApiBaseUrl?: string | null,
    requestedLocalRuntime?: LocalRuntime,
  ) {
    const localRuntime = providerId === "local" ? requestedLocalRuntime ?? preferredLocalRuntime(current) : "ollama";
    const fallback =
      (current && current.provider === providerId ? current.apiBaseUrl : null) ??
      defaultApiBaseUrlForProvider(providerId, localRuntime) ??
      defaultApiBaseUrlForProvider("openai") ??
      "";
    const value = requestedApiBaseUrl?.trim().length ? requestedApiBaseUrl.trim() : fallback;
    return value.replace(/\/+$/, "");
  }

  function buildDisconnectedProviderSettings(
    providerId: ProviderId,
    current: ProviderSettings = store.getProvider(),
    overrides: { apiBaseUrl?: string | null; localRuntime?: LocalRuntime } = {},
  ): ProviderSettings {
    const localRuntime = providerId === "local" ? overrides.localRuntime ?? preferredLocalRuntime(current) : "ollama";
    const fallbackModel = defaultModelForProvider(providerId, localRuntime);
    const model = current.provider === providerId && current.model.trim().length > 0 ? current.model : fallbackModel;
    const availableModels = uniqueModels(
      current.provider === providerId && current.availableModels.length ? current.availableModels : [model],
    );

    if (providerId === "gonka") {
      return {
        provider: "gonka",
        selectionMode: "auto",
        model,
        availableModels,
        secretConfigured: false,
        requesterAddress: null,
        balance: null,
        validatedAt: null,
        modelRefreshedAt: null,
      };
    }

    const apiBaseUrl = resolveApiBaseUrl(providerId, current, overrides.apiBaseUrl, localRuntime);
    const base = {
      selectionMode: "auto" as const,
      model,
      availableModels,
      secretConfigured: false,
      requesterAddress: null,
      balance: null,
      apiBaseUrl,
      validatedAt: null,
      modelRefreshedAt: null,
    };

    if (providerId === "openai") {
      return { provider: "openai", ...base };
    }

    if (providerId === "gemini") {
      return { provider: "gemini", ...base };
    }

    if (providerId === "groq") {
      return { provider: "groq", ...base };
    }

    if (providerId === "openrouter") {
      return { provider: "openrouter", ...base };
    }

    return {
      provider: "local",
      ...base,
      localRuntime,
    };
  }

  function buildApiProviderSettings({
    providerId,
    current,
    model,
    availableModels,
    selectionMode,
    secretConfigured,
    validatedAt,
    modelRefreshedAt,
    apiBaseUrl,
    localRuntime,
  }: {
    providerId: ApiProviderId;
    current?: ProviderSettings | null;
    model: string;
    availableModels: string[];
    selectionMode: "auto" | "manual";
    secretConfigured: boolean;
    validatedAt: string | null;
    modelRefreshedAt: string | null;
    apiBaseUrl?: string | null;
    localRuntime?: LocalRuntime;
  }): ProviderSettings {
    const resolvedLocalRuntime = providerId === "local" ? localRuntime ?? preferredLocalRuntime(current) : "ollama";
    const resolvedApiBaseUrl = resolveApiBaseUrl(providerId, current, apiBaseUrl, resolvedLocalRuntime);
    const base = {
      selectionMode,
      model,
      availableModels: uniqueModels([model, ...availableModels]),
      secretConfigured,
      requesterAddress: null,
      balance: null,
      apiBaseUrl: resolvedApiBaseUrl,
      validatedAt,
      modelRefreshedAt,
    };

    if (providerId === "openai") {
      return { provider: "openai", ...base };
    }

    if (providerId === "gemini") {
      return { provider: "gemini", ...base };
    }

    if (providerId === "groq") {
      return { provider: "groq", ...base };
    }

    if (providerId === "openrouter") {
      return { provider: "openrouter", ...base };
    }

    return {
      provider: "local",
      ...base,
      localRuntime: resolvedLocalRuntime,
    };
  }

  async function clearProviderConfiguration(
    providerId: ProviderId = store.getProvider().provider,
    overrides: { apiBaseUrl?: string | null; localRuntime?: LocalRuntime } = {},
  ) {
    const provider = buildDisconnectedProviderSettings(providerId, store.getProvider(), overrides);
    await store.setProvider(provider);
    return provider;
  }

  async function disconnectProvider(providerId: ProviderId = store.getProvider().provider) {
    await vault.deleteSecret(providerSecretName(providerId));
    const provider = await clearProviderConfiguration(providerId);
    await runtimeLog.log(`${labelForProvider(providerId, provider)} disconnected and local secret removed.`);
    return provider;
  }

  async function readConfiguredSecret(providerId: ProviderId = store.getProvider().provider) {
    const optionalSecret = providerId === "local";

    try {
      const secret = await vault.getSecret(providerSecretName(providerId));
      if (!secret?.trim()) {
        if (!optionalSecret && store.getProvider().provider === providerId) {
          await clearProviderConfiguration(providerId);
          await runtimeLog.log(`${labelForProvider(providerId)} secret was missing; provider configuration reset.`);
        }
        return null;
      }

      return secret.trim();
    } catch (error) {
      if (!optionalSecret && store.getProvider().provider === providerId) {
        await clearProviderConfiguration(providerId);
      }
      await runtimeLog.log(
        `${labelForProvider(providerId)} secret could not be read. ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  async function health() {
    const provider = store.getProvider();
    return {
      ok: true,
      runtimeVersion: KLAVA_VERSION,
      shellVersion: KLAVA_VERSION,
      startedAt: store.startedAtIso,
      uptimeMs: store.uptimeMs,
      storagePath: store.storagePath,
      activeProvider: provider.provider,
      providerConfigured: providerReadyForChat(provider),
    };
  }

  async function resolveSubmittedOrStoredSecret(providerId: ProviderId, submittedSecret?: string | null) {
    const trimmedSecret = submittedSecret?.trim() ?? "";
    if (trimmedSecret) {
      return trimmedSecret;
    }

    if (providerId === "local") {
      return null;
    }

    const storedSecret = await readConfiguredSecret(providerId);
    if (storedSecret) {
      return storedSecret;
    }

    throw new Error(`Enter a ${labelForProvider(providerId)} API key.`);
  }

  async function persistProviderSecret(providerId: ProviderId, secret: string | null) {
    if (providerId === "local") {
      if (secret?.trim()) {
        await vault.setSecret(providerSecretName(providerId), secret.trim());
      } else {
        await vault.deleteSecret(providerSecretName(providerId));
      }
      return;
    }

    if (!secret?.trim()) {
      throw new Error(`Enter a ${labelForProvider(providerId)} API key.`);
    }

    await vault.setSecret(providerSecretName(providerId), secret.trim());
  }

  function preferredLocalModels(localRuntime: LocalRuntime) {
    const adviceOption = localRuntimeAdvice.options.find((option) => option.runtime === localRuntime);
    return uniqueModels([
      adviceOption?.modelRecommendation?.modelId ?? defaultModelForProvider("local", localRuntime),
      defaultModelForProvider("local", localRuntime),
    ]);
  }

  function requiredSecret(providerId: ApiProviderId, secret: string | null) {
    if (providerId !== "local" && !secret?.trim()) {
      throw new Error(`Enter a ${labelForProvider(providerId)} API key.`);
    }

    return secret?.trim() ?? null;
  }

  async function listApiProviderModels(
    providerId: ApiProviderId,
    secret: string | null,
    current?: ProviderSettings | null,
    requestedLocalRuntime?: LocalRuntime,
    requestedApiBaseUrl?: string | null,
  ) {
    if (providerId === "openai") {
      return openai.listModels(requiredSecret(providerId, secret) ?? "");
    }

    if (providerId === "gemini") {
      return gemini.listModels(requiredSecret(providerId, secret) ?? "");
    }

    if (providerId === "groq") {
      return groq.listModels(requiredSecret(providerId, secret) ?? "");
    }

    if (providerId === "openrouter") {
      return openrouter.listModels(requiredSecret(providerId, secret) ?? "");
    }

    const localRuntime = requestedLocalRuntime ?? preferredLocalRuntime(current);
    return localAi.listModels({
      secret,
      apiBaseUrl: resolveApiBaseUrl(providerId, current, requestedApiBaseUrl, localRuntime),
      localRuntime,
      preferredModels: preferredLocalModels(localRuntime),
    });
  }

  async function validateApiProviderConnection(
    providerId: ApiProviderId,
    secret: string | null,
    current?: ProviderSettings | null,
    requestedLocalRuntime?: LocalRuntime,
    requestedApiBaseUrl?: string | null,
  ) {
    if (providerId === "openai") {
      return openai.validate(requiredSecret(providerId, secret) ?? "");
    }

    if (providerId === "gemini") {
      return gemini.validate(requiredSecret(providerId, secret) ?? "");
    }

    if (providerId === "groq") {
      return groq.validate(requiredSecret(providerId, secret) ?? "");
    }

    if (providerId === "openrouter") {
      return openrouter.validate(requiredSecret(providerId, secret) ?? "");
    }

    const localRuntime = requestedLocalRuntime ?? preferredLocalRuntime(current);
    return localAi.validate({
      secret,
      apiBaseUrl: resolveApiBaseUrl(providerId, current, requestedApiBaseUrl, localRuntime),
      localRuntime,
      preferredModels: preferredLocalModels(localRuntime),
    });
  }

  async function validateConfiguredProviderModel(provider: ProviderSettings, secret: string | null, model: string) {
    if (provider.provider === "openai") {
      return openai.validateModel(requiredSecret(provider.provider, secret) ?? "", model);
    }

    if (provider.provider === "gemini") {
      return gemini.validateModel(requiredSecret(provider.provider, secret) ?? "", model);
    }

    if (provider.provider === "groq") {
      return groq.validateModel(requiredSecret(provider.provider, secret) ?? "", model);
    }

    if (provider.provider === "openrouter") {
      return openrouter.validateModel(requiredSecret(provider.provider, secret) ?? "", model);
    }

    if (provider.provider === "local") {
      return localAi.validateModel(
        {
          secret,
          apiBaseUrl: provider.apiBaseUrl,
          localRuntime: provider.localRuntime,
          preferredModels: preferredLocalModels(provider.localRuntime),
        },
        model,
      );
    }

    throw new Error("GONKA model validation is paused in this build.");
  }

  async function completeProviderRequest(provider: ProviderSettings, secret: string | null, messages: TaskMessage[]) {
    if (provider.provider === "openai") {
      return openai.complete({
        secret: requiredSecret(provider.provider, secret) ?? "",
        model: provider.model,
        messages,
      });
    }

    if (provider.provider === "gemini") {
      return gemini.complete({
        secret: requiredSecret(provider.provider, secret) ?? "",
        model: provider.model,
        messages,
      });
    }

    if (provider.provider === "groq") {
      return groq.complete({
        secret: requiredSecret(provider.provider, secret) ?? "",
        model: provider.model,
        messages,
      });
    }

    if (provider.provider === "openrouter") {
      return openrouter.complete({
        secret: requiredSecret(provider.provider, secret) ?? "",
        model: provider.model,
        messages,
      });
    }

    if (provider.provider === "local") {
      return localAi.complete({
        secret,
        model: provider.model,
        messages,
        apiBaseUrl: provider.apiBaseUrl,
        localRuntime: provider.localRuntime,
      });
    }

    throw new Error("GONKA provider is paused in this build.");
  }

  function shouldRetryProviderModelSelection(providerId: ProviderId, error: unknown) {
    if (providerId === "openai") {
      return openai.shouldRetryModelSelection(error);
    }

    if (providerId === "gemini") {
      return gemini.shouldRetryModelSelection(error);
    }

    if (providerId === "groq") {
      return groq.shouldRetryModelSelection(error);
    }

    if (providerId === "openrouter") {
      return openrouter.shouldRetryModelSelection(error);
    }

    if (providerId === "local") {
      return localAi.shouldRetryModelSelection(error);
    }

    return false;
  }

  async function setResolvedGonkaModel(current: ProviderSettings, model: string) {
    const provider: ProviderSettings = {
      provider: "gonka",
      selectionMode: "auto",
      model,
      availableModels: uniqueModels([model, ...current.availableModels]),
      secretConfigured: true,
      requesterAddress: current.provider === "gonka" ? current.requesterAddress : null,
      balance: current.provider === "gonka" ? current.balance : null,
      validatedAt: current.validatedAt,
      modelRefreshedAt: nowIso(),
    };

    await store.setProvider(provider);
    return provider;
  }

  async function setResolvedApiModel(current: ProviderSettings, model: string) {
    if (current.provider === "gonka") {
      return current;
    }

    const provider = buildApiProviderSettings({
      providerId: current.provider,
      current,
      model,
      availableModels: current.availableModels,
      selectionMode: current.selectionMode === "manual" ? "manual" : "auto",
      secretConfigured: true,
      validatedAt: current.validatedAt,
      modelRefreshedAt: nowIso(),
      apiBaseUrl: current.apiBaseUrl,
      localRuntime: current.provider === "local" ? current.localRuntime : undefined,
    });

    await store.setProvider(provider);
    return provider;
  }

  async function resolveGonkaSelection(
    secret: string,
    current?: ProviderSettings | null,
    validateConnection = false,
  ) {
    const selection = validateConnection ? await gonka.validate(secret) : await gonka.resolveBestModel();
    const refreshedAt = nowIso();
    const requesterAddress =
      validateConnection && "requesterAddress" in selection && typeof selection.requesterAddress === "string"
        ? selection.requesterAddress
        : current?.provider === "gonka"
          ? current.requesterAddress
          : null;
    const availableModels = uniqueModels([selection.model, ...selection.candidates, current?.model ?? DEFAULT_GONKA_MODEL]);
    const provider: ProviderSettings = {
      provider: "gonka",
      selectionMode: "auto",
      model: selection.model,
      availableModels,
      secretConfigured: true,
      requesterAddress,
      balance: current?.provider === "gonka" ? current.balance : null,
      validatedAt: current?.validatedAt ?? refreshedAt,
      modelRefreshedAt: refreshedAt,
    };

    await store.setProvider(provider);
    return {
      provider,
      candidates: availableModels,
    };
  }

  async function ensureFreshGonkaSelection(secret: string, force = false) {
    const current = store.getProvider();
    const fallbackCandidates = uniqueModels([
      ...(current.provider === "gonka" ? current.availableModels : []),
      current.model || DEFAULT_GONKA_MODEL,
    ]);

    if (current.provider !== "gonka" || !current.secretConfigured) {
      return {
        provider: current,
        candidates: fallbackCandidates,
      };
    }

    if (!force && !isTimestampStale(current.modelRefreshedAt, MODEL_REFRESH_INTERVAL_MS)) {
      return {
        provider: current,
        candidates: fallbackCandidates,
      };
    }

    try {
      return await resolveGonkaSelection(secret, current);
    } catch {
      return {
        provider: current,
        candidates: fallbackCandidates,
      };
    }
  }

  async function resolveApiSelection(
    providerId: ApiProviderId,
    secret: string | null,
    current?: ProviderSettings | null,
    options: ProviderSelectionOptions = {},
    requestedLocalRuntime?: LocalRuntime,
    requestedApiBaseUrl?: string | null,
  ) {
    const refreshedAt = nowIso();
    const localRuntime = providerId === "local" ? requestedLocalRuntime ?? preferredLocalRuntime(current) : "ollama";
    const selection = options.validateConnection
      ? await validateApiProviderConnection(providerId, secret, current, localRuntime, requestedApiBaseUrl)
      : {
          model: undefined,
          models: await listApiProviderModels(providerId, secret, current, localRuntime, requestedApiBaseUrl),
        };
    const availableModels = uniqueModels(selection.models);
    const preserveManualModel =
      options.preserveManualSelection !== false &&
      current?.provider === providerId &&
      current.selectionMode === "manual" &&
      availableModels.includes(current.model);
    const model =
      (preserveManualModel ? current?.model : selection.model) ??
      availableModels[0] ??
      current?.model ??
      defaultModelForProvider(providerId, localRuntime);

    const provider = buildApiProviderSettings({
      providerId,
      current,
      model,
      availableModels,
      selectionMode: preserveManualModel ? "manual" : "auto",
      secretConfigured: true,
      validatedAt: current?.provider === providerId ? current.validatedAt ?? refreshedAt : refreshedAt,
      modelRefreshedAt: refreshedAt,
      apiBaseUrl: requestedApiBaseUrl,
      localRuntime,
    });

    await store.setProvider(provider);
    return {
      provider,
      candidates: provider.availableModels,
    };
  }

  async function ensureFreshApiSelection(
    providerId: ApiProviderId,
    secret: string | null,
    options: ProviderSelectionOptions = {},
    requestedLocalRuntime?: LocalRuntime,
    requestedApiBaseUrl?: string | null,
  ) {
    const current = store.getProvider();
    const localRuntime = providerId === "local" ? requestedLocalRuntime ?? preferredLocalRuntime(current) : "ollama";
    const fallbackCandidates = uniqueModels([
      ...(current.provider === providerId ? current.availableModels : []),
      current.provider === providerId ? current.model : defaultModelForProvider(providerId, localRuntime),
    ]);

    if (current.provider !== providerId || !current.secretConfigured) {
      return {
        provider: current,
        candidates: fallbackCandidates,
      };
    }

    if (!options.force && !isTimestampStale(current.modelRefreshedAt, MODEL_REFRESH_INTERVAL_MS)) {
      return {
        provider: current,
        candidates: fallbackCandidates,
      };
    }

    try {
      return await resolveApiSelection(providerId, secret, current, options, localRuntime, requestedApiBaseUrl);
    } catch (error) {
      if (options.throwOnError) {
        throw error;
      }

      await runtimeLog.log(
        `${labelForProvider(providerId, current, localRuntime)} model refresh fell back to the cached selection. ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        provider: current,
        candidates: fallbackCandidates,
      };
    }
  }

  async function refreshProviderSelectionIfNeeded(force = false) {
    const provider = store.getProvider();
    if (!provider.secretConfigured) {
      return provider;
    }

    const secret = await readConfiguredSecret(provider.provider);
    if (provider.provider !== "local" && !secret) {
      return store.getProvider();
    }

    if (provider.provider === "gonka") {
      const selection = await ensureFreshGonkaSelection(secret ?? "", force);
      return selection.provider;
    }

    if (provider.provider === "local") {
      const selection = await ensureFreshApiSelection(provider.provider, secret, { force }, provider.localRuntime, provider.apiBaseUrl);
      return selection.provider;
    }

    const selection = await ensureFreshApiSelection(provider.provider, secret, { force }, undefined, provider.apiBaseUrl);
    return selection.provider;
  }

  async function refreshProviderBalanceIfNeeded(force = false) {
    const provider = store.getProvider();
    if (provider.provider !== "gonka" || !provider.requesterAddress) {
      return provider;
    }

    if (!force && provider.balance && !isTimestampStale(provider.balance.asOf, GONKA_BALANCE_REFRESH_INTERVAL_MS)) {
      return provider;
    }

    try {
      const balance = await gonka.getBalance(provider.requesterAddress);
      const updatedProvider: ProviderSettings = {
        ...provider,
        balance,
      };
      await store.setProvider(updatedProvider);
      return updatedProvider;
    } catch {
      return provider;
    }
  }

  async function buildSnapshot(taskId?: string | null) {
    if (taskId) {
      await store.selectTask(taskId);
    }
    await refreshProviderSelectionIfNeeded();
    await refreshProviderBalanceIfNeeded();
    return store.getSnapshot(await health(), machineProfile, localRuntimeAdvice);
  }

  async function buildSupportBundle() {
    await refreshProviderBalanceIfNeeded();
    const runtimeHealth = await health();
    return {
      generatedAt: nowIso(),
      health: runtimeHealth,
      provider: store.getProvider(),
      machineProfile,
      localRuntimeAdvice,
      tasks: store.listTaskSummaries().map((task) => {
        const detail = store.getTask(task.id);
        return {
          id: task.id,
          title: task.title,
          status: task.status,
          guardMode: task.guardMode,
          createdAt: task.createdAt,
          updatedAt: task.updatedAt,
          pendingApprovalCount: task.pendingApprovalCount,
          messageCount: detail?.messages.length ?? 0,
          terminalEntryCount: detail?.terminalEntries.length ?? 0,
          approvalCount: detail?.approvals.length ?? 0,
          operationCount: detail?.operations.length ?? 0,
          agentRunCount: detail?.agentRuns.length ?? 0,
        };
      }),
      logs: {
        path: runtimeLog.logPath,
        recentEvents: await runtimeLog.readRecentLines(),
      },
    };
  }

  function buildAgentRun(task: TaskDetail, goal: string, provider: ProviderId | null, model: string | null): AgentRun {
    const timestamp = nowIso();
    return {
      id: crypto.randomUUID(),
      taskId: task.id,
      title: agentTitleFromGoal(goal),
      goal,
      status: "running",
      provider,
      model,
      autoResume: true,
      maxIterations: 8,
      iteration: 0,
      startedAt: timestamp,
      updatedAt: timestamp,
      finishedAt: null,
      pendingApprovalId: null,
      lastAssistantMessage: null,
      summary: null,
      plan: [],
      toolCalls: [],
    };
  }

  async function addAgentTaskMessage(
    taskId: string,
    role: TaskMessage["role"],
    content: string,
    meta: TaskMessage["meta"],
    status?: TaskDetail["status"],
  ) {
    await store.addMessage(taskId, createMessage(taskId, role, content, meta), status);
  }

  async function resolveActiveChatProvider() {
    const provider = store.getProvider();
    if (provider.provider === "gonka") {
      throw new Error(`${GONKA_PROVIDER_PAUSED_MESSAGE} Switch to another provider in provider setup to use Klava right now.`);
    }

    if (!providerReadyForChat(provider)) {
      throw new Error(`${labelForProvider(provider.provider, provider)} is not configured yet. Use provider setup before normal chat responses.`);
    }

    const secret = await readConfiguredSecret(provider.provider);
    if (provider.provider !== "local" && !secret) {
      throw new Error(
        `The saved ${labelForProvider(provider.provider, provider)} API key is unavailable in the current local profile. Please reconnect the provider.`,
      );
    }

    const providerSelection =
      provider.provider === "local"
        ? await ensureFreshApiSelection(provider.provider, secret, {}, provider.localRuntime, provider.apiBaseUrl)
        : await ensureFreshApiSelection(provider.provider, secret, {}, undefined, provider.apiBaseUrl);

    return {
      secret,
      originalProvider: provider,
      providerSelection,
      activeProvider: providerSelection.provider,
    };
  }

  async function completeTaskWithProvider(
    task: TaskDetail,
    provider: ProviderSettings,
    originalProvider: ProviderSettings,
    providerSelection: { provider: ProviderSettings; candidates: string[] },
    secret: string | null,
  ) {
    let activeProvider = provider;
    const attemptedModel =
      activeProvider.model ||
      defaultModelForProvider(activeProvider.provider, activeProvider.provider === "local" ? activeProvider.localRuntime : "ollama");

    try {
      const completion = await completeProviderRequest(activeProvider, secret, task.messages);
      await store.addMessage(task.id, createMessage(task.id, "assistant", completion), "succeeded");
      return { completed: true as const };
    } catch (error) {
      let finalError = error;

      if (activeProvider.provider !== "gonka" && shouldRetryProviderModelSelection(activeProvider.provider, error)) {
        const forcedSelection =
          activeProvider.provider === "local"
            ? await ensureFreshApiSelection(
                activeProvider.provider,
                secret,
                {
                  force: true,
                  preserveManualSelection: false,
                },
                activeProvider.localRuntime,
                activeProvider.apiBaseUrl,
              )
            : await ensureFreshApiSelection(activeProvider.provider, secret, {
                force: true,
                preserveManualSelection: false,
              });
        activeProvider = forcedSelection.provider;
        providerSelection = forcedSelection;

        const retryModels = uniqueModels([
          ...providerSelection.candidates,
          activeProvider.model ||
            defaultModelForProvider(
              activeProvider.provider,
              activeProvider.provider === "local" ? activeProvider.localRuntime : "ollama",
            ),
          originalProvider.model ||
            defaultModelForProvider(
              originalProvider.provider,
              originalProvider.provider === "local" ? originalProvider.localRuntime : "ollama",
            ),
        ]).filter((candidate) => candidate !== attemptedModel);

        for (const candidate of retryModels) {
          try {
            const completion = await completeProviderRequest(
              activeProvider.provider === "gonka" ? originalProvider : { ...activeProvider, model: candidate },
              secret,
              task.messages,
            );

            if (candidate !== activeProvider.model) {
              activeProvider = await setResolvedApiModel(activeProvider, candidate);
            }

            await runtimeLog.log(
              `${labelForProvider(activeProvider.provider, activeProvider, activeProvider.provider === "local" ? activeProvider.localRuntime : undefined)} automatically recovered from model ${attemptedModel} to ${candidate} after a provider-side model error.`,
            );
            await store.addMessage(task.id, createMessage(task.id, "assistant", completion), "succeeded");
            return { completed: true as const };
          } catch (retryError) {
            finalError = retryError;
            if (!shouldRetryProviderModelSelection(activeProvider.provider, retryError)) {
              break;
            }
          }
        }
      }

      const message = finalError instanceof Error ? finalError.message : "Unknown provider error";
      await runtimeLog.log(
        `${labelForProvider(activeProvider.provider, activeProvider, activeProvider.provider === "local" ? activeProvider.localRuntime : undefined)} request failed on model ${attemptedModel}. ${message}`,
      );
      await store.addMessage(
        task.id,
        createMessage(task.id, "assistant", `Provider request failed: ${message}`),
        "failed",
      );
      return { completed: false as const, message };
    }
  }

  async function continueAgentRun(taskId: string, agentRunId: string, resumeReason: string | null) {
    const task = store.getTask(taskId);
    if (!task) {
      throw new Error("Task not found.");
    }

    const existingRun = store.getAgentRun(taskId, agentRunId);
    if (!existingRun) {
      throw new Error("Agent run not found.");
    }

    if (existingRun.status === "awaiting_approval" && existingRun.pendingApprovalId) {
      const approval = task.approvals.find((candidate) => candidate.id === existingRun.pendingApprovalId);
      if (approval?.status === "pending") {
        throw new Error("This agent run is still waiting for approval.");
      }
    }

    const resolved = await resolveActiveChatProvider();
    const outcome = await runAgentLoop(
      {
        taskId,
        providerId: resolved.activeProvider.provider,
        model: resolved.activeProvider.model,
        cwd: process.cwd(),
        guardMode: task.guardMode,
        machineSummary: machineSummaryText(),
        complete: (messages) => completeProviderRequest(resolved.activeProvider, resolved.secret, messages),
        getTask: () => store.getTask(taskId),
        getRun: () => store.getAgentRun(taskId, agentRunId),
        updateRun: (update, status) => store.updateAgentRun(taskId, agentRunId, update, status),
        addToolMessage: (content, meta, status) => addAgentTaskMessage(taskId, "tool", content, meta, status),
        addAssistantMessage: (content, meta, status) => addAgentTaskMessage(taskId, "assistant", content, meta, status),
        computerOperator,
        executeTerminal: (liveTask, command, binding) => executeTerminal(liveTask, command, false, binding),
        logger: runtimeLog,
      },
      resumeReason,
    );

    if (outcome.kind === "fallback") {
      const latestTask = store.getTask(taskId);
      if (latestTask) {
        await completeTaskWithProvider(latestTask, resolved.activeProvider, resolved.originalProvider, resolved.providerSelection, resolved.secret);
      }
    }

    return store.getAgentRun(taskId, agentRunId);
  }

  function getLatestPendingApproval(task: TaskDetail) {
    return [...task.approvals].reverse().find((approval) => approval.status === "pending") ?? null;
  }

  function isApprovalAffirmation(raw: string) {
    const normalized = raw.trim().toLowerCase();
    return [
      "yes",
      "y",
      "approve",
      "approved",
      "confirm",
      "proceed",
      "go ahead",
      "run it",
      "do it",
      "да",
      "ага",
      "подтверждаю",
      "подтвердить",
      "одобряю",
      "разрешаю",
      "запускай",
      "выполняй",
    ].includes(normalized);
  }

  function isApprovalRejection(raw: string) {
    const normalized = raw.trim().toLowerCase();
    return [
      "no",
      "n",
      "reject",
      "rejected",
      "deny",
      "cancel",
      "stop",
      "don't run",
      "do not run",
      "нет",
      "не надо",
      "отклонить",
      "отмена",
      "не выполняй",
      "не запускай",
    ].includes(normalized);
  }

  async function approveResolvedApproval(approvalId: string) {
    const resolved = await store.resolveApproval(approvalId, "approved");
    if (!resolved) {
      return null;
    }

    await store.addMessage(
      resolved.task.id,
      createMessage(resolved.task.id, "assistant", `Approval granted for \`${resolved.approval.command}\`.`),
      "running",
    );

    const latestTask = store.getTask(resolved.task.id);
    if (latestTask) {
      const execution = await executeTerminal(latestTask, resolved.approval.command, true);

      if (resolved.approval.meta.operationId && resolved.approval.meta.operationStepId) {
        await store.updateOperation(
          resolved.task.id,
          resolved.approval.meta.operationId,
          (operation) => {
            const step = operation.steps.find((candidate) => candidate.id === resolved.approval.meta.operationStepId);
            if (!step) {
              return;
            }

            step.approvalId = resolved.approval.id;
            step.terminalEntryId = execution.terminalEntry.id;
            step.finishedAt = nowIso();

            if (execution.kind === "blocked") {
              step.status = "blocked";
            } else if (execution.kind === "completed") {
              step.status = execution.succeeded ? "succeeded" : "failed";
            }

            settleOperationStatus(operation);
          },
          (operation) => operationStatusToTaskStatus(operation.status),
        );
      }

      if (resolved.approval.meta.agentRunId && resolved.approval.meta.agentToolCallId) {
        await store.updateAgentRun(
          resolved.task.id,
          resolved.approval.meta.agentRunId,
          (agentRun) => {
            const toolCall = agentRun.toolCalls.find((candidate) => candidate.id === resolved.approval.meta.agentToolCallId);
            if (!toolCall) {
              return;
            }

            toolCall.approvalId = resolved.approval.id;
            toolCall.terminalEntryId = execution.terminalEntry.id;
            toolCall.outputPreview = execution.terminalEntry.output;
            toolCall.finishedAt = nowIso();
            toolCall.status =
              execution.kind === "blocked" ? "blocked" : execution.kind === "completed" && execution.succeeded ? "completed" : "failed";
            agentRun.pendingApprovalId = null;
            agentRun.status = "running";
            agentRun.finishedAt = null;
          },
          "running",
        );

        const refreshedRun = store.getAgentRun(resolved.task.id, resolved.approval.meta.agentRunId);
        if (refreshedRun?.autoResume) {
          await continueAgentRun(
            resolved.task.id,
            resolved.approval.meta.agentRunId,
            `approval granted for ${resolved.approval.command}`,
          );
        }
      }
    }

    return resolved;
  }

  async function rejectResolvedApproval(approvalId: string) {
    const resolved = await store.resolveApproval(approvalId, "rejected");
    if (!resolved) {
      return null;
    }

    await store.addMessage(
      resolved.task.id,
      createMessage(resolved.task.id, "assistant", `Approval rejected. I did not run \`${resolved.approval.command}\`.`),
      "idle",
    );

    if (resolved.approval.meta.operationId && resolved.approval.meta.operationStepId) {
      await store.updateOperation(
        resolved.task.id,
        resolved.approval.meta.operationId,
        (operation) => {
          const step = operation.steps.find((candidate) => candidate.id === resolved.approval.meta.operationStepId);
          if (!step) {
            return;
          }

          step.approvalId = resolved.approval.id;
          step.finishedAt = nowIso();
          step.status = "failed";
          settleOperationStatus(operation);
        },
        (operation) => operationStatusToTaskStatus(operation.status),
      );
    }

    if (resolved.approval.meta.agentRunId && resolved.approval.meta.agentToolCallId) {
      await store.updateAgentRun(
        resolved.task.id,
        resolved.approval.meta.agentRunId,
        (agentRun) => {
          const toolCall = agentRun.toolCalls.find((candidate) => candidate.id === resolved.approval.meta.agentToolCallId);
          if (!toolCall) {
            return;
          }

          toolCall.approvalId = resolved.approval.id;
          toolCall.outputPreview = "The operator rejected the guarded command before execution.";
          toolCall.finishedAt = nowIso();
          toolCall.status = "failed";
          agentRun.pendingApprovalId = null;
          agentRun.status = "running";
          agentRun.finishedAt = null;
        },
        "running",
      );

      const refreshedRun = store.getAgentRun(resolved.task.id, resolved.approval.meta.agentRunId);
      if (refreshedRun?.autoResume) {
        await continueAgentRun(
          resolved.task.id,
          resolved.approval.meta.agentRunId,
          `approval rejected for ${resolved.approval.command}`,
        );
      }
    }

    return resolved;
  }

  async function executeTerminal(
    task: TaskDetail,
    command: string,
    allowGuardBypass = false,
    binding?: ExecutionBinding,
  ): Promise<TerminalExecutionResult> {
    const bindingMeta = {
      agentRunId: binding?.agentRunId ?? null,
      agentToolCallId: binding?.agentToolCallId ?? null,
      agentToolKind: binding?.agentToolKind ?? null,
    } satisfies TaskMessage["meta"];
    const assessment = assessCommand(command);

    if (assessment.kind === "blocked") {
      const terminalEntry = createTerminalEntry(task.id, command, `Blocked: ${assessment.reason}`, 1, "blocked");
      await store.addTerminalEntry(
        task.id,
        terminalEntry,
        "failed",
      );
      await store.addMessage(
        task.id,
        createMessage(task.id, "assistant", `I blocked that command: ${assessment.reason}.`, bindingMeta),
        "failed",
      );
      return {
        kind: "blocked",
        terminalEntry,
      };
    }

    if (!allowGuardBypass && assessment.kind === "guarded") {
      if (task.guardMode === "strict") {
        const terminalEntry = createTerminalEntry(
          task.id,
          command,
          `Guard strict blocked the command: ${assessment.reason}`,
          1,
          "blocked",
        );
        await store.addTerminalEntry(
          task.id,
          terminalEntry,
          "failed",
        );
        await store.addMessage(
          task.id,
          createMessage(task.id, "assistant", `Guard strict blocked that command: ${assessment.reason}.`, bindingMeta),
          "failed",
        );
        return {
          kind: "blocked",
          terminalEntry,
        };
      }

      if (task.guardMode === "balanced") {
        const approval = createApproval(task.id, command, assessment.reason, binding);
        const terminalEntry = createTerminalEntry(task.id, command, "Awaiting approval.", 0, "pending_approval");
        await store.addApproval(task.id, approval);
        await store.addTerminalEntry(
          task.id,
          terminalEntry,
          "awaiting_approval",
        );
        await store.addMessage(
          task.id,
          createMessage(
            task.id,
            "assistant",
            `Approval required before I run \`${command}\`. Impact: ${assessment.reason}.`,
            { ...bindingMeta, terminalCommand: command, pendingApprovalId: approval.id },
          ),
          "awaiting_approval",
        );
        return {
          kind: "awaiting_approval",
          terminalEntry,
          approval,
        };
      }
    }

    await store.addMessage(task.id, createMessage(task.id, "tool", `Running terminal command: ${command}`, bindingMeta), "running");
    const result = await runCommand(command);
    const terminalEntry = createTerminalEntry(
      task.id,
      command,
      result.output,
      result.exitCode,
      result.exitCode === 0 ? "completed" : "failed",
    );
    await store.addTerminalEntry(
      task.id,
      terminalEntry,
      result.exitCode === 0 ? "succeeded" : "failed",
    );
    await store.addMessage(
      task.id,
      createMessage(
        task.id,
        "assistant",
        result.exitCode === 0
          ? `Command finished.\n\n${result.output}`
          : `Command failed with exit code ${result.exitCode}.\n\n${result.output}`,
        bindingMeta,
      ),
      result.exitCode === 0 ? "succeeded" : "failed",
    );
    return {
      kind: "completed",
      terminalEntry,
      succeeded: result.exitCode === 0,
    };
  }

  async function createOperation(task: TaskDetail, body: CreateOperationRequest) {
    const activeOperation = getActiveOperation(task);
    if (activeOperation) {
      throw new Error(`Task already has an active operation: ${activeOperation.title}.`);
    }

    const operation = createOperationRun(body);
    await store.addOperation(task.id, operation, "idle");
    await store.addMessage(
      task.id,
      createMessage(
        task.id,
        "assistant",
        `Operation "${operation.title}" created with ${operation.steps.length} steps. Open Pro and continue step by step.`,
      ),
      "idle",
    );
    return buildSnapshot(task.id);
  }

  async function advanceOperation(taskId: string, operationId: string) {
    const task = store.getTask(taskId);
    if (!task) {
      throw new Error("Task not found");
    }

    const operation = store.getOperation(taskId, operationId);
    if (!operation) {
      throw new Error("Operation not found");
    }

    if (operation.status === "awaiting_approval") {
      throw new Error("Operation is waiting for an approval before it can continue.");
    }

    const nextStep = getNextPendingStep(operation);
    if (!nextStep) {
      await store.updateOperation(
        taskId,
        operationId,
        (updatedOperation) => {
          settleOperationStatus(updatedOperation);
        },
        (updatedOperation) => operationStatusToTaskStatus(updatedOperation.status),
      );
      return buildSnapshot(taskId);
    }

    const startedAt = nowIso();
    await store.updateOperation(
      taskId,
      operationId,
      (updatedOperation) => {
        const step = updatedOperation.steps.find((candidate) => candidate.id === nextStep.id);
        if (!step) {
          return;
        }
        step.status = "running";
        step.startedAt ??= startedAt;
        updatedOperation.status = "running";
        updatedOperation.activeStepId = step.id;
      },
      "running",
    );

    const liveTask = store.getTask(taskId);
    const liveOperation = store.getOperation(taskId, operationId);
    const liveStep = liveOperation?.steps.find((candidate) => candidate.id === nextStep.id);

    if (!liveTask || !liveOperation || !liveStep) {
      throw new Error("Operation state was lost while advancing.");
    }

    if (liveStep.kind === "note") {
      await store.addMessage(
        taskId,
        createMessage(
          taskId,
          "assistant",
          liveStep.detail
            ? `Operation step: ${liveStep.title}\n\n${liveStep.detail}`
            : `Operation step: ${liveStep.title}`,
        ),
        "running",
      );

      await store.updateOperation(
        taskId,
        operationId,
        (updatedOperation) => {
          const step = updatedOperation.steps.find((candidate) => candidate.id === liveStep.id);
          if (!step) {
            return;
          }
          step.status = "succeeded";
          step.finishedAt = nowIso();
          settleOperationStatus(updatedOperation);
        },
        (updatedOperation) => operationStatusToTaskStatus(updatedOperation.status),
      );

      return buildSnapshot(taskId);
    }

    const execution = await executeTerminal(liveTask, liveStep.command ?? "", false, {
      operationId,
      stepId: liveStep.id,
    });

    await store.updateOperation(
      taskId,
      operationId,
      (updatedOperation) => {
        const step = updatedOperation.steps.find((candidate) => candidate.id === liveStep.id);
        if (!step) {
          return;
        }

        step.terminalEntryId = execution.terminalEntry.id;

        if (execution.kind === "awaiting_approval") {
          step.status = "awaiting_approval";
          step.approvalId = execution.approval.id;
          updatedOperation.status = "awaiting_approval";
          updatedOperation.activeStepId = step.id;
          return;
        }

        step.finishedAt = nowIso();

        if (execution.kind === "blocked") {
          step.status = "blocked";
        } else {
          step.status = execution.succeeded ? "succeeded" : "failed";
        }

        settleOperationStatus(updatedOperation);
      },
      (updatedOperation) => operationStatusToTaskStatus(updatedOperation.status),
    );

    return buildSnapshot(taskId);
  }

  async function respondToMessage(task: TaskDetail, body: SendMessageRequest) {
    await store.addMessage(task.id, createMessage(task.id, "user", body.content), "running");

    const raw = body.content.trim();
    const terminalShortcut = raw.match(/^\/terminal\s+(.+)$/i) ?? raw.match(/^\$\s+(.+)$/);
    const guardShortcut = raw.match(/^guard\s+(strict|balanced|off)$/i);

    if (/^new task$/i.test(raw)) {
      const nextTask = await store.createTask();
      await store.addMessage(
        nextTask.id,
        createMessage(nextTask.id, "assistant", "New task created. Start with a goal, file request, or terminal command."),
      );
      return buildSnapshot(nextTask.id);
    }

    if (/^list voices$/i.test(raw)) {
      await store.addMessage(
        task.id,
        createMessage(task.id, "assistant", "Voice control is not installed in this build. Chat, terminal, approvals, and agent runs remain available."),
        "idle",
      );
      return buildSnapshot(task.id);
    }

    if (/^(enable|disable) voice$/i.test(raw)) {
      await store.addMessage(
        task.id,
        createMessage(task.id, "assistant", "Voice control is not available in this build, so there is no voice toggle to change."),
        "idle",
      );
      return buildSnapshot(task.id);
    }

    if (guardShortcut) {
      const nextMode = guardShortcut[1]?.toLowerCase() as TaskDetail["guardMode"] | undefined;
      if (!nextMode) {
        return buildSnapshot(task.id);
      }

      await store.setGuardMode(task.id, nextMode);
      await store.addMessage(
        task.id,
        createMessage(task.id, "assistant", `Guard mode set to ${nextMode}.`),
        "idle",
      );
      return buildSnapshot(task.id);
    }

    if (terminalShortcut) {
      const command = terminalShortcut[1];
      if (!command) {
        return buildSnapshot(task.id);
      }
      await executeTerminal(task, command);
      return buildSnapshot(task.id);
    }

    const latestPendingApproval = getLatestPendingApproval(task);
    if (latestPendingApproval) {
      if (isApprovalAffirmation(raw)) {
        await store.addMessage(
          task.id,
          createMessage(
            task.id,
            "assistant",
            `Approval shortcut received in chat. Proceeding with \`${latestPendingApproval.command}\`.`,
          ),
          "running",
        );
        await approveResolvedApproval(latestPendingApproval.id);
        return buildSnapshot(task.id);
      }

      if (isApprovalRejection(raw)) {
        await store.addMessage(
          task.id,
          createMessage(
            task.id,
            "assistant",
            `Approval shortcut received in chat. I will not run \`${latestPendingApproval.command}\`.`,
          ),
          "idle",
        );
        await rejectResolvedApproval(latestPendingApproval.id);
        return buildSnapshot(task.id);
      }

      await store.addMessage(
        task.id,
        createMessage(
          task.id,
          "assistant",
          `A guarded command is still waiting for approval: \`${latestPendingApproval.command}\`. Use Approve/Reject in the task or reply with a short confirmation like \`yes\` or \`no\`.`,
          { pendingApprovalId: latestPendingApproval.id, terminalCommand: latestPendingApproval.command },
        ),
        "awaiting_approval",
      );
      return buildSnapshot(task.id);
    }

    const activeAgentRun = getActiveAgentRun(store.getTask(task.id) ?? task);
    if (/^continue(?:\s+agent)?$/i.test(raw) && activeAgentRun && activeAgentRun.status !== "awaiting_approval") {
      try {
        await continueAgentRun(task.id, activeAgentRun.id, "operator requested another agent pass");
      } catch (error) {
        await store.addMessage(
          task.id,
          createMessage(
            task.id,
            "assistant",
            error instanceof Error ? error.message : "Unable to continue the agent run.",
            { agentRunId: activeAgentRun.id },
          ),
          "failed",
        );
      }
      return buildSnapshot(task.id);
    }

    const computerAction = await computerOperator.handle(raw);
    if (computerAction.kind !== "not_handled") {
      const meta = {
        computerSkill: computerAction.skill,
        computerIntent: computerAction.intent,
      };
      await store.addMessage(task.id, createMessage(task.id, "tool", computerAction.toolMessage, meta), "running");

      if (computerAction.kind === "answer") {
        await store.addMessage(
          task.id,
          createMessage(task.id, "assistant", computerAction.assistantMessage, meta),
          computerAction.status === "failed" ? "failed" : "succeeded",
        );
        return buildSnapshot(task.id);
      }

      await store.addMessage(task.id, createMessage(task.id, "assistant", computerAction.assistantMessage, meta), "running");
      await executeTerminal(task, computerAction.command);
      return buildSnapshot(task.id);
    }

    const safetyDecision = assessAgentObjective(raw);
    if (safetyDecision.kind === "blocked") {
      const blockedMessage = buildBlockedObjectiveMessage(safetyDecision);
      const blockedRun = buildAgentRun(task, raw, null, null);
      blockedRun.status = "blocked";
      blockedRun.summary = safetyDecision.reason;
      blockedRun.lastAssistantMessage = blockedMessage;
      blockedRun.finishedAt = nowIso();
      await store.addAgentRun(task.id, blockedRun, "failed");
      await store.addMessage(
        task.id,
        createMessage(task.id, "assistant", blockedMessage, { agentRunId: blockedRun.id }),
        "failed",
      );
      return buildSnapshot(task.id);
    }

    let providerResolution:
      | Awaited<ReturnType<typeof resolveActiveChatProvider>>
      | null = null;
    try {
      providerResolution = await resolveActiveChatProvider();
    } catch (error) {
      await store.addMessage(
        task.id,
        createMessage(task.id, "assistant", error instanceof Error ? error.message : "Provider configuration failed."),
        "failed",
      );
      return buildSnapshot(task.id);
    }

    const agentRun = buildAgentRun(task, raw, providerResolution.activeProvider.provider, providerResolution.activeProvider.model);
    await store.addAgentRun(task.id, agentRun, "running");
    await runtimeLog.log(
      `Agent run started. task=${task.id} run=${agentRun.id} provider=${providerResolution.activeProvider.provider} model=${providerResolution.activeProvider.model ?? "unknown"}`,
    );

    try {
      await continueAgentRun(task.id, agentRun.id, "initial operator request");
    } catch (error) {
      await store.updateAgentRun(
        task.id,
        agentRun.id,
        (run) => {
          run.status = "failed";
          run.summary = error instanceof Error ? error.message : "Agent execution failed.";
          run.finishedAt = nowIso();
        },
        "failed",
      );
      await store.addMessage(
        task.id,
        createMessage(task.id, "assistant", error instanceof Error ? error.message : "Agent execution failed.", {
          agentRunId: agentRun.id,
        }),
        "failed",
      );
    }

    return buildSnapshot(task.id);
  }

  const server = Fastify({
    logger: false,
  });

  server.get("/api/health", async () => health());

  server.get("/api/workspace", async (request) => {
    const taskId =
      typeof request.query === "object" &&
      request.query !== null &&
      "taskId" in request.query &&
      typeof request.query.taskId === "string"
        ? request.query.taskId
        : undefined;

    return buildSnapshot(taskId);
  });

  server.get("/api/gonka/balance", async (request, reply) => {
    try {
      const query = gonkaWalletBalanceQuerySchema.parse(request.query ?? {}) as GonkaWalletBalanceQuery;
      const balance = await gonka.getBalance(query.address);
      return {
        ok: true as const,
        address: query.address,
        balance,
      };
    } catch (error) {
      reply.code(400);
      return {
        message: error instanceof Error ? error.message : "Unable to read Gonka balance",
      };
    }
  });

  server.post("/api/onboarding/validate", async (request, reply) => {
    const body = onboardingValidateRequestSchema.parse(request.body) as OnboardingValidateRequest;
    const currentProvider = store.getProvider();

    if (body.provider === "gonka") {
      await runtimeLog.log("Rejected GONKA onboarding because the provider path is intentionally paused.");
      reply.code(400);
      return {
        ok: false,
        provider: "gonka" as const,
        selectionMode: "auto" as const,
        model: currentProvider.provider === "gonka" ? currentProvider.model : DEFAULT_GONKA_MODEL,
        availableModels:
          currentProvider.provider === "gonka" && currentProvider.availableModels.length
            ? currentProvider.availableModels
            : [DEFAULT_GONKA_MODEL],
        message: GONKA_PROVIDER_PAUSED_MESSAGE,
      };
    }

    try {
      const secret = await resolveSubmittedOrStoredSecret(body.provider, body.secret);
      const selection =
        body.provider === "local"
          ? await resolveApiSelection(body.provider, secret, currentProvider, {
              validateConnection: true,
              preserveManualSelection: false,
            }, body.localRuntime, body.apiBaseUrl)
          : await resolveApiSelection(body.provider, secret, currentProvider, {
              validateConnection: true,
              preserveManualSelection: false,
            });
      const provider = selection.provider;
      await persistProviderSecret(body.provider, secret);
      await runtimeLog.log(
        `${labelForProvider(provider.provider, provider, provider.provider === "local" ? provider.localRuntime : undefined)} onboarding completed successfully. Default model=${provider.model}. Live model count=${provider.availableModels.length}.`,
      );

      return {
        ok: true,
        provider: body.provider,
        selectionMode: provider.selectionMode,
        model: provider.model,
        availableModels: provider.availableModels,
        message:
          provider.provider === "local"
            ? `${labelForProvider(body.provider, provider, provider.localRuntime)} connected. ${provider.model} is ready from the live local model list.`
            : `${labelForProvider(body.provider, provider)} connected. ${provider.model} is ready and the live model list has been loaded.`,
      };
    } catch (error) {
      await runtimeLog.log(
        `${labelForProvider(body.provider, currentProvider, body.provider === "local" ? body.localRuntime : undefined)} onboarding failed. ${error instanceof Error ? error.message : String(error)}`,
      );
      reply.code(400);
      const fallbackProvider =
        currentProvider.provider === body.provider
          ? currentProvider
          : buildDisconnectedProviderSettings(body.provider, currentProvider, {
              localRuntime: body.provider === "local" ? body.localRuntime : undefined,
              apiBaseUrl: body.provider === "local" ? body.apiBaseUrl : undefined,
            });
      return {
        ok: false,
        provider: body.provider,
        selectionMode: fallbackProvider.selectionMode,
        model: fallbackProvider.model,
        availableModels: fallbackProvider.availableModels,
        message: error instanceof Error ? error.message : "Provider validation failed",
      };
    }
  });

  server.post("/api/provider/model", async (request, reply) => {
    const provider = store.getProvider();
    if (provider.provider === "gonka" || !providerReadyForChat(provider)) {
      reply.code(400);
      return {
        message: "A live chat provider must be connected before selecting a model.",
      };
    }

    const body = setProviderModelRequestSchema.parse(request.body) as SetProviderModelRequest;
    if (provider.availableModels.length && !provider.availableModels.includes(body.model)) {
      reply.code(400);
      return {
        message: `Model ${body.model} is not in the current ${labelForProvider(provider.provider, provider, provider.provider === "local" ? provider.localRuntime : undefined)} model list.`,
      };
    }

    const secret = await readConfiguredSecret(provider.provider);
    if (provider.provider !== "local" && !secret) {
      reply.code(400);
      return {
        message: `The saved ${labelForProvider(provider.provider, provider)} API key is unavailable in the current local profile. Please reconnect the provider.`,
      };
    }

    try {
      await validateConfiguredProviderModel(provider, secret, body.model);
      const updatedProvider = buildApiProviderSettings({
        providerId: provider.provider,
        current: provider,
        model: body.model,
        availableModels: provider.availableModels,
        selectionMode: "manual",
        secretConfigured: true,
        validatedAt: provider.validatedAt,
        modelRefreshedAt: nowIso(),
        apiBaseUrl: provider.apiBaseUrl,
        localRuntime: provider.provider === "local" ? provider.localRuntime : undefined,
      });
      await store.setProvider(updatedProvider);
      await runtimeLog.log(
        `${labelForProvider(provider.provider, provider, provider.provider === "local" ? provider.localRuntime : undefined)} model manually pinned to ${body.model}.`,
      );
      return buildSnapshot();
    } catch (error) {
      reply.code(400);
      return {
        message: error instanceof Error ? error.message : "Unable to use the selected provider model.",
      };
    }
  });

  server.post("/api/provider/models/refresh", async (_request, reply) => {
    const provider = store.getProvider();
    if (provider.provider === "gonka" || !providerReadyForChat(provider)) {
      reply.code(400);
      return {
        message: "A live chat provider must be connected before refreshing models.",
      };
    }

    const secret = await readConfiguredSecret(provider.provider);
    if (provider.provider !== "local" && !secret) {
      reply.code(400);
      return {
        message: `The saved ${labelForProvider(provider.provider, provider)} API key is unavailable in the current local profile. Please reconnect the provider.`,
      };
    }

    try {
      await ensureFreshApiSelection(
        provider.provider,
        secret,
        {
          force: true,
          throwOnError: true,
        },
        provider.provider === "local" ? provider.localRuntime : undefined,
        provider.apiBaseUrl,
      );
      await runtimeLog.log(
        `${labelForProvider(provider.provider, provider, provider.provider === "local" ? provider.localRuntime : undefined)} model list refreshed from the live API.`,
      );
      return buildSnapshot();
    } catch (error) {
      reply.code(400);
      return {
        message: error instanceof Error ? error.message : "Unable to refresh provider models right now.",
      };
    }
  });

  server.post("/api/provider/model/auto", async (_request, reply) => {
    const provider = store.getProvider();
    if (provider.provider === "gonka" || !providerReadyForChat(provider)) {
      reply.code(400);
      return {
        message: "A live chat provider must be connected before returning to automatic model selection.",
      };
    }

    const secret = await readConfiguredSecret(provider.provider);
    if (provider.provider !== "local" && !secret) {
      reply.code(400);
      return {
        message: `The saved ${labelForProvider(provider.provider, provider)} API key is unavailable in the current local profile. Please reconnect the provider.`,
      };
    }

    try {
      await ensureFreshApiSelection(
        provider.provider,
        secret,
        {
          force: true,
          throwOnError: true,
          preserveManualSelection: false,
        },
        provider.provider === "local" ? provider.localRuntime : undefined,
        provider.apiBaseUrl,
      );
      await runtimeLog.log(
        `${labelForProvider(provider.provider, provider, provider.provider === "local" ? provider.localRuntime : undefined)} model selection returned to automatic mode.`,
      );
      return buildSnapshot();
    } catch (error) {
      reply.code(400);
      return {
        message: error instanceof Error ? error.message : "Unable to restore automatic provider model selection.",
      };
    }
  });

  server.post("/api/provider/reset", async (_request, reply) => {
    const provider = store.getProvider();
    if (!provider.secretConfigured) {
      reply.code(400);
      return {
        message: "No configured provider is available to disconnect.",
      };
    }

    await disconnectProvider(provider.provider);
    return buildSnapshot();
  });

  server.get("/api/support-bundle", async () => buildSupportBundle());

  server.post("/api/tasks", async (request) => {
    const body = createTaskRequestSchema.parse(request.body ?? {});
    const task = await store.createTask(body.title);
    return buildSnapshot(task.id);
  });

  server.get("/api/tasks/:taskId", async (request, reply) => {
    const params = request.params as { taskId: string };
    const task = await store.selectTask(params.taskId);
    if (!task) {
      reply.code(404);
      return { message: "Task not found" };
    }
    return buildSnapshot(params.taskId);
  });

  server.post("/api/tasks/:taskId/messages", async (request, reply) => {
    const params = request.params as { taskId: string };
    const task = store.getTask(params.taskId);
    if (!task) {
      reply.code(404);
      return { message: "Task not found" };
    }

    const body = sendMessageRequestSchema.parse(request.body) as SendMessageRequest;
    return respondToMessage(task, body);
  });

  server.post("/api/tasks/:taskId/terminal", async (request, reply) => {
    const params = request.params as { taskId: string };
    const task = store.getTask(params.taskId);
    if (!task) {
      reply.code(404);
      return { message: "Task not found" };
    }

    const body = executeTerminalRequestSchema.parse(request.body) as ExecuteTerminalRequest;
    await executeTerminal(task, body.command);
    return buildSnapshot(task.id);
  });

  server.post("/api/tasks/:taskId/guard", async (request, reply) => {
    const params = request.params as { taskId: string };
    const task = store.getTask(params.taskId);
    if (!task) {
      reply.code(404);
      return { message: "Task not found" };
    }

    const body = setGuardModeRequestSchema.parse(request.body);
    await store.setGuardMode(task.id, body.mode);
    await store.addMessage(task.id, createMessage(task.id, "assistant", `Guard mode set to ${body.mode}.`));
    return buildSnapshot(task.id);
  });

  server.post("/api/tasks/:taskId/operations", async (request, reply) => {
    const params = request.params as { taskId: string };
    const task = store.getTask(params.taskId);
    if (!task) {
      reply.code(404);
      return { message: "Task not found" };
    }

    try {
      const body = createOperationRequestSchema.parse(request.body) as CreateOperationRequest;
      return await createOperation(task, body);
    } catch (error) {
      reply.code(400);
      return {
        message: error instanceof Error ? error.message : "Unable to create operation",
      };
    }
  });

  server.post("/api/tasks/:taskId/operations/:operationId/advance", async (request, reply) => {
    const params = request.params as { taskId: string; operationId: string };
    const task = store.getTask(params.taskId);
    if (!task) {
      reply.code(404);
      return { message: "Task not found" };
    }

    try {
      return await advanceOperation(params.taskId, params.operationId);
    } catch (error) {
      reply.code(400);
      return {
        message: error instanceof Error ? error.message : "Unable to advance operation",
      };
    }
  });

  server.post("/api/tasks/:taskId/agent-runs/:agentRunId/continue", async (request, reply) => {
    const params = request.params as { taskId: string; agentRunId: string };
    const task = store.getTask(params.taskId);
    if (!task) {
      reply.code(404);
      return { message: "Task not found" };
    }

    try {
      await continueAgentRun(params.taskId, params.agentRunId, "operator requested another pass from the Pro surface");
      return buildSnapshot(params.taskId);
    } catch (error) {
      reply.code(400);
      return {
        message: error instanceof Error ? error.message : "Unable to continue the agent run",
      };
    }
  });

  server.post("/api/approvals/:approvalId/approve", async (request, reply) => {
    const params = request.params as { approvalId: string };
    const resolved = await approveResolvedApproval(params.approvalId);
    if (!resolved) {
      reply.code(404);
      return { message: "Approval not found" };
    }

    return buildSnapshot(resolved.task.id);
  });

  server.post("/api/approvals/:approvalId/reject", async (request, reply) => {
    const params = request.params as { approvalId: string };
    const resolved = await rejectResolvedApproval(params.approvalId);
    if (!resolved) {
      reply.code(404);
      return { message: "Approval not found" };
    }

    return buildSnapshot(resolved.task.id);
  });

  async function start() {
    await server.listen({
      host: options.host ?? DEFAULT_RUNTIME_HOST,
      port: options.port ?? DEFAULT_RUNTIME_PORT,
    });
    await runtimeLog.log(`Runtime listening on ${options.host ?? DEFAULT_RUNTIME_HOST}:${options.port ?? DEFAULT_RUNTIME_PORT}.`);
    return server;
  }

  async function stop() {
    await runtimeLog.log("Runtime stopping.");
    await server.close();
  }

  return { server, start, stop, health, buildSnapshot };
}
