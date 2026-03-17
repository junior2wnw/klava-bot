import { useState } from "react";
import type { GuardMode, TaskDetail } from "@klava/contracts";
import { Button, PanelCard, Stack, StatusPill, TextField } from "@klava/ui";
import { useAppI18n } from "../../i18n/AppI18n";

const guardModes: GuardMode[] = ["strict", "balanced", "off"];

function entryTone(status: TaskDetail["terminalEntries"][number]["status"]) {
  return status === "completed"
    ? "success"
    : status === "failed" || status === "blocked"
      ? "danger"
      : "warning";
}

export function TerminalSurface({
  busy,
  task,
  onRunCommand,
  onSetGuardMode,
}: {
  busy: boolean;
  task: TaskDetail;
  onRunCommand: (command: string) => Promise<void>;
  onSetGuardMode: (mode: GuardMode) => Promise<void>;
}) {
  const { formatDateTime, t } = useAppI18n();
  const [command, setCommand] = useState("");

  async function handleRun() {
    const trimmed = command.trim();
    if (!trimmed) {
      return;
    }

    await onRunCommand(trimmed);
    setCommand("");
  }

  return (
    <div className="surface-stack">
      <PanelCard title={t("Guard mode", "Режим защиты")} subtitle={t("Strict blocks guarded commands. Balanced creates approvals. Off runs guarded commands directly.", "Strict блокирует защищённые команды. Balanced создаёт подтверждения. Off запускает защищённые команды сразу.")}>
        <div className="guard-actions">
          {guardModes.map((mode) => (
            <Button
              key={mode}
              variant={task.guardMode === mode ? "primary" : "secondary"}
              onClick={() => void onSetGuardMode(mode)}
              disabled={busy}
              style={{ height: 34 }}
            >
              {mode}
            </Button>
          ))}
        </div>
      </PanelCard>

      <PanelCard title={t("Command", "Команда")} subtitle={t("Task-local terminal history stays attached to this task.", "Локальная история терминала хранится внутри этой задачи.")}>
        <div className="composer">
          <TextField
            value={command}
            onChange={setCommand}
            placeholder={t("pwd, dir, Get-ChildItem, git status, winget install ... ", "pwd, dir, Get-ChildItem, git status, winget install ... ")}
          />
          <div className="composer__actions">
            <Button onClick={() => void handleRun()} disabled={busy || !command.trim()}>
              {busy ? t("Working...", "Работаю...") : t("Run", "Запустить")}
            </Button>
          </div>
        </div>
      </PanelCard>

      <div className="terminal-log">
        <Stack gap={12}>
          {task.terminalEntries
            .slice()
            .reverse()
            .map((entry) => (
              <PanelCard
                key={entry.id}
                title={<code>{entry.command}</code>}
                subtitle={formatDateTime(entry.createdAt)}
                actions={
                  <StatusPill
                    tone={entryTone(entry.status)}
                    value={
                      entry.status === "completed"
                        ? t("completed", "завершено")
                        : entry.status === "failed"
                          ? t("failed", "ошибка")
                          : entry.status === "blocked"
                            ? t("blocked", "заблокировано")
                            : t("pending approval", "ждёт подтверждения")
                    }
                  />
                }
              >
                <pre className="terminal-output">{entry.output}</pre>
              </PanelCard>
            ))}
        </Stack>
      </div>
    </div>
  );
}
