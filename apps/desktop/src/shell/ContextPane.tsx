import type { HealthResponse, TaskDetail } from "@klava/contracts";
import { PanelCard, ShellRegion, Stack, StatusPill } from "@klava/ui";
import type { PropsWithChildren } from "react";
import { useAppI18n } from "../i18n/AppI18n";
import { ApprovalQueue } from "../features/security/ApprovalQueue";
import { getGuardModeLabel } from "../features/security/guardModeLabels";

export function ContextPane({
  children,
  health,
  task,
  onApprove,
  onReject,
}: PropsWithChildren<{
  health: HealthResponse | null;
  task: TaskDetail | null;
  onApprove: (approvalId: string) => void;
  onReject: (approvalId: string) => void;
}>) {
  const { t } = useAppI18n();
  const statusLabel =
    task?.status === "awaiting_approval"
      ? t("awaiting approval", "нужно подтверждение")
      : task?.status === "running"
        ? t("running", "в работе")
        : task?.status === "succeeded"
          ? t("succeeded", "завершена")
          : task?.status === "failed"
            ? t("failed", "ошибка")
            : t("idle", "ожидает");
  return (
    <ShellRegion title={t("Context Pane", "Контекст задачи")}>
      <Stack gap={12}>
        {task ? (
          <PanelCard
            title={t("Task state", "Состояние задачи")}
            subtitle={`${t("Guard mode", "Режим защиты команд")}: ${getGuardModeLabel(task.guardMode, t, { includeKeyword: true })}`}
          >
            <div className="detail-line">
              <span>{t("Status", "Статус")}</span>
              <StatusPill
                tone={task.status === "failed" ? "danger" : task.status === "succeeded" ? "success" : "accent"}
                value={statusLabel}
              />
            </div>
            <div className="detail-line">
              <span>{t("Messages", "Сообщения")}</span>
              <strong>{task.messages.length}</strong>
            </div>
            <div className="detail-line">
              <span>{t("Terminal runs", "Запуски терминала")}</span>
              <strong>{task.terminalEntries.length}</strong>
            </div>
            <div className="detail-line">
              <span>{t("Operations", "Операции")}</span>
              <strong>{task.operations.length}</strong>
            </div>
          </PanelCard>
        ) : null}

        {task ? <ApprovalQueue approvals={task.approvals} onApprove={onApprove} onReject={onReject} /> : null}

        {children}

        {health ? (
          <PanelCard
            title={t("Local service", "Локальная служба")}
            subtitle={health.providerConfigured ? t("Provider connected", "Провайдер подключён") : t("Setup required", "Нужна настройка")}
          >
            <div className="detail-line">
              <span>{t("Version", "Версия")}</span>
              <strong>{health.runtimeVersion}</strong>
            </div>
            <div className="detail-line">
              <span>{t("Storage", "Хранилище")}</span>
              <span className="detail-line__value">{health.storagePath}</span>
            </div>
          </PanelCard>
        ) : null}
      </Stack>
    </ShellRegion>
  );
}
