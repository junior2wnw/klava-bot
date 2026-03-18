import type { TaskMessage } from "@klava/contracts";

export type ContextCompactionOptions = {
  maxChars?: number;
  maxMessages?: number;
  preserveRecentMessages?: number;
  maxSummaryChars?: number;
  maxSummaryItems?: number;
  maxItemChars?: number;
  summaryLabel?: string;
};

export type ContextCompactionResult = {
  messages: TaskMessage[];
  compacted: boolean;
  originalChars: number;
  compactedChars: number;
  originalMessageCount: number;
  compactedMessageCount: number;
  summarizedMessageCount: number;
};

const DEFAULT_OPTIONS: Required<ContextCompactionOptions> = {
  maxChars: 12_000,
  maxMessages: 12,
  preserveRecentMessages: 8,
  maxSummaryChars: 2_400,
  maxSummaryItems: 12,
  maxItemChars: 220,
  summaryLabel: "Compressed memory of earlier conversation:",
};

function nowIso() {
  return new Date().toISOString();
}

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function clip(value: string, maxChars: number) {
  if (value.length <= maxChars) {
    return value;
  }

  return `${value.slice(0, Math.max(1, maxChars - 1))}…`;
}

function estimateChars(messages: TaskMessage[]) {
  return messages.reduce((total, message) => total + message.content.length, 0);
}

function roleLabel(role: TaskMessage["role"]) {
  switch (role) {
    case "assistant":
      return "ASSISTANT";
    case "tool":
      return "TOOL";
    case "system":
      return "SYSTEM";
    case "user":
    default:
      return "USER";
  }
}

function summarizeLine(message: TaskMessage, maxItemChars: number) {
  const normalized = normalizeWhitespace(message.content);
  if (!normalized) {
    return null;
  }

  return `- ${roleLabel(message.role)}: ${clip(normalized, maxItemChars)}`;
}

type CandidateLine = {
  index: number;
  line: string;
  signature: string;
  score: number;
};

function scoreMessage(message: TaskMessage, index: number, total: number) {
  const normalized = normalizeWhitespace(message.content);
  const relativePosition = total <= 1 ? 1 : index / (total - 1);
  const recencyScore = relativePosition * 4;
  const earlyUserBoost = message.role === "user" && relativePosition <= 0.35 ? 3 : 0;
  const roleScore =
    message.role === "user" ? 6 : message.role === "tool" ? 5 : message.role === "assistant" ? 4 : 2;
  const questionBoost = /[?？]/.test(normalized) ? 1 : 0;
  const structureBoost = /[:;\-\d]/.test(normalized) ? 0.5 : 0;

  return roleScore + recencyScore + earlyUserBoost + questionBoost + structureBoost;
}

export function buildConversationMemorySummary(messages: TaskMessage[], options: ContextCompactionOptions = {}) {
  const settings = { ...DEFAULT_OPTIONS, ...options };
  const candidates: CandidateLine[] = [];

  messages.forEach((message, index) => {
    const line = summarizeLine(message, settings.maxItemChars);
    if (!line) {
      return;
    }

    const signature = `${message.role}:${normalizeWhitespace(message.content).toLowerCase()}`;
    candidates.push({
      index,
      line,
      signature,
      score: scoreMessage(message, index, messages.length),
    });
  });

  if (!candidates.length) {
    return null;
  }

  const selected: CandidateLine[] = [];
  const seen = new Set<string>();
  let remainingChars = settings.maxSummaryChars - settings.summaryLabel.length - 2;

  for (const candidate of [...candidates].sort((left, right) => right.score - left.score || left.index - right.index)) {
    if (selected.length >= settings.maxSummaryItems || remainingChars <= 0) {
      break;
    }

    if (seen.has(candidate.signature)) {
      continue;
    }

    const lineCost = candidate.line.length + 1;
    if (lineCost > remainingChars && selected.length > 0) {
      continue;
    }

    selected.push(candidate);
    seen.add(candidate.signature);
    remainingChars -= lineCost;
  }

  if (!selected.length) {
    return null;
  }

  const orderedLines = selected.sort((left, right) => left.index - right.index).map((candidate) => candidate.line);
  return [settings.summaryLabel, ...orderedLines].join("\n");
}

