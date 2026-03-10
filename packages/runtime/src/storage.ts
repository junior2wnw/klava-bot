import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type {
  ApprovalRequest,
  GuardMode,
  ProviderBalance,
  ProviderSettings,
  TaskDetail,
  TaskMessage,
  TaskStatus,
  TaskSummary,
  TerminalEntry,
  WorkspaceSnapshot,
} from "@klava/contracts";
import { DEFAULT_MODEL } from "./constants";

type RuntimeState = {
  provider: ProviderSettings;
  selectedTaskId: string | null;
  tasks: TaskDetail[];
};

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
  const validatedAt = typeof provider?.validatedAt === "string" ? provider.validatedAt : null;

  return {
    provider: "gonka",
    selectionMode: "auto",
    model: typeof provider?.model === "string" && provider.model.trim().length > 0 ? provider.model.trim() : DEFAULT_MODEL,
    secretConfigured: provider?.secretConfigured ?? false,
    requesterAddress: typeof provider?.requesterAddress === "string" ? provider.requesterAddress : null,
    balance: normalizeProviderBalance(provider?.balance),
    validatedAt,
    modelRefreshedAt: typeof provider?.modelRefreshedAt === "string" ? provider.modelRefreshedAt : validatedAt,
  };
}

export function createTaskTemplate(title?: string): TaskDetail {
  const timestamp = nowIso();
  const id = crypto.randomUUID();

  const welcomeMessage: TaskMessage = {
    id: crypto.randomUUID(),
    taskId: id,
    role: "system",
    content:
      "Task ready. Ask Klava anything, use /terminal <command>, $ <command>, or change guard mode with guard strict|balanced|off.",
    createdAt: timestamp,
    meta: {},
  };

  return {
    id,
    title: title?.trim() || `Task ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
    status: "idle",
    guardMode: "balanced",
    createdAt: timestamp,
    updatedAt: timestamp,
    lastMessagePreview: welcomeMessage.content,
    pendingApprovalCount: 0,
    messages: [welcomeMessage],
    terminalEntries: [],
    approvals: [],
  };
}

function defaultState(): RuntimeState {
  return {
    provider: normalizeProvider({
      secretConfigured: false,
      requesterAddress: null,
      balance: null,
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
        tasks: parsed.tasks?.length ? parsed.tasks : baseline.tasks,
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
      const lastMessage = task.messages.at(-1);
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

  getSelectedTask() {
    if (!this.state.selectedTaskId) {
      return null;
    }

    return this.getTask(this.state.selectedTaskId);
  }

  getSnapshot(health: WorkspaceSnapshot["health"]): WorkspaceSnapshot {
    return {
      health,
      provider: this.state.provider,
      tasks: this.listTaskSummaries(),
      selectedTaskId: this.state.selectedTaskId,
      selectedTask: this.getSelectedTask(),
    };
  }

  async setProvider(provider: ProviderSettings) {
    this.state.provider = normalizeProvider(provider);
    await this.flush();
  }

  async createTask(title?: string) {
    const task = createTaskTemplate(title);
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
