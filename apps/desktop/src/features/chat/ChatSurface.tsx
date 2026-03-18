import type { KeyboardEvent } from "react";
import { useMemo, useState } from "react";
import type { TaskDetail, TaskMessage } from "@klava/contracts";
import { Button, TextField } from "@klava/ui";
import { useAppI18n } from "../../i18n/AppI18n";

function shouldShowMessage(message: TaskMessage) {
  if (message.meta.presentation === "artifact" || message.meta.presentation === "status") {
    return false;
  }

  return message.role === "user" || message.role === "assistant";
}

function roleLabel(message: TaskMessage, t: (english: string, russian: string) => string) {
  return message.role === "assistant" ? "Klava" : t("You", "Вы");
}

function statusStateLabel(
  status: TaskMessage["meta"]["statusState"],
  t: (english: string, russian: string) => string,
) {
  switch (status) {
    case "running":
      return t("In progress", "В процессе");
    case "awaiting_approval":
      return t("Needs approval", "Нужно подтверждение");
    case "succeeded":
      return t("Done", "Готово");
    case "failed":
      return t("Attention", "Есть проблема");
    case "info":
    default:
      return t("Info", "Инфо");
  }
}

function agentRunStatusLabel(
  status: TaskDetail["agentRuns"][number]["status"],
  t: (english: string, russian: string) => string,
) {
  switch (status) {
    case "running":
      return t("Working", "Работает");
    case "awaiting_approval":
      return t("Waiting for approval", "Ждёт подтверждения");
    case "needs_input":
      return t("Ready to continue", "Готова продолжить");
    case "succeeded":
      return t("Done", "Готово");
    case "blocked":
      return t("Blocked", "Заблокировано");
    case "failed":
    default:
      return t("Failed", "Ошибка");
  }
}

function liveTone(
  activeAgentRun: TaskDetail["agentRuns"][number] | null,
  latestStatusMessage: TaskMessage | null,
): NonNullable<TaskMessage["meta"]["statusState"]> {
  if (latestStatusMessage?.meta.statusState) {
    return latestStatusMessage.meta.statusState;
  }

  if (!activeAgentRun) {
    return "info";
  }

  switch (activeAgentRun.status) {
    case "running":
      return "running";
    case "awaiting_approval":
      return "awaiting_approval";
    case "succeeded":
      return "succeeded";
    case "failed":
    case "blocked":
      return "failed";
    case "needs_input":
    default:
      return "info";
  }
}

export function ChatSurface({
  busy,
  onApprove,
  onReject,
  task,
  onSendMessage,
}: {
  busy: boolean;
  onApprove: (approvalId: string) => Promise<void>;
  onReject: (approvalId: string) => Promise<void>;
  task: TaskDetail;
  onSendMessage: (content: string) => Promise<void>;
}) {
  const { formatTime, t } = useAppI18n();
  const [value, setValue] = useState("");
  const approvalById = new Map(task.approvals.map((approval) => [approval.id, approval]));
  const visibleMessages = useMemo(
    () => task.messages.filter((message) => shouldShowMessage(message)),
    [task.messages],
  );
  const activeAgentRun = useMemo(
    () =>
      task.agentRuns.find(
        (run) => run.status === "running" || run.status === "awaiting_approval" || run.status === "needs_input",
      ) ?? null,
    [task.agentRuns],
  );
  const latestStatusMessage = useMemo(
    () => [...task.messages].reverse().find((message) => message.meta.presentation === "status") ?? null,
    [task.messages],
  );
  const liveApprovalId =
    latestStatusMessage?.meta.pendingApprovalId ??
    activeAgentRun?.pendingApprovalId ??
    task.journal.activeResume?.approvalId ??
    null;
  const liveApproval = liveApprovalId ? approvalById.get(liveApprovalId) ?? null : null;
  const liveStatusText =
    latestStatusMessage?.content ??
    activeAgentRun?.summary ??
    activeAgentRun?.lastAssistantMessage ??
    task.journal.activeResume?.reason ??
    null;
  const liveStatusTime = latestStatusMessage
    ? formatTime(latestStatusMessage.createdAt)
    : activeAgentRun
      ? formatTime(activeAgentRun.updatedAt)
      : task.journal.activeResume
        ? formatTime(task.journal.activeResume.updatedAt)
        : null;
  const liveStatusTone = liveTone(activeAgentRun, latestStatusMessage);
  const liveStatusLabel = latestStatusMessage?.meta.statusState
    ? statusStateLabel(latestStatusMessage.meta.statusState, t)
    : activeAgentRun
      ? agentRunStatusLabel(activeAgentRun.status, t)
      : task.journal.activeResume
        ? t("Resume available", "Можно продолжить")
        : null;

  async function handleSubmit() {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }

    await onSendMessage(trimmed);
    setValue("");
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    void handleSubmit();
  }

  return (
    <div className="surface-stack chat-surface">
      {liveStatusText ? (
        <div className={`live-status live-status--${liveStatusTone}`}>
          <div className="live-status__signal" aria-hidden="true" />
          <div className="live-status__body">
            <div className="live-status__text">{liveStatusText}</div>
            {liveApproval?.status === "pending" ? (
              <div className="approval-item__actions live-status__actions">
                <Button
                  variant="secondary"
                  onClick={() => void onReject(liveApproval.id)}
                  disabled={busy}
                  style={{ height: 28 }}
                >
                  {t("Reject", "Отклонить")}
                </Button>
                <Button onClick={() => void onApprove(liveApproval.id)} disabled={busy} style={{ height: 28 }}>
                  {t("Approve", "Подтвердить")}
                </Button>
              </div>
            ) : null}
          </div>
          <div className="live-status__meta">
            {liveStatusLabel ? <span className={`status-chip status-chip--${liveStatusTone}`}>{liveStatusLabel}</span> : null}
            {liveStatusTime ? <span className="live-status__time">{liveStatusTime}</span> : null}
          </div>
        </div>
      ) : null}

      <div className="transcript chat-transcript">
        <div className="chat-message-list">
          {visibleMessages.map((message) => (
            <article
              key={message.id}
              className={`chat-message chat-message--${message.role === "user" ? "user" : "assistant"}`}
            >
              <div className="chat-message__meta">
                <span className="chat-message__role">{roleLabel(message, t)}</span>
                <span className="chat-message__time">{formatTime(message.createdAt)}</span>
              </div>
              <div className="chat-message__bubble">
                <div className="message-content">{message.content}</div>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="chat-composer">
        <TextField
          multiline
          rows={3}
          placeholder={t(
            "Describe the result you want. Enter sends, Shift+Enter adds a new line.",
            "Опиши нужный результат. Enter отправляет, Shift+Enter делает новую строку.",
          )}
          value={value}
          onChange={setValue}
          onKeyDown={handleComposerKeyDown}
          style={{ minHeight: 88, resize: "none" }}
        />
        <div className="chat-composer__footer">
          <span className="chat-composer__hint">
            {t("Enter sends • Shift+Enter newline", "Enter отправляет • Shift+Enter новая строка")}
          </span>
          <div className="composer__actions">
            <Button variant="secondary" onClick={() => setValue("")} disabled={busy || value.length === 0}>
              {t("Clear", "Очистить")}
            </Button>
            <Button onClick={() => void handleSubmit()} disabled={busy || !value.trim()}>
              {busy ? t("Working...", "Работаю...") : t("Send", "Отправить")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
