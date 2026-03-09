import Fastify from "fastify";
import type {
  ApprovalRequest,
  ExecuteTerminalRequest,
  OnboardingValidateRequest,
  ProviderSettings,
  SendMessageRequest,
  TaskDetail,
  TaskMessage,
  TerminalEntry,
} from "@klava/contracts";
import {
  onboardingValidateRequestSchema,
  createTaskRequestSchema,
  executeTerminalRequestSchema,
  sendMessageRequestSchema,
  setGuardModeRequestSchema,
} from "@klava/contracts";
import {
  DEFAULT_MODEL,
  DEFAULT_RUNTIME_HOST,
  DEFAULT_RUNTIME_PORT,
  KLAVA_VERSION,
  MODEL_REFRESH_INTERVAL_MS,
} from "./constants";
import { OpenAiService } from "./openai-service";
import { SecretVault } from "./secrets";
import { RuntimeStore, getAppPaths } from "./storage";
import { assessCommand, runCommand } from "./terminal";

type CreateRuntimeOptions = {
  host?: string;
  port?: number;
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

function createApproval(taskId: string, command: string, impact: string): ApprovalRequest {
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
  };
}

export async function createKlavaRuntime(options: CreateRuntimeOptions = {}) {
  const store = new RuntimeStore(getAppPaths());
  const vault = new SecretVault(getAppPaths());
  const openAi = new OpenAiService();
  await store.init();

  async function health() {
    return {
      ok: true,
      runtimeVersion: KLAVA_VERSION,
      shellVersion: KLAVA_VERSION,
      startedAt: store.startedAtIso,
      uptimeMs: store.uptimeMs,
      storagePath: store.storagePath,
      providerConfigured: store.getProvider().apiKeyConfigured,
    };
  }

  async function refreshProviderSelectionIfNeeded() {
    const provider = store.getProvider();
    if (!provider.apiKeyConfigured) {
      return provider;
    }

    const apiKey = await vault.getSecret("openai_api_key");
    if (!apiKey) {
      return provider;
    }

    const selection = await ensureFreshProviderSelection(apiKey);
    return selection.provider;
  }

  async function buildSnapshot(taskId?: string | null) {
    if (taskId) {
      await store.selectTask(taskId);
    }
    await refreshProviderSelectionIfNeeded();
    return store.getSnapshot(await health());
  }

  async function buildSupportBundle() {
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
        };
      }),
    };
  }

  async function setResolvedProviderModel(current: ProviderSettings, model: string) {
    const provider: ProviderSettings = {
      provider: "openai",
      selectionMode: "auto",
      model,
      apiKeyConfigured: true,
      validatedAt: current.validatedAt,
      modelRefreshedAt: nowIso(),
    };

    await store.setProvider(provider);
    return provider;
  }

  async function resolveProviderSelection(
    apiKey: string,
    current?: ProviderSettings | null,
    validateConnection = false,
  ) {
    const selection = validateConnection ? await openAi.validate(apiKey) : await openAi.resolveBestModel(apiKey);
    const refreshedAt = nowIso();
    const provider: ProviderSettings = {
      provider: "openai",
      selectionMode: "auto",
      model: selection.model,
      apiKeyConfigured: true,
      validatedAt: current?.validatedAt ?? refreshedAt,
      modelRefreshedAt: refreshedAt,
    };

    await store.setProvider(provider);
    return {
      provider,
      candidates: selection.candidates,
    };
  }

  async function ensureFreshProviderSelection(apiKey: string, force = false) {
    const current = store.getProvider();
    const fallbackCandidates = uniqueModels([current.model || DEFAULT_MODEL]);

    if (!current.apiKeyConfigured) {
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
      return await resolveProviderSelection(apiKey, current);
    } catch {
      return {
        provider: current,
        candidates: fallbackCandidates,
      };
    }
  }

  async function executeTerminal(task: TaskDetail, command: string, allowGuardBypass = false) {
    const assessment = assessCommand(command);

    if (assessment.kind === "blocked") {
      await store.addTerminalEntry(
        task.id,
        createTerminalEntry(task.id, command, `Blocked: ${assessment.reason}`, 1, "blocked"),
        "failed",
      );
      await store.addMessage(
        task.id,
        createMessage(task.id, "assistant", `I blocked that command: ${assessment.reason}.`),
        "failed",
      );
      return;
    }

    if (!allowGuardBypass && assessment.kind === "guarded") {
      if (task.guardMode === "strict") {
        await store.addTerminalEntry(
          task.id,
          createTerminalEntry(
            task.id,
            command,
            `Guard strict blocked the command: ${assessment.reason}`,
            1,
            "blocked",
          ),
          "failed",
        );
        await store.addMessage(
          task.id,
          createMessage(task.id, "assistant", `Guard strict blocked that command: ${assessment.reason}.`),
          "failed",
        );
        return;
      }

      if (task.guardMode === "balanced") {
        const approval = createApproval(task.id, command, assessment.reason);
        await store.addApproval(task.id, approval);
        await store.addTerminalEntry(
          task.id,
          createTerminalEntry(task.id, command, "Awaiting approval.", 0, "pending_approval"),
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
        return;
      }
    }

    await store.addMessage(task.id, createMessage(task.id, "tool", `Running terminal command: ${command}`), "running");
    const result = await runCommand(command);
    await store.addTerminalEntry(
      task.id,
      createTerminalEntry(
        task.id,
        command,
        result.output,
        result.exitCode,
        result.exitCode === 0 ? "completed" : "failed",
      ),
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
    if (!provider.apiKeyConfigured) {
      await store.addMessage(
        task.id,
        createMessage(
          task.id,
          "assistant",
          "OpenAI is not configured yet. Use the onboarding panel to add an API key before normal chat responses.",
        ),
        "failed",
      );
      return buildSnapshot(task.id);
    }

    const apiKey = await vault.getSecret("openai_api_key");
    if (!apiKey) {
      await store.addMessage(
        task.id,
        createMessage(task.id, "assistant", "The saved API key is unavailable. Please reconnect OpenAI."),
        "failed",
      );
      return buildSnapshot(task.id);
    }

    let providerSelection = await ensureFreshProviderSelection(apiKey);
    let activeProvider = providerSelection.provider;

    const updatedTask = store.getTask(task.id);
    if (!updatedTask) {
      return buildSnapshot();
    }

    const attemptedModel = activeProvider.model || DEFAULT_MODEL;

    try {
      const completion = await openAi.complete({
        apiKey,
        model: attemptedModel,
        messages: updatedTask.messages,
      });
      await store.addMessage(task.id, createMessage(task.id, "assistant", completion), "succeeded");
    } catch (error) {
      let finalError = error;

      if (openAi.shouldRetryModelSelection(error)) {
        const forcedSelection = await ensureFreshProviderSelection(apiKey, true);
        activeProvider = forcedSelection.provider;
        providerSelection = forcedSelection;

        const retryModels = uniqueModels([
          ...providerSelection.candidates,
          activeProvider.model || DEFAULT_MODEL,
          provider.model || DEFAULT_MODEL,
        ]).filter((candidate) => candidate !== attemptedModel);

        for (const candidate of retryModels) {
          try {
            const completion = await openAi.complete({
              apiKey,
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
            if (!openAi.shouldRetryModelSelection(retryError)) {
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

  server.post("/api/onboarding/validate", async (request, reply) => {
    const body = onboardingValidateRequestSchema.parse(request.body) as OnboardingValidateRequest;

    try {
      const selection = await openAi.validate(body.apiKey);
      await vault.setSecret("openai_api_key", body.apiKey);

      const validatedAt = nowIso();
      const provider: ProviderSettings = {
        provider: "openai",
        selectionMode: "auto",
        model: selection.model,
        apiKeyConfigured: true,
        validatedAt,
        modelRefreshedAt: validatedAt,
      };

      await store.setProvider(provider);

      return {
        ok: true,
        provider: "openai" as const,
        selectionMode: "auto" as const,
        model: provider.model,
        message: `OpenAI connected. Auto-selected ${provider.model}.`,
      };
    } catch (error) {
      reply.code(400);
      return {
        ok: false,
        provider: "openai" as const,
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
      await executeTerminal(latestTask, resolved.approval.command, true);
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
