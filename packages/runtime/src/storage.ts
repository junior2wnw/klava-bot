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
  TaskExecutionJournal,
  TaskMemory,
  TaskMessage,
  TaskStatus,
  TaskSummary,
  TerminalEntry,
  WorkspaceSnapshot,
} from "@klava/contracts";
import { defaultApiBaseUrlForProvider, defaultModelForProvider } from "./provider-catalog";
import {
  appendJournalEvent,
  createExecutionJournal,
  createJournalEvent,
  recoverInterruptedTask,
  syncTaskExecutionJournal,
} from "./execution-journal";
import { deriveTaskMemory } from "./task-memory";

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
            toolCall?.kind === "context.retrieve" ||
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
    memory: normalizeTaskMemory(task?.memory),
    journal: normalizeTaskJournal(task?.journal, typeof task?.id === "string" ? task.id : fallback.id),
  };
}

function normalizeTaskMemory(memory?: Partial<TaskMemory> | null): TaskMemory {
  return {
    summary: typeof memory?.summary === "string" ? memory.summary : null,
    updatedAt: typeof memory?.updatedAt === "string" ? memory.updatedAt : null,
    entries: Array.isArray(memory?.entries)
      ? memory.entries
          .filter((entry) => entry && typeof entry === "object")
          .map((entry) => ({
            id: typeof entry.id === "string" ? entry.id : crypto.randomUUID(),
            kind:
              entry.kind === "goal" ||
              entry.kind === "constraint" ||
              entry.kind === "preference" ||
              entry.kind === "decision" ||
              entry.kind === "fact" ||
              entry.kind === "open_loop"
                ? entry.kind
                : "fact",
            content: typeof entry.content === "string" ? entry.content : "Memory entry",
            sourceMessageId: typeof entry.sourceMessageId === "string" ? entry.sourceMessageId : null,
            sourceRunId: typeof entry.sourceRunId === "string" ? entry.sourceRunId : null,
            score: typeof entry.score === "number" && Number.isFinite(entry.score) && entry.score >= 0 ? entry.score : 0,
            status: entry.status === "active" || entry.status === "resolved" || entry.status === "stale" ? entry.status : "active",
            updatedAt: typeof entry.updatedAt === "string" ? entry.updatedAt : nowIso(),
          }))
      : [],
  };
}

