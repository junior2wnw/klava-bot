import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type {
  AgentRun,
  ApprovalRequest,
  GuardMode,
  LocalRuntime,
  LocalRuntimeAdvice,
  MachineProfile,
  OperationRun,
  ProviderBalance,
  ProviderSettings,
  TaskDetail,
  TaskMessage,
  TaskStatus,
  TaskSummary,
  TerminalEntry,
  WorkspaceSnapshot,
} from "@klava/contracts";
import { defaultApiBaseUrlForProvider, defaultModelForProvider } from "./provider-catalog";

type RuntimeState = {
  provider: ProviderSettings;
  selectedTaskId: string | null;
  tasks: TaskDetail[];
};

type TaskLanguage = "en" | "ru";

export type AppPaths = {
  rootDir: string;
  statePath: string;
  secretsPath: string;
  keyPath: string;
};

export type AppPathOptions = {
  platform?: NodeJS.Platform | string;
  homeDir?: string;
  appDataDir?: string;
  xdgDataHome?: string;
};

export function resolveAppRootDir(options: AppPathOptions = {}) {
  const platform = options.platform ?? process.platform;
  const homeDir = options.homeDir ?? os.homedir();

  if (platform === "win32") {
    return path.join(options.appDataDir ?? process.env.APPDATA ?? path.join(homeDir, "AppData", "Roaming"), "Klava Bot");
  }

  if (platform === "darwin") {
    return path.join(homeDir, "Library", "Application Support", "Klava Bot");
  }

  return path.join(options.xdgDataHome ?? process.env.XDG_DATA_HOME ?? path.join(homeDir, ".local", "share"), "Klava Bot");
}

export function getAppPaths(options: AppPathOptions = {}): AppPaths {
  const rootDir = resolveAppRootDir(options);

  return {
    rootDir,
    statePath: path.join(rootDir, "state.json"),
    secretsPath: path.join(rootDir, "secrets.json"),
    keyPath: path.join(rootDir, "vault.key"),
  };
}

function nowIso() {
  return new Date().toISOString();
}

function isPreviewableMessage(message: TaskMessage) {
  const presentation = message.meta.presentation;
  if (presentation === "artifact") {
    return false;
  }

  if (message.role === "tool") {
    return presentation === "status";
  }

  if (message.role === "system") {
    return presentation === "status";
  }

  return true;
}

function uniqueModelIds(models: string[]) {
  return [...new Set(models.map((model) => model.trim()).filter((model) => model.length > 0))];
}

function normalizeAvailableModels(models: unknown, fallbackModel: string) {
  if (!Array.isArray(models)) {
    return [fallbackModel];
  }

  const normalized = uniqueModelIds(models.filter((value): value is string => typeof value === "string"));
  return normalized.length ? normalized : [fallbackModel];
}

function normalizeProviderBalance(balance?: Partial<ProviderBalance> | null): ProviderBalance | null {
  if (!balance || typeof balance !== "object") {
    return null;
  }

  if (
    typeof balance.denom !== "string" ||
    typeof balance.amount !== "string" ||
    typeof balance.displayAmount !== "string" ||
    typeof balance.displayDenom !== "string" ||
    typeof balance.asOf !== "string" ||
    typeof balance.sourceUrl !== "string"
  ) {
    return null;
  }

  return {
    denom: balance.denom,
    amount: balance.amount,
    displayAmount: balance.displayAmount,
    displayDenom: balance.displayDenom,
    asOf: balance.asOf,
    sourceUrl: balance.sourceUrl,
  };
}

