import type {
  TaskDetail,
  TaskExecutionJournal,
  TaskJournalEvent,
  TaskResumeState,
  TaskStatus,
} from "@klava/contracts";
import { detectPreferredAssistantLanguage, type SupportedLanguage } from "./operator-language";

const MAX_JOURNAL_EVENTS = 180;

export type JournalEventInput = {
  scope: TaskJournalEvent["scope"];
  kind: string;
  title: string;
  detail?: string | null;
  level: TaskJournalEvent["level"];
  taskStatus: TaskStatus;
  createdAt?: string;
  agentRunId?: string | null;
  operationId?: string | null;
  approvalId?: string | null;
  terminalEntryId?: string | null;
  toolCallId?: string | null;
};

function nowIso() {
  return new Date().toISOString();
}

function clip(value: string, maxChars = 220) {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return null;
  }

  return normalized.length > maxChars ? `${normalized.slice(0, Math.max(1, maxChars - 1))}...` : normalized;
}

function inLanguage(language: SupportedLanguage, english: string, russian: string) {
  return language === "ru" ? russian : english;
}

function latestPendingApproval(task: TaskDetail) {
  return [...task.approvals].reverse().find((approval) => approval.status === "pending") ?? null;
}

function activeAgentRun(task: TaskDetail) {
  return (
    task.agentRuns.find(
      (run) => run.status === "running" || run.status === "awaiting_approval" || run.status === "needs_input",
    ) ?? null
  );
}

function activeOperation(task: TaskDetail) {
  return (
    task.operations.find(
      (operation) =>
        operation.status === "running" || operation.status === "awaiting_approval" || operation.status === "draft",
    ) ?? null
  );
}

function sameResumeIdentity(left: TaskResumeState | null, right: TaskResumeState | null) {
  if (!left || !right) {
    return false;
  }

  return (
    left.mode === right.mode &&
    left.agentRunId === right.agentRunId &&
    left.operationId === right.operationId &&
    left.approvalId === right.approvalId
  );
}

function buildResumeState(task: TaskDetail, existing: TaskResumeState | null): TaskResumeState | null {
  const language = detectPreferredAssistantLanguage(task.messages);
  const pendingApproval = latestPendingApproval(task);
  if (pendingApproval) {
    const candidate: TaskResumeState = {
      mode: "awaiting_approval",
      taskId: task.id,
      reason: inLanguage(
        language,
        `Approval is still required before ${pendingApproval.command} can continue.`,
        `Нужно подтверждение, прежде чем можно будет продолжить ${pendingApproval.command}.`,
      ),
      preferredLanguage: language,
      recoverable: true,
      agentRunId: pendingApproval.meta.agentRunId ?? null,
      operationId: pendingApproval.meta.operationId ?? null,
      approvalId: pendingApproval.id,
      updatedAt: task.updatedAt,
    };
    return sameResumeIdentity(existing, candidate)
      ? { ...candidate, reason: existing?.reason ?? candidate.reason, updatedAt: existing?.updatedAt ?? candidate.updatedAt }
      : candidate;
  }

  const run = activeAgentRun(task);
  if (run) {
    const candidate: TaskResumeState = {
      mode: "continue_agent",
      taskId: task.id,
      reason:
        run.status === "needs_input"
          ? inLanguage(
              language,
              "The saved agent run can continue from its plan, tool history, and task journal.",
              "Сохранённый агентный проход можно продолжить с его планом, историей инструментов и журналом выполнения.",
            )
          : inLanguage(
              language,
              "The active agent run can be resumed from the saved checkpoints.",
              "Активный агентный проход можно возобновить из сохранённых контрольных точек.",
            ),
      preferredLanguage: language,
      recoverable: true,
      agentRunId: run.id,
      operationId: null,
      approvalId: run.pendingApprovalId ?? null,
      updatedAt: run.updatedAt,
    };
    return sameResumeIdentity(existing, candidate)
      ? { ...candidate, reason: existing?.reason ?? candidate.reason, updatedAt: existing?.updatedAt ?? candidate.updatedAt }
      : candidate;
  }

  const operation = activeOperation(task);
  if (operation) {
    const candidate: TaskResumeState = {
      mode: "retry_operation",
      taskId: task.id,
      reason: inLanguage(
        language,
        `Operation "${operation.title}" can continue from the next pending step.`,
        `Операцию "${operation.title}" можно продолжить со следующего ожидающего шага.`,
      ),
      preferredLanguage: language,
      recoverable: true,
      agentRunId: null,
      operationId: operation.id,
      approvalId: null,
      updatedAt: operation.updatedAt,
    };
    return sameResumeIdentity(existing, candidate)
      ? { ...candidate, reason: existing?.reason ?? candidate.reason, updatedAt: existing?.updatedAt ?? candidate.updatedAt }
      : candidate;
  }

  return null;
}

function eventLine(event: TaskJournalEvent) {
  const detail = clip(event.detail ?? "", 220);
  return detail ? `${event.title} - ${detail}` : event.title;
}

export function createExecutionJournal(): TaskExecutionJournal {
  return {
    updatedAt: null,
    activeResume: null,
    events: [],
  };
}

export function createJournalEvent(
  taskId: string,
  input: JournalEventInput,
): TaskJournalEvent {
  return {
    id: crypto.randomUUID(),
    taskId,
    scope: input.scope,
    kind: input.kind,
    title: input.title,
    detail: input.detail ?? null,
    level: input.level,
    taskStatus: input.taskStatus,
    createdAt: input.createdAt ?? nowIso(),
    agentRunId: input.agentRunId ?? null,
    operationId: input.operationId ?? null,
    approvalId: input.approvalId ?? null,
    terminalEntryId: input.terminalEntryId ?? null,
    toolCallId: input.toolCallId ?? null,
  };
}