function buildSummaryMessage(taskId: string, content: string): TaskMessage {
  return {
    id: crypto.randomUUID(),
    taskId,
    role: "system",
    content,
    createdAt: nowIso(),
    meta: {},
  };
}

function compactDialogMessages(taskId: string, dialogMessages: TaskMessage[], options: Required<ContextCompactionOptions>) {
  if (!dialogMessages.length) {
    return {
      recentMessages: [],
      summaryMessage: null as TaskMessage | null,
      summarizedMessageCount: 0,
    };
  }

  let preserveRecentMessages = Math.min(options.preserveRecentMessages, dialogMessages.length);
  let summaryMessage: TaskMessage | null = null;
  let recentMessages = dialogMessages;
  let summarizedMessageCount = 0;

  while (preserveRecentMessages >= 1) {
    recentMessages = dialogMessages.slice(-preserveRecentMessages);
    const olderMessages = dialogMessages.slice(0, Math.max(0, dialogMessages.length - preserveRecentMessages));
    const summaryContent = olderMessages.length > 0 ? buildConversationMemorySummary(olderMessages, options) : null;
    summaryMessage = summaryContent ? buildSummaryMessage(taskId, summaryContent) : null;
    summarizedMessageCount = olderMessages.length;

    const candidateMessages = summaryMessage ? [summaryMessage, ...recentMessages] : [...recentMessages];
    if (candidateMessages.length <= options.maxMessages && estimateChars(candidateMessages) <= options.maxChars) {
      break;
    }

    preserveRecentMessages -= 1;
  }

  if (preserveRecentMessages < 1) {
    const latestMessage = dialogMessages.at(-1);
    recentMessages = latestMessage ? [latestMessage] : [];
    const olderMessages = latestMessage ? dialogMessages.slice(0, -1) : [...dialogMessages];
    const summaryContent = olderMessages.length > 0 ? buildConversationMemorySummary(olderMessages, options) : null;
    summaryMessage = summaryContent ? buildSummaryMessage(taskId, summaryContent) : null;
    summarizedMessageCount = olderMessages.length;
  }

  return {
    recentMessages,
    summaryMessage,
    summarizedMessageCount,
  };
}

export function compactConversationMessages(
  taskId: string,
  messages: TaskMessage[],
  options: ContextCompactionOptions = {},
): ContextCompactionResult {
  const settings = { ...DEFAULT_OPTIONS, ...options };
  const filteredMessages = messages.filter((message) => normalizeWhitespace(message.content).length > 0);
  const systemMessages = filteredMessages.filter((message) => message.role === "system");
  const dialogMessages = filteredMessages.filter((message) => message.role !== "system");
  const originalChars = estimateChars(filteredMessages);

  if (
    filteredMessages.length <= settings.maxMessages &&
    originalChars <= settings.maxChars &&
    dialogMessages.length <= settings.preserveRecentMessages
  ) {
    return {
      messages: filteredMessages,
      compacted: false,
      originalChars,
      compactedChars: originalChars,
      originalMessageCount: filteredMessages.length,
      compactedMessageCount: filteredMessages.length,
      summarizedMessageCount: 0,
    };
  }

  const { recentMessages, summaryMessage, summarizedMessageCount } = compactDialogMessages(taskId, dialogMessages, settings);
  const compactedMessages = [...systemMessages, ...(summaryMessage ? [summaryMessage] : []), ...recentMessages];
  const compactedChars = estimateChars(compactedMessages);

  return {
    messages: compactedMessages,
    compacted: true,
    originalChars,
    compactedChars,
    originalMessageCount: filteredMessages.length,
    compactedMessageCount: compactedMessages.length,
    summarizedMessageCount,
  };
}