function normalizeProvider(provider?: Partial<ProviderSettings> | null): ProviderSettings {
  const providerRecord = provider as Record<string, unknown> | null | undefined;
  const providerId =
    provider?.provider === "gonka" ||
    provider?.provider === "openai" ||
    provider?.provider === "gemini" ||
    provider?.provider === "groq" ||
    provider?.provider === "openrouter" ||
    provider?.provider === "local"
      ? provider.provider
      : "openai";
  const localRuntime: LocalRuntime =
    providerId === "local" && providerRecord?.localRuntime === "vllm" ? "vllm" : "ollama";
  const fallbackModel = defaultModelForProvider(providerId, localRuntime);
  const validatedAt = typeof provider?.validatedAt === "string" ? provider.validatedAt : null;
  const model =
    typeof provider?.model === "string" && provider.model.trim().length > 0 ? provider.model.trim() : fallbackModel;
  const availableModels = normalizeAvailableModels(provider?.availableModels, model);

  if (providerId === "gonka") {
    return {
      provider: "gonka",
      selectionMode: "auto",
      model,
      availableModels,
      secretConfigured: provider?.secretConfigured ?? false,
      requesterAddress: typeof provider?.requesterAddress === "string" ? provider.requesterAddress : null,
      balance: normalizeProviderBalance(provider?.balance),
      validatedAt,
      modelRefreshedAt: typeof provider?.modelRefreshedAt === "string" ? provider.modelRefreshedAt : validatedAt,
    };
  }

  const apiBaseUrl =
    typeof providerRecord?.apiBaseUrl === "string" && providerRecord.apiBaseUrl.trim().length > 0
      ? providerRecord.apiBaseUrl.trim()
      : defaultApiBaseUrlForProvider(providerId, localRuntime) ?? defaultApiBaseUrlForProvider("openai") ?? "";

  if (providerId === "local") {
    return {
      provider: "local",
      selectionMode: provider?.selectionMode === "manual" ? "manual" : "auto",
      model,
      availableModels,
      secretConfigured: provider?.secretConfigured ?? false,
      requesterAddress: null,
      balance: null,
      apiBaseUrl,
      localRuntime,
      validatedAt,
      modelRefreshedAt: typeof provider?.modelRefreshedAt === "string" ? provider.modelRefreshedAt : validatedAt,
    };
  }

  if (providerId === "gemini") {
    return {
      provider: "gemini",
      selectionMode: provider?.selectionMode === "manual" ? "manual" : "auto",
      model,
      availableModels,
      secretConfigured: provider?.secretConfigured ?? false,
      requesterAddress: null,
      balance: null,
      apiBaseUrl,
      validatedAt,
      modelRefreshedAt: typeof provider?.modelRefreshedAt === "string" ? provider.modelRefreshedAt : validatedAt,
    };
  }

  if (providerId === "groq") {
    return {
      provider: "groq",
      selectionMode: provider?.selectionMode === "manual" ? "manual" : "auto",
      model,
      availableModels,
      secretConfigured: provider?.secretConfigured ?? false,
      requesterAddress: null,
      balance: null,
      apiBaseUrl,
      validatedAt,
      modelRefreshedAt: typeof provider?.modelRefreshedAt === "string" ? provider.modelRefreshedAt : validatedAt,
    };
  }

  if (providerId === "openrouter") {
    return {
      provider: "openrouter",
      selectionMode: provider?.selectionMode === "manual" ? "manual" : "auto",
      model,
      availableModels,
      secretConfigured: provider?.secretConfigured ?? false,
      requesterAddress: null,
      balance: null,
      apiBaseUrl,
      validatedAt,
      modelRefreshedAt: typeof provider?.modelRefreshedAt === "string" ? provider.modelRefreshedAt : validatedAt,
    };
  }

  return {
    provider: "openai",
    selectionMode: provider?.selectionMode === "manual" ? "manual" : "auto",
    model,
    availableModels,
    secretConfigured: provider?.secretConfigured ?? false,
    requesterAddress: null,
    balance: null,
    apiBaseUrl,
    validatedAt,
    modelRefreshedAt: typeof provider?.modelRefreshedAt === "string" ? provider.modelRefreshedAt : validatedAt,
  };
}

