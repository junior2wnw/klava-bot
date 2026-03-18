import type { TaskDetail, TaskMemory, TaskMemoryEntry, TaskMessage } from "@klava/contracts";
import { buildConversationMemorySummary } from "./context-window";
import type { SupportedLanguage } from "./operator-language";

type MemoryCandidate = Omit<TaskMemoryEntry, "id" | "updatedAt"> & {
  updatedAt: string;
};

function nowIso() {
  return new Date().toISOString();
}

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function clip(value: string, maxChars = 220) {
  return value.length <= maxChars ? value : `${value.slice(0, Math.max(1, maxChars - 1))}…`;
}

function visibleDialogMessages(task: TaskDetail) {
  return task.messages.filter(
    (message) =>
      (message.role === "user" || message.role === "assistant") &&
      message.meta.presentation !== "status" &&
      message.meta.presentation !== "artifact",
  );
}

function explicitLanguagePreference(message: TaskMessage): string | null {
  const raw = message.content;
  if (/(?:reply\s+in\s+russian|in\s+russian|на\s+русском|по-русски)/i.test(raw)) {
    return "Reply in Russian unless the user asks for another language.";
  }

  if (/(?:reply\s+in\s+english|in\s+english|на\s+английском|по-английски)/i.test(raw)) {
    return "Reply in English unless the user asks for another language.";
  }

  return null;
}

