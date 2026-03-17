import { useMemo, useState } from "react";
import type { TaskDetail, TaskMessage } from "@klava/contracts";
import { Button, PanelCard, Stack, TextField } from "@klava/ui";
import { useAppI18n } from "../../i18n/AppI18n";

function shouldShowMessage(message: TaskMessage) {
  if (message.meta.presentation === "artifact") {
    return false;
  }

  if (message.role === "tool") {
    return message.meta.presentation === "status";
  }

  if (message.role === "system") {
    return message.meta.presentation === "status";
  }

  return true;
}

function roleLabel(message: TaskMessage, t: (english: string, russian: string) => string) {
  if (message.meta.presentation === "status") {
    return t("Status", "Статус");
  }

  return message.role === "assistant"
    ? "Klava"
    : message.role === "user"
      ? t("You", "Вы")
      : message.role === "tool"
        ? t("Tool", "Инструмент")
        : t("System", "Система");
}

function statusStateLabel(
  status: TaskMessage["meta"]["statusState"],
  t: (english: string, russian: string) => string,
) {
  switch (status) {
    case "running":
      return t("In progress", "В процессе");
    case "awaiting_approval":
      return t("Needs approval", "Ждёт подтверждения");
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
      return t("Needs input", "Нужен ответ");
    case "succeeded":
      return t("Done", "Готово");
    case "blocked":
      return t("Blocked", "Заблокировано");
    case "failed":
    default:
      return t("Failed", "Ошибка");
  }
}

function planItemStatusLabel(
  status: TaskDetail["agentRuns"][number]["plan"][number]["status"],
  t: (english: string, russian: string) => string,
) {
  switch (status) {
    case "running":
      return t("In progress", "В процессе");
    case "completed":
      return t("Done", "Готово");
    case "failed":
      return t("Failed", "Ошибка");
    case "blocked":
      return t("Blocked", "Заблокировано");
    case "pending":
    default:
      return t("Queued", "В очереди");
  }
}

function planItemTone(status: TaskDetail["agentRuns"][number]["plan"][number]["status"]) {
  if (status === "running") {
    return "running";
  }

  if (status === "completed") {
    return "succeeded";
  }

  if (status === "failed" || status === "blocked") {
    return "failed";
  }

  return "info";
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
    () => [...visibleMessages].reverse().find((message) => message.meta.presentation === "status") ?? null,
    [visibleMessages],
  );

  async function handleSubmit() {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }

    await onSendMessage(trimmed);
    setValue("");
  }

  return (
    <div className="surface-stack">
      {activeAgentRun || latestStatusMessage ? (
        <PanelCard
          title={t("Current activity", "Что сейчас делает Клава")}
          subtitle={
            activeAgentRun
              ? `${agentRunStatusLabel(activeAgentRun.status, t)}${activeAgentRun.model ? ` • ${activeAgentRun.model}` : ""}`
              : t("Recent runtime status", "Последний статус выполнения")
          }
        >
          <div className="activity-card">
            {latestStatusMessage ? <div className="activity-card__summary">{latestStatusMessage.content}</div> : null}
            {latestStatusMessage?.meta.statusState ? (
              <div className="onboarding-status">
                <span className={`status-chip status-chip--${latestStatusMessage.meta.statusState}`}>
                  {statusStateLabel(latestStatusMessage.meta.statusState, t)}
                </span>
              </div>
            ) : null}
            {activeAgentRun?.plan.length ? (
              <div className="activity-plan">
                {activeAgentRun.plan.map((item) => (
                  <div key={item.id} className="activity-plan__item">
                    <span className={`status-chip status-chip--${planItemTone(item.status)}`}>
                      {planItemStatusLabel(item.status, t)}
                    </span>
                    <div className="activity-plan__copy">
                      <strong>{item.title}</strong>
                      {item.detail ? <span>{item.detail}</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </PanelCard>
      ) : null}

      <div className="transcript">
        <Stack gap={12}>
          {visibleMessages.map((message) => {
            const approval = message.meta.pendingApprovalId ? approvalById.get(message.meta.pendingApprovalId) : null;
            return (
              <PanelCard
                key={message.id}
                title={roleLabel(message, t)}
                subtitle={formatTime(message.createdAt)}
                style={{
                  background:
                    message.meta.presentation === "status"
                      ? "rgba(255, 245, 235, 0.03)"
                      : message.role === "user"
                        ? "rgba(196, 112, 74, 0.04)"
                        : undefined,
                  borderColor:
                    message.meta.presentation === "status"
                      ? "rgba(255, 245, 235, 0.06)"
                      : message.role === "assistant"
                        ? "rgba(196, 112, 74, 0.10)"
                        : undefined,
                }}
              >
                {message.meta.statusState ? (
                  <div className="message-status-row">
                    <span className={`status-chip status-chip--${message.meta.statusState}`}>
                      {statusStateLabel(message.meta.statusState, t)}
                    </span>
                  </div>
                ) : null}
                <div className={`message-content${message.meta.presentation === "status" ? " message-content--status" : ""}`}>
                  {message.content}
                </div>
                {message.meta.pendingApprovalId ? (
                  <div className="message-approval">
                    <span className="message-tag">
                      {approval?.status === "pending"
                        ? t("Approval pending", "Ожидает подтверждения")
                        : approval?.status === "approved"
                          ? t("Approved", "Подтверждено")
                          : t("Rejected", "Отклонено")}
                    </span>
                    {approval?.status === "pending" ? (
                      <div className="approval-item__actions">
                        <Button
                          variant="secondary"
                          onClick={() => void onReject(message.meta.pendingApprovalId!)}
                          disabled={busy}
                          style={{ height: 30 }}
                        >
                          {t("Reject", "Отклонить")}
                        </Button>
                        <Button
                          onClick={() => void onApprove(message.meta.pendingApprovalId!)}
                          disabled={busy}
                          style={{ height: 30 }}
                        >
                          {t("Approve", "Подтвердить")}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </PanelCard>
            );
          })}
        </Stack>
      </div>

      <PanelCard
        title={t("Composer", "Сообщение")}
        subtitle={t(
          "Persistent agent chat, translation, model switching, natural language computer tasks, /terminal, $ command, /models, /model, or guard strict|balanced|off",
          "Постоянный чат с агентом, переводы, смена модели, команды компьютеру обычным языком, /terminal, $ команда, /models, /model и guard strict|balanced|off",
        )}
      >
        <div className="composer">
          <TextField
            multiline
            rows={4}
            placeholder={t(
              "Give Klava a real machine goal. It can inspect the computer, read or search files, run commands behind guard checks, switch models, and explain each current step.",
              "Опишите реальную задачу для компьютера. Klava умеет проверять систему, читать и искать по файлам, запускать команды через guard и по ходу объяснять, что делает прямо сейчас.",
            )}
            value={value}
            onChange={setValue}
          />
          <div className="composer__actions">
            <Button variant="secondary" onClick={() => setValue("")} disabled={busy}>
              {t("Clear", "Очистить")}
            </Button>
            <Button onClick={() => void handleSubmit()} disabled={busy || !value.trim()}>
              {busy ? t("Working...", "Работаю...") : t("Send", "Отправить")}
            </Button>
          </div>
        </div>
      </PanelCard>
    </div>
  );
}
