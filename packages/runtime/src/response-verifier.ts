import type { TaskDetail } from "@klava/contracts";
import { detectTextLanguage, type SupportedLanguage } from "./operator-language";

export type ResponseVerificationIssue = "language_mismatch" | "unsupported_execution_claim" | "oversized_message";

export type ResponseVerificationResult = {
  content: string;
  issues: ResponseVerificationIssue[];
};

const executionClaimPattern =
  /\b(?:I checked|I inspected|I ran|I executed|I installed|I updated|I changed|I edited|I verified|I audited|I fixed|Я проверил|Я запустил|Я выполнил|Я установил|Я обновил|Я изменил|Я отредактировал|Я подтвердил|Я проверила|Я запустила|Я выполнила|Я установила|Я обновила|Я изменила|Я отредактировала|Я подтвердила)\b/i;

function clip(value: string, maxChars: number) {
  return value.length <= maxChars ? value : `${value.slice(0, Math.max(1, maxChars - 1))}…`;
}

function latestExecutionEvidence(task: TaskDetail, agentRunId?: string | null) {
  const relevantRun = agentRunId ? task.agentRuns.find((run) => run.id === agentRunId) : null;
  if (relevantRun?.toolCalls.length) {
    return true;
  }

  if (task.terminalEntries.some((entry) => entry.status === "completed" || entry.status === "failed" || entry.status === "blocked")) {
    return true;
  }

  return task.messages.some(
    (message) =>
      message.role === "tool" ||
      message.meta.terminalEntryId ||
      message.meta.agentToolCallId ||
      message.meta.computerIntent,
  );
}

function stripLeadingSentenceWithExecutionClaim(content: string) {
  const sentences = content
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (!sentences.length) {
    return content.trim();
  }

  if (executionClaimPattern.test(sentences[0] ?? "")) {
    return sentences.slice(1).join(" ").trim();
  }

  return content.trim();
}

function unsupportedClaimDisclaimer(language: SupportedLanguage) {
  return language === "ru"
    ? "У меня пока нет подтверждённого локального результата по этому шагу."
    : "I do not have a verified local execution result for that step yet.";
}

function repairUnsupportedExecutionClaim(content: string, language: SupportedLanguage) {
  const stripped = stripLeadingSentenceWithExecutionClaim(content);
  const disclaimer = unsupportedClaimDisclaimer(language);
  if (!stripped) {
    return disclaimer;
  }

  return `${disclaimer} ${stripped}`.trim();
}

export function verifyAssistantResponse(
  task: TaskDetail,
  content: string,
  language: SupportedLanguage,
  options: { agentRunId?: string | null; maxChars?: number } = {},
): ResponseVerificationResult {
  const issues: ResponseVerificationIssue[] = [];
  let nextContent = content.trim();

  const detectedLanguage = detectTextLanguage(nextContent);
  if (detectedLanguage && detectedLanguage !== language) {
    issues.push("language_mismatch");
  }

  const maxChars = options.maxChars ?? 4_000;
  if (nextContent.length > maxChars) {
    nextContent = clip(nextContent, maxChars);
    issues.push("oversized_message");
  }

  if (executionClaimPattern.test(nextContent) && !latestExecutionEvidence(task, options.agentRunId)) {
    nextContent = repairUnsupportedExecutionClaim(nextContent, language);
    issues.push("unsupported_execution_claim");
  }

  return {
    content: nextContent,
    issues,
  };
}
