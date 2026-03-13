import { useState } from "react";
import type { TaskDetail } from "@klava/contracts";
import { Button, PanelCard, Stack, TextField } from "@klava/ui";

function roleLabel(role: TaskDetail["messages"][number]["role"]) {
  return role === "assistant" ? "Klava" : role === "user" ? "You" : role === "tool" ? "Tool" : "System";
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
  const [value, setValue] = useState("");
  const approvalById = new Map(task.approvals.map((approval) => [approval.id, approval]));

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
                background: message.role === "user" ? "rgba(196, 112, 74, 0.04)" : undefined,
                borderColor: message.role === "assistant" ? "rgba(196, 112, 74, 0.10)" : undefined,
              }}
            >
              <div className="message-content">{message.content}</div>
              {message.meta.pendingApprovalId ? (
                <div className="message-approval">
                  <span className="message-tag">
                    {approvalById.get(message.meta.pendingApprovalId)?.status === "pending"
                      ? "Approval pending"
                      : approvalById.get(message.meta.pendingApprovalId)?.status === "approved"
                        ? "Approved"
                        : "Rejected"}
                  </span>
                  {approvalById.get(message.meta.pendingApprovalId)?.status === "pending" ? (
                    <div className="approval-item__actions">
                      <Button
                        variant="secondary"
                        onClick={() => void onReject(message.meta.pendingApprovalId!)}
                        disabled={busy}
                        style={{ height: 30 }}
                      >
                        Reject
                      </Button>
                      <Button
                        onClick={() => void onApprove(message.meta.pendingApprovalId!)}
                        disabled={busy}
                        style={{ height: 30 }}
                      >
                        Approve
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </PanelCard>
          ))}
        </Stack>
      </div>

      <PanelCard
        title="Composer"
        subtitle="Persistent agent chat, natural language computer tasks, /terminal, $ command, or guard strict|balanced|off"
      >
        <div className="composer">
          <TextField
            multiline
            rows={4}
            placeholder="Give Klava a real machine goal. It can inspect the computer, read/search files, run shell commands, pause on approval, and continue iterating toward the result."
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