function inferConstraint(message: TaskMessage): string | null {
  const normalized = normalizeWhitespace(message.content);
  if (normalized.length < 16 || normalized.length > 240) {
    return null;
  }

  if (/(?:\b(?:must|without|avoid|don't|do not|never|exactly|strict)\b|(?:без|не\s+надо|не\s+нужно|не\s+используй|обязательно|строго|только))/i.test(normalized)) {
    return clip(`Operator constraint: ${normalized}`);
  }

  return null;
}

function inferPreference(message: TaskMessage): string | null {
  const normalized = normalizeWhitespace(message.content);
  if (normalized.length < 12 || normalized.length > 220) {
    return null;
  }

  if (/(?:\b(?:prefer|ideally|i want|please use)\b|(?:предпочитаю|лучше|хочу|используй|сделай))/i.test(normalized)) {
    return clip(`Operator preference: ${normalized}`);
  }

  return null;
}

function inferLatestGoal(messages: TaskMessage[]) {
  const latestUser = [...messages].reverse().find((message) => message.role === "user");
  if (!latestUser) {
    return null;
  }

  const normalized = normalizeWhitespace(latestUser.content);
  if (normalized.length < 8) {
    return null;
  }

  return {
    content: clip(`Latest operator request: ${normalized}`),
    sourceMessageId: latestUser.id,
    updatedAt: latestUser.createdAt,
  };
}

function scoreByRecency(index: number, total: number) {
  if (total <= 1) {
    return 1;
  }

  return 1 + index / Math.max(1, total - 1);
}

function candidateKey(candidate: MemoryCandidate) {
  return `${candidate.kind}:${candidate.content.toLowerCase()}`;
}

function upsertCandidate(target: Map<string, MemoryCandidate>, candidate: MemoryCandidate) {
  const key = candidateKey(candidate);
  const existing = target.get(key);
  if (!existing || candidate.score >= existing.score) {
    target.set(key, candidate);
  }
}

export function deriveTaskMemory(task: TaskDetail): TaskMemory {
  const dialogMessages = visibleDialogMessages(task);
  const summary = buildConversationMemorySummary(dialogMessages, {
    maxSummaryChars: 1_600,
    maxSummaryItems: 10,
    maxItemChars: 180,
    summaryLabel: "Persistent task memory:",
  });
  const candidates = new Map<string, MemoryCandidate>();

  const latestGoal = inferLatestGoal(dialogMessages);
  if (latestGoal) {
    upsertCandidate(candidates, {
      kind: "goal",
      content: latestGoal.content,
      sourceMessageId: latestGoal.sourceMessageId,
      sourceRunId: null,
      score: 9,
      status: "active",
      updatedAt: latestGoal.updatedAt,
    });
  }

  dialogMessages.forEach((message, index) => {
    const recencyScore = scoreByRecency(index, dialogMessages.length);
    const languagePreference = explicitLanguagePreference(message);
    if (languagePreference) {
      upsertCandidate(candidates, {
        kind: "preference",
        content: languagePreference,
        sourceMessageId: message.id,
        sourceRunId: null,
        score: 8 + recencyScore,
        status: "active",
        updatedAt: message.createdAt,
      });
    }

    const constraint = inferConstraint(message);
    if (message.role === "user" && constraint) {
      upsertCandidate(candidates, {
        kind: "constraint",
        content: constraint,
        sourceMessageId: message.id,
        sourceRunId: null,
        score: 6 + recencyScore,
        status: "active",
        updatedAt: message.createdAt,
      });
    }

    const preference = inferPreference(message);
    if (message.role === "user" && preference) {
      upsertCandidate(candidates, {
        kind: "preference",
        content: preference,
        sourceMessageId: message.id,
        sourceRunId: null,
        score: 5 + recencyScore,
        status: "active",
        updatedAt: message.createdAt,
      });
    }
  });

  upsertCandidate(candidates, {
    kind: "constraint",
    content: `Task guard mode is ${task.guardMode}.`,
    sourceMessageId: null,
    sourceRunId: null,
    score: 7,
    status: "active",
    updatedAt: task.updatedAt,
  });

  for (const approval of task.approvals.filter((item) => item.status === "pending")) {
    upsertCandidate(candidates, {
      kind: "open_loop",
      content: clip(`Approval is still pending for command: ${approval.command}`),
      sourceMessageId: null,
      sourceRunId: approval.meta.agentRunId ?? null,
      score: 10,
      status: "active",
      updatedAt: approval.createdAt,
    });
  }

  for (const operation of task.operations.slice(0, 4)) {
    if (operation.status === "awaiting_approval" || operation.status === "running" || operation.status === "draft") {
      upsertCandidate(candidates, {
        kind: "open_loop",
        content: clip(`Operation in progress: ${operation.title}. Goal: ${operation.goal}`),
        sourceMessageId: null,
        sourceRunId: null,
        score: 7,
        status: "active",
        updatedAt: operation.updatedAt,
      });
    }
  }

  for (const run of task.agentRuns.slice(0, 4)) {
    if (run.goal.trim()) {
      upsertCandidate(candidates, {
        kind: "goal",
        content: clip(`Agent objective: ${run.goal}`),
        sourceMessageId: null,
        sourceRunId: run.id,
        score: run.status === "succeeded" ? 6 : 9,
        status: run.status === "succeeded" ? "resolved" : "active",
        updatedAt: run.updatedAt,
      });
    }

    if (run.summary?.trim()) {
      upsertCandidate(candidates, {
        kind: run.status === "succeeded" ? "fact" : "open_loop",
        content: clip(run.summary.trim()),
        sourceMessageId: null,
        sourceRunId: run.id,
        score: run.status === "succeeded" ? 7 : 8,
        status: run.status === "succeeded" ? "resolved" : "active",
        updatedAt: run.updatedAt,
      });
    }
  }

  for (const terminalEntry of task.terminalEntries.slice(-4)) {
    if (terminalEntry.status === "completed") {
      upsertCandidate(candidates, {
        kind: "fact",
        content: clip(`Terminal command completed: ${terminalEntry.command}`),
        sourceMessageId: null,
        sourceRunId: null,
        score: 5,
        status: "resolved",
        updatedAt: terminalEntry.createdAt,
      });
    }
  }

  const entries = [...candidates.values()]
    .sort((left, right) => right.score - left.score || right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, 14)
    .map<TaskMemoryEntry>((candidate) => ({
      id: crypto.randomUUID(),
      kind: candidate.kind,
      content: candidate.content,
      sourceMessageId: candidate.sourceMessageId,
      sourceRunId: candidate.sourceRunId,
      score: Number(candidate.score.toFixed(2)),
      status: candidate.status,
      updatedAt: candidate.updatedAt,
    }));

  return {
    summary: summary ?? null,
    updatedAt: entries.length || summary ? task.updatedAt : null,
    entries,
  };
}

function sectionTitle(kind: TaskMemoryEntry["kind"], language: SupportedLanguage) {
  if (language === "ru") {
    switch (kind) {
      case "goal":
        return "Цели";
      case "constraint":
        return "Ограничения";
      case "preference":
        return "Предпочтения";
      case "decision":
        return "Решения";
      case "fact":
        return "Подтверждённые факты";
      case "open_loop":
        return "Открытые хвосты";
      default:
        return "Память";
    }
  }

  switch (kind) {
    case "goal":
      return "Goals";
    case "constraint":
      return "Constraints";
    case "preference":
      return "Preferences";
    case "decision":
      return "Decisions";
    case "fact":
      return "Verified facts";
    case "open_loop":
      return "Open loops";
    default:
      return "Memory";
  }
}

export function buildTaskMemoryPrompt(memory: TaskMemory, language: SupportedLanguage, maxEntries = 10) {
  if (!memory.summary && !memory.entries.length) {
    return null;
  }

  const lines: string[] = [
    language === "ru"
      ? "Долговременная память задачи. Используй это как рабочую память, но если свежий контекст противоречит старому, приоритет у более нового сигнала."
      : "Persistent task memory. Use this as working memory, but if fresh context conflicts with older memory, prefer the newer signal.",
  ];

  if (memory.summary?.trim()) {
    lines.push("");
    lines.push(language === "ru" ? "Сводка:" : "Summary:");
    lines.push(memory.summary.trim());
  }

  const groupedKinds: TaskMemoryEntry["kind"][] = ["goal", "constraint", "preference", "decision", "fact", "open_loop"];
  for (const kind of groupedKinds) {
    const items = memory.entries.filter((entry) => entry.kind === kind).slice(0, maxEntries);
    if (!items.length) {
      continue;
    }

    lines.push("");
    lines.push(`${sectionTitle(kind, language)}:`);
    for (const item of items) {
      lines.push(`- ${item.content}`);
    }
  }

  return lines.join("\n");
}
