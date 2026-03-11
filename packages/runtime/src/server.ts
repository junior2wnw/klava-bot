import Fastify from "fastify";
import type {
  ApprovalRequest,
  CreateOperationRequest,
  ExecuteTerminalRequest,
  GonkaWalletBalanceQuery,
  OnboardingValidateRequest,
  OperationRun,
  OperationStatus,
  OperationStep,
  ProviderSettings,
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
  setGuardModeRequestSchema,
} from "@klava/contracts";
import {
  DEFAULT_MODEL,
  DEFAULT_RUNTIME_HOST,
  DEFAULT_RUNTIME_PORT,
  GONKA_BALANCE_REFRESH_INTERVAL_MS,
  KLAVA_VERSION,
  MODEL_REFRESH_INTERVAL_MS,
} from "./constants";
import { GonkaService } from "./gonka-service";
import { SecretVault } from "./secrets";
import { RuntimeStore, getAppPaths, type AppPaths } from "./storage";
import { assessCommand, runCommand } from "./terminal";

type CreateRuntimeOptions = {
  host?: string;
  port?: number;
  paths?: AppPaths;
};

type OperationBinding = {
  operationId: string;
  stepId: string;
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

function createApproval(taskId: string, command: string, impact: string, binding?: OperationBinding): ApprovalRequest {
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

export async function createKlavaRuntime(options: CreateRuntimeOptions = {}) {
  const appPaths = options.paths ?? getAppPaths();
  const store = new RuntimeStore(appPaths);
  const vault = new SecretVault(appPaths);
  const gonka = new GonkaService();
  await store.init();

  async function clearProviderConfiguration() {
    const current = store.getProvider();
    const provider: ProviderSettings = {
      provider: "gonka",
      selectionMode: "auto",
      model: current.model || DEFAULT_MODEL,
      secretConfigured: false,
      requesterAddress: null,
      balance: null,
      validatedAt: null,
      modelRefreshedAt: null,
    };

    await store.setProvider(provider);
    return provider;
  }

  async function readConfiguredSecret() {
    try {
      const secret = await vault.getSecret("gonka_secret");
      if (!secret?.trim()) {
        await clearProviderConfiguration();
        return null;
      }

      return secret.trim();
    } catch {
      await clearProviderConfiguration();
      return null;
    }
  }

  async function health() {
    return {
      ok: true,
      runtimeVersion: KLAVA_VERSION,
      shellVersion: KLAVA_VERSION,
      startedAt: store.startedAtIso,
      uptimeMs: store.uptimeMs,
      storagePath: store.storagePath,
      providerConfigured: store.getProvider().secretConfigured,
    };
  }

  async function refreshProviderSelectionIfNeeded() {
    const provider = store.getProvider();
    if (!provider.secretConfigured) {
      return provider;
    }

    const secret = await readConfiguredSecret();
    if (!secret) {
      return store.getProvider();
    }

    const selection = await ensureFreshProviderSelection(secret);
    return selection.provider;
  }

  async function refreshProviderBalanceIfNeeded(force = false) {
    const provider = store.getProvider();
    if (!provider.requesterAddress) {
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
    return store.getSnapshot(await health());
  }

  async function buildSupportBundle() {
    await refreshProviderBalanceIfNeeded();
    const runtimeHealth = await health();
    return {
      generatedAt: nowIso(),
      health: runtimeHealth,
      provider: store.getProvider(),
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
        };
      }),
    };
  }

  async function setResolvedProviderModel(current: ProviderSettings, model: string) {
    const provider: ProviderSettings = {
      provider: "gonka",
      selectionMode: "auto",
      model,
      secretConfigured: true,
      requesterAddress: current.requesterAddress,
      balance: current.balance,
      validatedAt: current.validatedAt,
      modelRefreshedAt: nowIso(),
    };

    await store.setProvider(provider);
    return provider;
  }

  async function resolveProviderSelection(
    secret: string,
    current?: ProviderSettings | null,
    validateConnection = false,
  ) {
    const selection = validateConnection ? await gonka.validate(secret) : await gonka.resolveBestModel();
    const refreshedAt = nowIso();
    const requesterAddress =
      validateConnection && "requesterAddress" in selection && typeof selection.requesterAddress === "string"
        ? selection.requesterAddress
        : current?.requesterAddress ?? null;
    const provider: ProviderSettings = {
      provider: "gonka",
      selectionMode: "auto",
      model: selection.model,
      secretConfigured: true,
      requesterAddress,
      balance: current?.balance ?? null,
      validatedAt: current?.validatedAt ?? refreshedAt,
      modelRefreshedAt: refreshedAt,
    };

    await store.setProvider(provider);
    return {
      provider,
      candidates: selection.candidates,
    };
  }

  async function ensureFreshProviderSelection(secret: string, force = false) {
    const current = store.getProvider();
    const fallbackCandidates = uniqueModels([current.model || DEFAULT_MODEL]);

    if (!current.secretConfigured) {
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
      return await resolveProviderSelection(secret, current);
    } catch {
      return {
        provider: current,
        candidates: fallbackCandidates,
      };
    }
  }

  async function executeTerminal(
    task: TaskDetail,
    command: string,
    allowGuardBypass = false,
    binding?: OperationBinding,
  ): Promise<TerminalExecutionResult> {
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
        createMessage(task.id, "assistant", `I blocked that command: ${assessment.reason}.`),
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
          createMessage(task.id, "assistant", `Guard strict blocked that command: ${assessment.reason}.`),
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
            { terminalCommand: command, pendingApprovalId: approval.id },
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

    await store.addMessage(task.id, createMessage(task.id, "tool", `Running terminal command: ${command}`), "running");
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
        createMessage(task.id, "assistant", "Voice module is optional and not installed in this MVP build yet."),
        "idle",
      );
      return buildSnapshot(task.id);
    }

    if (/^(enable|disable) voice$/i.test(raw)) {
      await store.addMessage(
        task.id,
        createMessage(task.id, "assistant", "Voice toggles are stubbed for now. Core chat and terminal flows remain available."),
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

    const provider = store.getProvider();
    if (!provider.secretConfigured) {
      await store.addMessage(
        task.id,
        createMessage(
          task.id,
          "assistant",
          "GONKA is not configured yet. Use the onboarding panel to add your private phrase or private key before normal chat responses.",
        ),
        "failed",
      );
      return buildSnapshot(task.id);
    }

    const secret = await readConfiguredSecret();
    if (!secret) {
      await store.addMessage(
        task.id,
        createMessage(
          task.id,
          "assistant",
          "The saved Gonka secret is unavailable in the current local profile. Please reconnect GONKA.",
        ),
        "failed",
      );
      return buildSnapshot(task.id);
    }

    let providerSelection = await ensureFreshProviderSelection(secret);
    let activeProvider = providerSelection.provider;

    const updatedTask = store.getTask(task.id);
    if (!updatedTask) {
      return buildSnapshot();
    }

    const attemptedModel = activeProvider.model || DEFAULT_MODEL;

    try {
      const completion = await gonka.complete({
        secret,
        model: attemptedModel,
        messages: updatedTask.messages,
      });
      await store.addMessage(task.id, createMessage(task.id, "assistant", completion), "succeeded");
    } catch (error) {
      let finalError = error;

      if (gonka.shouldRetryModelSelection(error)) {
        const forcedSelection = await ensureFreshProviderSelection(secret, true);
        activeProvider = forcedSelection.provider;
        providerSelection = forcedSelection;

        const retryModels = uniqueModels([
          ...providerSelection.candidates,
          activeProvider.model || DEFAULT_MODEL,
          provider.model || DEFAULT_MODEL,
        ]).filter((candidate) => candidate !== attemptedModel);

        for (const candidate of retryModels) {
          try {
            const completion = await gonka.complete({
              secret,
              model: candidate,
              messages: updatedTask.messages,
            });

            if (candidate !== activeProvider.model) {
              activeProvider = await setResolvedProviderModel(activeProvider, candidate);
            }

            await store.addMessage(task.id, createMessage(task.id, "assistant", completion), "succeeded");
            return buildSnapshot(task.id);
          } catch (retryError) {
            finalError = retryError;
            if (!gonka.shouldRetryModelSelection(retryError)) {
              break;
            }
          }
        }
      }

      const message = finalError instanceof Error ? finalError.message : "Unknown provider error";
      await store.addMessage(
        task.id,
        createMessage(task.id, "assistant", `Provider request failed: ${message}`),
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

    try {
      const selection = await gonka.validate(body.secret, {
        expectedAddress: body.walletAddress ?? null,
        mnemonicPassphrase: body.mnemonicPassphrase ?? null,
      });
      await vault.setSecret("gonka_secret", selection.resolvedSecret);

      const validatedAt = nowIso();
      const balance = await gonka.getBalance(selection.requesterAddress).catch(() => null);
      const provider: ProviderSettings = {
        provider: "gonka",
        selectionMode: "auto",
        model: selection.model,
        secretConfigured: true,
        requesterAddress: selection.requesterAddress,
        balance,
        validatedAt,
        modelRefreshedAt: validatedAt,
      };

      await store.setProvider(provider);

      return {
        ok: true,
        provider: "gonka" as const,
        selectionMode: "auto" as const,
        model: provider.model,
        message: `GONKA connected. Live mainnet validation passed and auto-selected ${provider.model}.`,
      };
    } catch (error) {
      reply.code(400);
      return {
        ok: false,
        provider: "gonka" as const,
        selectionMode: "auto" as const,
        model: store.getProvider().model || DEFAULT_MODEL,
        message: error instanceof Error ? error.message : "Provider validation failed",
      };
    }
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

  server.post("/api/approvals/:approvalId/approve", async (request, reply) => {
    const params = request.params as { approvalId: string };
    const resolved = await store.resolveApproval(params.approvalId, "approved");
    if (!resolved) {
      reply.code(404);
      return { message: "Approval not found" };
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
    }

    return buildSnapshot(resolved.task.id);
  });

  server.post("/api/approvals/:approvalId/reject", async (request, reply) => {
    const params = request.params as { approvalId: string };
    const resolved = await store.resolveApproval(params.approvalId, "rejected");
    if (!resolved) {
      reply.code(404);
      return { message: "Approval not found" };
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

    return buildSnapshot(resolved.task.id);
  });

  async function start() {
    await server.listen({
      host: options.host ?? DEFAULT_RUNTIME_HOST,
      port: options.port ?? DEFAULT_RUNTIME_PORT,
    });
    return server;
  }

  async function stop() {
    await server.close();
  }

  return { server, start, stop, health, buildSnapshot };
}
