import { useState } from "react";
import type { TaskDetail } from "@klava/contracts";
import { Button, PanelCard, Stack, TextField } from "@klava/ui";

function roleLabel(role: TaskDetail["messages"][number]["role"]) {
  return role === "assistant" ? "Klava" : role === "user" ? "You" : role === "tool" ? "Tool" : "System";
}

export function ChatSurface({
  busy,
  task,
  onSendMessage,
}: {
  busy: boolean;
  task: TaskDetail;
  onSendMessage: (content: string) => Promise<void>;
}) {
  const [value, setValue] = useState("");

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
      <div className="transcript">
        <Stack gap={12}>
          {task.messages.map((message) => (
            <PanelCard
              key={message.id}
              title={roleLabel(message.role)}
              subtitle={new Date(message.createdAt).toLocaleTimeString()}
              style={{
                background: message.role === "user" ? "#f0fbfa" : undefined,
                borderColor: message.role === "assistant" ? "#cce7e4" : undefined,
              }}
            >
              <div className="message-content">{message.content}</div>
              {message.meta.pendingApprovalId ? (
                <span className="message-tag">Approval pending in Context Pane</span>
              ) : null}
            </PanelCard>
          ))}
        </Stack>
      </div>

      <PanelCard title="Composer" subtitle="Natural language, /terminal, $ command, or guard strict|balanced|off">
        <div className="composer">
          <TextField
            multiline
            rows={4}
            placeholder="Ask Klava to research, plan, write, inspect files, or run a guarded local command."
            value={value}
            onChange={setValue}
          />
          <div className="composer__actions">
            <Button variant="secondary" onClick={() => setValue("")} disabled={busy}>
              Clear
            </Button>
            <Button onClick={() => void handleSubmit()} disabled={busy || !value.trim()}>
              {busy ? "Working..." : "Send"}
            </Button>
          </div>
        </div>
      </PanelCard>
    </div>
  );
}
