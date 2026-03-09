import type { GuardMode, SurfaceMode, TaskDetail } from "@klava/contracts";
import { Button, ShellRegion } from "@klava/ui";
import { ChatSurface } from "../features/chat/ChatSurface";
import { TerminalSurface } from "../features/terminal/TerminalSurface";

const surfaceOptions: Array<{ id: SurfaceMode; label: string }> = [
  { id: "chat", label: "Chat" },
  { id: "terminal", label: "Terminal" },
  { id: "pro", label: "Pro" },
];

export function MainSurface({
  busy,
  surfaceMode,
  task,
  onChangeSurface,
  onRunTerminal,
  onSendMessage,
  onSetGuardMode,
}: {
  busy: boolean;
  surfaceMode: SurfaceMode;
  task: TaskDetail | null;
  onChangeSurface: (mode: SurfaceMode) => void;
  onSendMessage: (content: string) => Promise<void>;
  onRunTerminal: (command: string) => Promise<void>;
  onSetGuardMode: (mode: GuardMode) => Promise<void>;
}) {
  return (
    <ShellRegion
      title={task?.title ?? "Main Surface"}
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
        <div className="empty-state">No task selected.</div>
      ) : surfaceMode === "terminal" ? (
        <TerminalSurface busy={busy} task={task} onRunCommand={onRunTerminal} onSetGuardMode={onSetGuardMode} />
      ) : surfaceMode === "pro" ? (
        <div className="empty-state">`Pro` surface is reserved for future optional modules.</div>
      ) : (
        <ChatSurface busy={busy} task={task} onSendMessage={onSendMessage} />
      )}
    </ShellRegion>
  );
}
