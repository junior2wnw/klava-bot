import type { TaskSummary } from "@klava/contracts";
import { PanelCard, StatusPill, tokens } from "@klava/ui";
import { useAppI18n } from "../../i18n/AppI18n";
import { getGuardModeLabel } from "../security/guardModeLabels";

function taskTone(status: TaskSummary["status"]) {
  switch (status) {
    case "succeeded":
      return "success";
    case "failed":
      return "danger";
    case "awaiting_approval":
      return "warning";
    case "running":
      return "accent";
    default:
      return "neutral";
  }
}

export function TaskSummaryCard({
  selected,
  task,
}: {
  selected: boolean;
  task: TaskSummary;
}) {
  const { t } = useAppI18n();
  const statusLabel =
    task.status === "awaiting_approval"
      ? t("awaiting approval", "нужно подтверждение")
      : task.status === "running"
        ? t("running", "в работе")
        : task.status === "succeeded"
          ? t("succeeded", "завершена")
          : task.status === "failed"
            ? t("failed", "ошибка")
            : t("idle", "ожидает");
  return (
    <PanelCard
      title={task.title}
      subtitle={task.lastMessagePreview ?? t("No conversation yet", "Сообщений пока нет")}
      actions={<StatusPill tone={taskTone(task.status)} value={statusLabel} />}
      style={{
        background: selected ? tokens.color.accentSoft : tokens.color.surface,
        borderColor: selected ? "rgba(196, 112, 74, 0.20)" : tokens.color.border,
      }}
    >
      <div className="task-card__meta">
        <span>{t("Guard", "Защита")}: {getGuardModeLabel(task.guardMode, t)}</span>
        <span>
          {task.pendingApprovalCount} {t("pending approvals", "ожидающих подтверждений")}
        </span>
      </div>
    </PanelCard>
  );
}