export function appendJournalEvent(task: TaskDetail, event: TaskJournalEvent) {
  const journal = task.journal ?? createExecutionJournal();
  const dedupeKey = `${event.kind}:${event.title}:${event.detail ?? ""}:${event.agentRunId ?? ""}:${event.operationId ?? ""}:${event.approvalId ?? ""}:${event.terminalEntryId ?? ""}:${event.toolCallId ?? ""}`;
  const latest = journal.events.at(-1);
  const latestKey = latest
    ? `${latest.kind}:${latest.title}:${latest.detail ?? ""}:${latest.agentRunId ?? ""}:${latest.operationId ?? ""}:${latest.approvalId ?? ""}:${latest.terminalEntryId ?? ""}:${latest.toolCallId ?? ""}`
    : null;

  if (dedupeKey !== latestKey) {
    journal.events.push(event);
    journal.events = journal.events.slice(-MAX_JOURNAL_EVENTS);
    journal.updatedAt = event.createdAt;
  }

  task.journal = journal;
}

export function syncTaskExecutionJournal(task: TaskDetail) {
  const journal = task.journal ?? createExecutionJournal();
  journal.events = journal.events.slice(-MAX_JOURNAL_EVENTS);
  journal.activeResume = buildResumeState(task, journal.activeResume ?? null);
  journal.updatedAt = journal.activeResume?.updatedAt ?? journal.updatedAt ?? task.updatedAt;
  task.journal = journal;
}

function recalculateTaskStatus(task: TaskDetail): TaskStatus {
  if (task.approvals.some((approval) => approval.status === "pending")) {
    return "awaiting_approval";
  }

  const run = activeAgentRun(task);
  if (run) {
    if (run.status === "awaiting_approval") {
      return "awaiting_approval";
    }

    return run.status === "running" ? "running" : "idle";
  }

  const operation = activeOperation(task);
  if (operation) {
    if (operation.status === "awaiting_approval") {
      return "awaiting_approval";
    }

    return operation.status === "running" ? "running" : "idle";
  }

  return task.status === "failed" || task.status === "succeeded" ? task.status : "idle";
}

export function recoverInterruptedTask(task: TaskDetail) {
  let changed = false;
  const interruptedRuns = task.agentRuns.filter((run) => run.status === "running");
  for (const run of interruptedRuns) {
    run.status = "needs_input";
    run.summary = run.summary ?? "The runtime restarted before this run reached a verified stopping point.";
    run.lastAssistantMessage = run.lastAssistantMessage ?? "The agent run was paused by a runtime restart and can resume from the saved checkpoints.";
    changed = true;
  }

  for (const operation of task.operations.filter((candidate) => candidate.status === "running")) {
    operation.status = "draft";
    operation.activeStepId = null;
    for (const step of operation.steps) {
      if (step.status === "running") {
        step.status = "pending";
        step.finishedAt = null;
      }
    }
    changed = true;
  }

  if (changed) {
    task.status = recalculateTaskStatus(task);
    appendJournalEvent(
      task,
      createJournalEvent(task.id, {
        scope: "runtime",
        kind: "runtime.recovered",
        title: "Recovered interrupted execution state after runtime restart",
        detail: [
          interruptedRuns.length ? `${interruptedRuns.length} agent run(s) moved to resumable state` : null,
          task.operations.some((operation) => operation.status === "draft")
            ? "active operations were returned to a safe retry point"
            : null,
        ]
          .filter(Boolean)
          .join("; "),
        level: "warning",
        taskStatus: task.status,
      }),
    );
  }

  syncTaskExecutionJournal(task);
  return changed;
}

function scopeLabel(scope: TaskJournalEvent["scope"], language: SupportedLanguage) {
  if (language === "ru") {
    switch (scope) {
      case "agent":
        return "Агент";
      case "terminal":
        return "Терминал";
      case "approval":
        return "Подтверждение";
      case "operation":
        return "Операция";
      case "runtime":
        return "Рантайм";
      case "retrieval":
        return "Поиск контекста";
      case "message":
        return "Диалог";
      case "task":
      default:
        return "Задача";
    }
  }

  switch (scope) {
    case "agent":
      return "Agent";
    case "terminal":
      return "Terminal";
    case "approval":
      return "Approval";
    case "operation":
      return "Operation";
    case "runtime":
      return "Runtime";
    case "retrieval":
      return "Retrieval";
    case "message":
      return "Dialog";
    case "task":
    default:
      return "Task";
  }
}

export function buildExecutionJournalPrompt(journal: TaskExecutionJournal, language: SupportedLanguage, maxEvents = 8) {
  if (!journal.events.length && !journal.activeResume) {
    return null;
  }

  const lines: string[] = [
    inLanguage(
      language,
      "Execution journal. Treat this as the verified timeline of what the runtime actually did.",
      "Журнал выполнения. Используй его как подтверждённую хронологию того, что рантайм реально сделал.",
    ),
  ];

  if (journal.activeResume) {
    lines.push(
      "",
      inLanguage(language, "Active resume point:", "Активная точка продолжения:"),
      `- ${journal.activeResume.reason}`,
    );
  }

  const events = journal.events.slice(-Math.max(1, maxEvents));
  if (events.length) {
    lines.push("", inLanguage(language, "Recent verified events:", "Последние подтверждённые события:"));
    for (const event of events) {
      lines.push(`- [${scopeLabel(event.scope, language)}] ${eventLine(event)}`);
    }
  }

  return lines.join("\n");
}
