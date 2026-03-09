import { useState } from "react";
import type { GuardMode, TaskDetail } from "@klava/contracts";
import { Button, PanelCard, Stack, StatusPill, TextField } from "@klava/ui";

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
      <PanelCard title="Guard mode" subtitle="Strict blocks guarded commands. Balanced creates approvals. Off runs guarded commands directly.">
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

      <PanelCard title="Command" subtitle="Task-local terminal history stays attached to this task.">
        <div className="composer">
          <TextField
            value={command}
            onChange={setCommand}
            placeholder="pwd, dir, Get-ChildItem, git status, winget install ... "
          />
          <div className="composer__actions">
            <Button onClick={() => void handleRun()} disabled={busy || !command.trim()}>
              {busy ? "Working..." : "Run"}
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
                subtitle={new Date(entry.createdAt).toLocaleString()}
                actions={<StatusPill tone={entryTone(entry.status)} value={entry.status.replace("_", " ")} />}
              >
                <pre className="terminal-output">{entry.output}</pre>
              </PanelCard>
            ))}
        </Stack>
      </div>
    </div>
  );
}