function normalizeOperation(operation?: Partial<OperationRun> | null): OperationRun {
  const createdAt = typeof operation?.createdAt === "string" ? operation.createdAt : nowIso();
  const updatedAt = typeof operation?.updatedAt === "string" ? operation.updatedAt : createdAt;

  return {
    id: typeof operation?.id === "string" ? operation.id : crypto.randomUUID(),
    title: typeof operation?.title === "string" && operation.title.trim().length > 0 ? operation.title.trim() : "Operation",
    goal: typeof operation?.goal === "string" && operation.goal.trim().length > 0 ? operation.goal.trim() : "Unspecified goal",
    summary: typeof operation?.summary === "string" ? operation.summary : null,
    status:
      operation?.status === "draft" ||
      operation?.status === "running" ||
      operation?.status === "awaiting_approval" ||
      operation?.status === "succeeded" ||
      operation?.status === "failed"
        ? operation.status
        : "draft",
    createdAt,
    updatedAt,
    activeStepId: typeof operation?.activeStepId === "string" ? operation.activeStepId : null,
    steps: Array.isArray(operation?.steps)
      ? operation.steps.map((step) => ({
          id: typeof step?.id === "string" ? step.id : crypto.randomUUID(),
          title: typeof step?.title === "string" && step.title.trim().length > 0 ? step.title.trim() : "Step",
          detail: typeof step?.detail === "string" ? step.detail : null,
          kind: step?.kind === "note" || step?.kind === "terminal" ? step.kind : step?.command ? "terminal" : "note",
          command: typeof step?.command === "string" ? step.command : null,
          status:
            step?.status === "pending" ||
            step?.status === "running" ||
            step?.status === "awaiting_approval" ||
            step?.status === "succeeded" ||
            step?.status === "failed" ||
            step?.status === "blocked"
              ? step.status
              : "pending",
          startedAt: typeof step?.startedAt === "string" ? step.startedAt : null,
          finishedAt: typeof step?.finishedAt === "string" ? step.finishedAt : null,
          terminalEntryId: typeof step?.terminalEntryId === "string" ? step.terminalEntryId : null,
          approvalId: typeof step?.approvalId === "string" ? step.approvalId : null,
        }))
      : [],
  };
}

function normalizeAgentRun(run?: Partial<AgentRun> | null): AgentRun {
  const createdAt = typeof run?.startedAt === "string" ? run.startedAt : nowIso();
  const updatedAt = typeof run?.updatedAt === "string" ? run.updatedAt : createdAt;

  return {
    id: typeof run?.id === "string" ? run.id : crypto.randomUUID(),
    taskId: typeof run?.taskId === "string" ? run.taskId : "",
    title: typeof run?.title === "string" && run.title.trim().length > 0 ? run.title.trim() : "Agent run",
    goal: typeof run?.goal === "string" && run.goal.trim().length > 0 ? run.goal.trim() : "Unspecified goal",
    status:
      run?.status === "running" ||
      run?.status === "awaiting_approval" ||
      run?.status === "needs_input" ||
      run?.status === "succeeded" ||
      run?.status === "failed" ||
      run?.status === "blocked"
        ? run.status
        : "running",
    provider:
      run?.provider === "gonka" ||
      run?.provider === "openai" ||
      run?.provider === "gemini" ||
      run?.provider === "groq" ||
      run?.provider === "openrouter" ||
      run?.provider === "local"
        ? run.provider
        : null,
    model: typeof run?.model === "string" ? run.model : null,
    autoResume: run?.autoResume ?? true,
    maxIterations: typeof run?.maxIterations === "number" && run.maxIterations > 0 ? Math.trunc(run.maxIterations) : 8,
    iteration: typeof run?.iteration === "number" && run.iteration >= 0 ? Math.trunc(run.iteration) : 0,
    startedAt: createdAt,
    updatedAt,
    finishedAt: typeof run?.finishedAt === "string" ? run.finishedAt : null,
    pendingApprovalId: typeof run?.pendingApprovalId === "string" ? run.pendingApprovalId : null,
    lastAssistantMessage: typeof run?.lastAssistantMessage === "string" ? run.lastAssistantMessage : null,
    summary: typeof run?.summary === "string" ? run.summary : null,
    plan: Array.isArray(run?.plan)
      ? run.plan.map((item) => ({
          id: typeof item?.id === "string" ? item.id : crypto.randomUUID(),
          title: typeof item?.title === "string" && item.title.trim().length > 0 ? item.title.trim() : "Plan item",
          detail: typeof item?.detail === "string" ? item.detail : null,
          status:
            item?.status === "pending" ||
            item?.status === "running" ||
            item?.status === "completed" ||
            item?.status === "failed" ||
            item?.status === "blocked"
              ? item.status
              : "pending",
        }))
      : [],
    toolCalls: Array.isArray(run?.toolCalls)
      ? run.toolCalls.map((toolCall) => ({
          id: typeof toolCall?.id === "string" ? toolCall.id : crypto.randomUUID(),
          kind:
            toolCall?.kind === "computer.inspect" ||
            toolCall?.kind === "shell.command" ||
            toolCall?.kind === "filesystem.read" ||
            toolCall?.kind === "filesystem.search"
              ? toolCall.kind
              : "shell.command",
          status:
            toolCall?.status === "completed" ||
            toolCall?.status === "failed" ||
            toolCall?.status === "awaiting_approval" ||
            toolCall?.status === "blocked"
              ? toolCall.status
              : "failed",
          summary: typeof toolCall?.summary === "string" ? toolCall.summary : "Tool call",
          input: typeof toolCall?.input === "string" ? toolCall.input : null,
          command: typeof toolCall?.command === "string" ? toolCall.command : null,
          outputPreview: typeof toolCall?.outputPreview === "string" ? toolCall.outputPreview : null,
          terminalEntryId: typeof toolCall?.terminalEntryId === "string" ? toolCall.terminalEntryId : null,
          approvalId: typeof toolCall?.approvalId === "string" ? toolCall.approvalId : null,
          startedAt: typeof toolCall?.startedAt === "string" ? toolCall.startedAt : createdAt,
          finishedAt: typeof toolCall?.finishedAt === "string" ? toolCall.finishedAt : null,
        }))
      : [],
  };
}

