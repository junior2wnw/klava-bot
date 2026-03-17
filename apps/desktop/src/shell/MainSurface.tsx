import type { CreateOperationRequest, GuardMode, SurfaceMode, TaskDetail } from "@klava/contracts";
import { Button, ShellRegion } from "@klava/ui";
import { ChatSurface } from "../features/chat/ChatSurface";
import { ProSurface } from "../features/pro/ProSurface";
import { TerminalSurface } from "../features/terminal/TerminalSurface";
import { useAppI18n } from "../i18n/AppI18n";

export function MainSurface({
  busy,
  surfaceMode,
  task,
  onApprove,
  onChangeSurface,
  onReject,
  onRunTerminal,
  onSendMessage,
  onSetGuardMode,
  onCreateOperation,
  onAdvanceOperation,
  onContinueAgent,
}: {
  busy: boolean;
  onApprove: (approvalId: string) => Promise<void>;
  surfaceMode: SurfaceMode;
  task: TaskDetail | null;
  onChangeSurface: (mode: SurfaceMode) => void;
  onReject: (approvalId: string) => Promise<void>;
  onSendMessage: (content: string) => Promise<void>;
  onRunTerminal: (command: string) => Promise<void>;
  onSetGuardMode: (mode: GuardMode) => Promise<void>;
  onCreateOperation: (payload: CreateOperationRequest) => Promise<void>;
  onAdvanceOperation: (operationId: string) => Promise<void>;
  onContinueAgent: (agentRunId: string) => Promise<void>;
}) {
  const { t } = useAppI18n();
  const surfaceOptions: Array<{ id: SurfaceMode; label: string }> = [
    { id: "chat", label: t("Chat", "Чат") },
    { id: "terminal", label: t("Terminal", "Терминал") },
    { id: "pro", label: "Pro" },
  ];

  return (
    <ShellRegion
      title={task?.title ?? t("Main Surface", "Основная панель")}
      actions={
        <div className="surface-tabs">
          {surfaceOptions.map((option) => (
            <Button
              key={option.id}
              variant={option.id === surfaceMode ? "primary" : "ghost"}
              onClick={() => onChangeSurface(option.id)}
              style={{ height: 34 }}
            >
              {option.label}
            </Button>
          ))}
        </div>
      }
    >
      {!task ? (
        <div className="empty-state">{t("No task selected.", "Задача не выбрана.")}</div>
      ) : surfaceMode === "terminal" ? (
        <TerminalSurface busy={busy} task={task} onRunCommand={onRunTerminal} onSetGuardMode={onSetGuardMode} />
      ) : surfaceMode === "pro" ? (
        <ProSurface
          busy={busy}
          task={task}
          onCreateOperation={onCreateOperation}
          onAdvanceOperation={onAdvanceOperation}
          onContinueAgent={onContinueAgent}
        />
      ) : (
        <ChatSurface busy={busy} task={task} onSendMessage={onSendMessage} onApprove={onApprove} onReject={onReject} />
      )}
    </ShellRegion>
  );
}