function normalizeTaskJournal(journal?: Partial<TaskExecutionJournal> | null, taskId = ""): TaskExecutionJournal {
  const fallback = createExecutionJournal();
  return {
    updatedAt: typeof journal?.updatedAt === "string" ? journal.updatedAt : fallback.updatedAt,
    activeResume:
      journal?.activeResume && typeof journal.activeResume === "object"
        ? {
            mode:
              journal.activeResume.mode === "continue_agent" ||
              journal.activeResume.mode === "awaiting_approval" ||
              journal.activeResume.mode === "retry_operation"
                ? journal.activeResume.mode
                : "continue_agent",
            taskId: typeof journal.activeResume.taskId === "string" && journal.activeResume.taskId.length > 0 ? journal.activeResume.taskId : taskId,
            reason:
              typeof journal.activeResume.reason === "string" && journal.activeResume.reason.trim().length > 0
                ? journal.activeResume.reason
                : "Resume point available.",
            preferredLanguage:
              journal.activeResume.preferredLanguage === "ru" || journal.activeResume.preferredLanguage === "en"
                ? journal.activeResume.preferredLanguage
                : null,
            recoverable: journal.activeResume.recoverable ?? true,
            agentRunId: typeof journal.activeResume.agentRunId === "string" ? journal.activeResume.agentRunId : null,
            operationId: typeof journal.activeResume.operationId === "string" ? journal.activeResume.operationId : null,
            approvalId: typeof journal.activeResume.approvalId === "string" ? journal.activeResume.approvalId : null,
            updatedAt: typeof journal.activeResume.updatedAt === "string" ? journal.activeResume.updatedAt : nowIso(),
          }
        : null,
    events: Array.isArray(journal?.events)
      ? journal.events
          .filter((event) => event && typeof event === "object")
          .map((event) => ({
            id: typeof event.id === "string" ? event.id : crypto.randomUUID(),
            taskId: typeof event.taskId === "string" && event.taskId.length > 0 ? event.taskId : taskId,
            scope:
              event.scope === "task" ||
              event.scope === "message" ||
              event.scope === "agent" ||
              event.scope === "terminal" ||
              event.scope === "approval" ||
              event.scope === "operation" ||
              event.scope === "runtime" ||
              event.scope === "retrieval"
                ? event.scope
                : "task",
            kind: typeof event.kind === "string" && event.kind.trim().length > 0 ? event.kind : "task.event",
            title: typeof event.title === "string" && event.title.trim().length > 0 ? event.title : "Task event",
            detail: typeof event.detail === "string" ? event.detail : null,
            level: event.level === "warning" || event.level === "error" ? event.level : "info",
            taskStatus:
              event.taskStatus === "idle" ||
              event.taskStatus === "running" ||
              event.taskStatus === "awaiting_approval" ||
              event.taskStatus === "succeeded" ||
              event.taskStatus === "failed"
                ? event.taskStatus
                : "idle",
            createdAt: typeof event.createdAt === "string" ? event.createdAt : nowIso(),
            agentRunId: typeof event.agentRunId === "string" ? event.agentRunId : null,
            operationId: typeof event.operationId === "string" ? event.operationId : null,
            approvalId: typeof event.approvalId === "string" ? event.approvalId : null,
            terminalEntryId: typeof event.terminalEntryId === "string" ? event.terminalEntryId : null,
            toolCallId: typeof event.toolCallId === "string" ? event.toolCallId : null,
          }))
      : fallback.events,
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
        ? "Задача готова. Опишите цель, используйте `/terminal <команда>` или `$ <команда>`. Режим защиты можно переключить командами `guard strict`, `guard balanced` и `guard off`."
        : "Task ready. Describe a goal, use /terminal <command>, $ <command>, or change guard mode with guard strict|balanced|off.",
    createdAt: timestamp,
    meta: {
      presentation: "status",
      statusState: "info",
    },
  };

  const journal = createExecutionJournal();
  journal.events.push(
    createJournalEvent(id, {
      scope: "task",
      kind: "task.created",
      title: language === "ru" ? "Задача создана" : "Task created",
      detail: title?.trim() || defaultTitle,
      level: "info",
      taskStatus: "idle",
      createdAt: timestamp,
    }),
  );
  journal.updatedAt = timestamp;

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
    memory: {
      summary: null,
      updatedAt: null,
      entries: [],
    },
    journal,
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

    for (const task of this.state.tasks) {
      recoverInterruptedTask(task);
    }

    this.recalculateDerivedFields();
    await this.flush();
  }

  private recalculateDerivedFields() {
    this.state.tasks = this.state.tasks.map((task) => {
      const lastMessage = [...task.messages].reverse().find((message) => isPreviewableMessage(message)) ?? null;
      const pendingApprovalCount = task.approvals.filter((approval) => approval.status === "pending").length;
      const memory = deriveTaskMemory(task);
      const nextTask: TaskDetail = {
        ...task,
        lastMessagePreview: lastMessage?.content ?? null,
        pendingApprovalCount,
        memory,
      };
      syncTaskExecutionJournal(nextTask);
      return nextTask;
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

  private recordTaskEvent(
    task: TaskDetail,
    input: Omit<Parameters<typeof createJournalEvent>[1], "taskStatus"> & { taskStatus?: TaskStatus },
  ) {
    appendJournalEvent(
      task,
      createJournalEvent(task.id, {
        ...input,
        taskStatus: input.taskStatus ?? task.status,
      }),
    );
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
    if (message.role === "user") {
      this.recordTaskEvent(task, {
        scope: "message",
        kind: "message.user",
        title: "Operator message received",
        detail: message.content,
        level: "info",
      });
    } else if (message.role === "assistant" && message.meta.presentation !== "status") {
      this.recordTaskEvent(task, {
        scope: "message",
        kind: "message.assistant",
        title: "Assistant reply recorded",
        detail: message.content,
        level: "info",
        agentRunId: message.meta.agentRunId ?? null,
        terminalEntryId: message.meta.terminalEntryId ?? null,
        toolCallId: message.meta.agentToolCallId ?? null,
      });
    }
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
    this.recordTaskEvent(task, {
      scope: "terminal",
      kind: `terminal.${entry.status}`,
      title:
        entry.status === "completed"
          ? "Terminal command completed"
          : entry.status === "pending_approval"
            ? "Terminal command paused for approval"
            : entry.status === "blocked"
              ? "Terminal command blocked"
              : "Terminal command failed",
      detail: entry.command,
      level: entry.status === "completed" ? "info" : entry.status === "pending_approval" ? "warning" : "error",
      terminalEntryId: entry.id,
    });
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
    this.recordTaskEvent(task, {
      scope: "approval",
      kind: "approval.requested",
      title: "Approval requested",
      detail: `${approval.command} - ${approval.impact}`,
      level: "warning",
      approvalId: approval.id,
      agentRunId: approval.meta.agentRunId ?? null,
      operationId: approval.meta.operationId ?? null,
    });
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
    this.recordTaskEvent(task, {
      scope: "operation",
      kind: "operation.created",
      title: `Operation created: ${operation.title}`,
      detail: operation.goal,
      level: "info",
      operationId: operation.id,
    });
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
    this.recordTaskEvent(task, {
      scope: "agent",
      kind: "agent.started",
      title: `Agent run started: ${agentRun.title}`,
      detail: agentRun.goal,
      level: "info",
      agentRunId: agentRun.id,
    });
    await this.flush();
    return agentRun;
  }

  async appendTaskJournalEvent(
    taskId: string,
    input: Omit<Parameters<typeof createJournalEvent>[1], "taskStatus"> & { taskStatus?: TaskStatus },
    status?: TaskStatus,
  ) {
    const task = this.getTask(taskId);
    if (!task) {
      return null;
    }

    this.touchTask(task, status);
    this.recordTaskEvent(task, input);
    await this.flush();
    return task;
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

    const previousStatus = operation.status;
    const previousSummary = operation.summary;
    const previousActiveStepId = operation.activeStepId;
    update(operation);
    operation.updatedAt = nowIso();
    const nextStatus = typeof status === "function" ? status(operation) : status;
    this.touchTask(task, nextStatus);
    if (
      operation.status !== previousStatus ||
      operation.summary !== previousSummary ||
      operation.activeStepId !== previousActiveStepId
    ) {
      this.recordTaskEvent(task, {
        scope: "operation",
        kind: `operation.${operation.status}`,
        title: `Operation ${operation.status}: ${operation.title}`,
        detail: operation.summary ?? operation.goal,
        level: operation.status === "failed" ? "error" : operation.status === "awaiting_approval" ? "warning" : "info",
        operationId: operation.id,
      });
    }
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

    const previousStatus = agentRun.status;
    const previousSummary = agentRun.summary;
    const previousPendingApprovalId = agentRun.pendingApprovalId;
    update(agentRun);
    agentRun.updatedAt = nowIso();
    const nextStatus = typeof status === "function" ? status(agentRun) : status;
    this.touchTask(task, nextStatus);
    if (
      agentRun.status !== previousStatus ||
      agentRun.summary !== previousSummary ||
      agentRun.pendingApprovalId !== previousPendingApprovalId
    ) {
      this.recordTaskEvent(task, {
        scope: "agent",
        kind: `agent.${agentRun.status}`,
        title: `Agent run ${agentRun.status}: ${agentRun.title}`,
        detail: agentRun.summary ?? agentRun.goal,
        level:
          agentRun.status === "failed" || agentRun.status === "blocked"
            ? "error"
            : agentRun.status === "awaiting_approval"
              ? "warning"
              : "info",
        agentRunId: agentRun.id,
        approvalId: agentRun.pendingApprovalId,
      });
    }
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
      this.recordTaskEvent(task, {
        scope: "approval",
        kind: `approval.${status}`,
        title: status === "approved" ? "Approval granted" : "Approval rejected",
        detail: approval.command,
        level: status === "approved" ? "info" : "warning",
        approvalId: approval.id,
        agentRunId: approval.meta.agentRunId ?? null,
        operationId: approval.meta.operationId ?? null,
      });
      await this.flush();
      return { approval, task };
    }

    return null;
  }
}