function normalizeTask(task?: Partial<TaskDetail> | null): TaskDetail {
  const fallback = createTaskTemplate(typeof task?.title === "string" ? task.title : undefined);

  return {
    ...fallback,
    ...task,
    approvals: Array.isArray(task?.approvals)
      ? task.approvals.map((approval) => ({
          ...approval,
          meta: approval?.meta ?? {},
        }))
      : fallback.approvals,
    operations: Array.isArray(task?.operations) ? task.operations.map((operation) => normalizeOperation(operation)) : [],
    agentRuns: Array.isArray(task?.agentRuns) ? task.agentRuns.map((run) => normalizeAgentRun(run)) : [],
  };
}

export function createTaskTemplate(title?: string, language: TaskLanguage = "en"): TaskDetail {
  const timestamp = nowIso();
  const id = crypto.randomUUID();
  const defaultTitle =
    language === "ru"
      ? `Задача ${new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`
      : `Task ${new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;

  const welcomeMessage: TaskMessage = {
    id: crypto.randomUUID(),
    taskId: id,
    role: "system",
    content:
      language === "ru"
        ? "Задача готова. Спросите Клаву о чём угодно, используйте /terminal <команда>, $ <команда> или переключайте режим защиты через guard strict|balanced|off."
        : "Task ready. Ask Klava anything, use /terminal <command>, $ <command>, or change guard mode with guard strict|balanced|off.",
    createdAt: timestamp,
    meta: {
      presentation: "status",
      statusState: "info",
    },
  };

  return {
    id,
    title: title?.trim() || defaultTitle,
    status: "idle",
    guardMode: "balanced",
    createdAt: timestamp,
    updatedAt: timestamp,
    lastMessagePreview: welcomeMessage.content,
    pendingApprovalCount: 0,
    messages: [welcomeMessage],
    terminalEntries: [],
    approvals: [],
    operations: [],
    agentRuns: [],
  };
}

function defaultState(): RuntimeState {
  return {
    provider: normalizeProvider({
      provider: "openai",
      secretConfigured: false,
      apiBaseUrl: defaultApiBaseUrlForProvider("openai") ?? "",
      validatedAt: null,
      modelRefreshedAt: null,
    }),
    selectedTaskId: null,
    tasks: [createTaskTemplate("Getting started")],
  };
}

function toTaskSummary(task: TaskDetail): TaskSummary {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    guardMode: task.guardMode,
    updatedAt: task.updatedAt,
    createdAt: task.createdAt,
    lastMessagePreview: task.lastMessagePreview,
    pendingApprovalCount: task.approvals.filter((approval) => approval.status === "pending").length,
  };
}

export class RuntimeStore {
  private readonly paths: AppPaths;
  private state: RuntimeState = defaultState();
  private readonly startedAt = new Date();

  constructor(paths = getAppPaths()) {
    this.paths = paths;
  }

  get storagePath() {
    return this.paths.rootDir;
  }

  get startedAtIso() {
    return this.startedAt.toISOString();
  }

  get uptimeMs() {
    return Date.now() - this.startedAt.getTime();
  }

  async init() {
    await mkdir(this.paths.rootDir, { recursive: true });
    const baseline = defaultState();
    const fallbackTask = baseline.tasks[0] ?? createTaskTemplate("Getting started");

    try {
      const raw = await readFile(this.paths.statePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<RuntimeState>;
      this.state = {
        provider: normalizeProvider(parsed.provider),
        selectedTaskId: parsed.selectedTaskId ?? parsed.tasks?.[0]?.id ?? fallbackTask.id,
        tasks: parsed.tasks?.length ? parsed.tasks.map((task) => normalizeTask(task)) : baseline.tasks,
      };
    } catch {
      this.state = defaultState();
      this.state.selectedTaskId = this.state.tasks[0]?.id ?? fallbackTask.id;
      await this.flush();
      return;
    }

    if (!this.state.tasks.length) {
      const task = createTaskTemplate("Getting started");
      this.state.tasks = [task];
      this.state.selectedTaskId = task.id;
    } else if (!this.state.selectedTaskId) {
      this.state.selectedTaskId = this.state.tasks[0]?.id ?? fallbackTask.id;
    }

    this.recalculateDerivedFields();
    await this.flush();
  }

  private recalculateDerivedFields() {
    this.state.tasks = this.state.tasks.map((task) => {
      const lastMessage = [...task.messages].reverse().find((message) => isPreviewableMessage(message)) ?? null;
      const pendingApprovalCount = task.approvals.filter((approval) => approval.status === "pending").length;
      return {
        ...task,
        lastMessagePreview: lastMessage?.content ?? null,
        pendingApprovalCount,
      };
    });
  }

  private async flush() {
    this.recalculateDerivedFields();
    await writeFile(this.paths.statePath, JSON.stringify(this.state, null, 2), "utf8");
  }

  private touchTask(task: TaskDetail, status?: TaskStatus) {
    task.updatedAt = nowIso();
    if (status) {
      task.status = status;
    }
  }

  listTaskSummaries() {
    return [...this.state.tasks]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((task) => toTaskSummary(task));
  }

  getSelectedTaskId() {
    return this.state.selectedTaskId;
  }

  getProvider() {
    return this.state.provider;
  }

  getTask(taskId: string) {
    return this.state.tasks.find((task) => task.id === taskId) ?? null;
  }

  getOperation(taskId: string, operationId: string) {
    return this.getTask(taskId)?.operations.find((operation) => operation.id === operationId) ?? null;
  }

  getAgentRun(taskId: string, agentRunId: string) {
    return this.getTask(taskId)?.agentRuns.find((run) => run.id === agentRunId) ?? null;
  }

  getSelectedTask() {
    if (!this.state.selectedTaskId) {
      return null;
    }

    return this.getTask(this.state.selectedTaskId);
  }

  getSnapshot(
    health: WorkspaceSnapshot["health"],
    machineProfile: MachineProfile,
    localRuntimeAdvice: LocalRuntimeAdvice,
  ): WorkspaceSnapshot {
    return {
      health,
      provider: this.state.provider,
      machineProfile,
      localRuntimeAdvice,
      tasks: this.listTaskSummaries(),
      selectedTaskId: this.state.selectedTaskId,
      selectedTask: this.getSelectedTask(),
    };
  }

  async setProvider(provider: ProviderSettings) {
    this.state.provider = normalizeProvider(provider);
    await this.flush();
  }

  async createTask(title?: string, language: TaskLanguage = "en") {
    const task = createTaskTemplate(title, language);
    this.state.tasks.unshift(task);
    this.state.selectedTaskId = task.id;
    await this.flush();
    return task;
  }

  async selectTask(taskId: string) {
    if (!this.getTask(taskId)) {
      return null;
    }
    this.state.selectedTaskId = taskId;
    await this.flush();
    return this.getTask(taskId);
  }

  async addMessage(taskId: string, message: TaskMessage, status?: TaskStatus) {
    const task = this.getTask(taskId);
    if (!task) {
      return null;
    }

    task.messages.push(message);
    this.touchTask(task, status);
    await this.flush();
    return task;
  }

  async setGuardMode(taskId: string, mode: GuardMode) {
    const task = this.getTask(taskId);
    if (!task) {
      return null;
    }

    task.guardMode = mode;
    this.touchTask(task);
    await this.flush();
    return task;
  }

  async addTerminalEntry(taskId: string, entry: TerminalEntry, status?: TaskStatus) {
    const task = this.getTask(taskId);
    if (!task) {
      return null;
    }

    task.terminalEntries.push(entry);
    this.touchTask(task, status);
    await this.flush();
    return task;
  }

  async addApproval(taskId: string, approval: ApprovalRequest) {
    const task = this.getTask(taskId);
    if (!task) {
      return null;
    }

    task.approvals.push(approval);
    this.touchTask(task, "awaiting_approval");
    await this.flush();
    return task;
  }

  async addOperation(taskId: string, operation: OperationRun, status?: TaskStatus) {
    const task = this.getTask(taskId);
    if (!task) {
      return null;
    }

    task.operations.unshift(operation);
    this.touchTask(task, status);
    await this.flush();
    return operation;
  }

  async addAgentRun(taskId: string, agentRun: AgentRun, status?: TaskStatus) {
    const task = this.getTask(taskId);
    if (!task) {
      return null;
    }

    task.agentRuns.unshift(normalizeAgentRun(agentRun));
    this.touchTask(task, status);
    await this.flush();
    return agentRun;
  }

  async updateOperation(
    taskId: string,
    operationId: string,
    update: (operation: OperationRun) => void,
    status?: TaskStatus | ((operation: OperationRun) => TaskStatus),
  ) {
    const task = this.getTask(taskId);
    if (!task) {
      return null;
    }

    const operation = task.operations.find((candidate) => candidate.id === operationId);
    if (!operation) {
      return null;
    }

    update(operation);
    operation.updatedAt = nowIso();
    const nextStatus = typeof status === "function" ? status(operation) : status;
    this.touchTask(task, nextStatus);
    await this.flush();
    return operation;
  }

  async updateAgentRun(
    taskId: string,
    agentRunId: string,
    update: (agentRun: AgentRun) => void,
    status?: TaskStatus | ((agentRun: AgentRun) => TaskStatus),
  ) {
    const task = this.getTask(taskId);
    if (!task) {
      return null;
    }

    const agentRun = task.agentRuns.find((candidate) => candidate.id === agentRunId);
    if (!agentRun) {
      return null;
    }

    update(agentRun);
    agentRun.updatedAt = nowIso();
    const nextStatus = typeof status === "function" ? status(agentRun) : status;
    this.touchTask(task, nextStatus);
    await this.flush();
    return agentRun;
  }

  async resolveApproval(approvalId: string, status: "approved" | "rejected") {
    for (const task of this.state.tasks) {
      const approval = task.approvals.find((candidate) => candidate.id === approvalId);
      if (!approval || approval.status !== "pending") {
        continue;
      }

      approval.status = status;
      approval.resolvedAt = nowIso();
      task.status = status === "rejected" ? "idle" : task.status;
      task.updatedAt = nowIso();
      await this.flush();
      return { approval, task };
    }

    return null;
  }
}
