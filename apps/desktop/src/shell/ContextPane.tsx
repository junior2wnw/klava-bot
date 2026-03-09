import type { ApprovalRequest, HealthResponse, ProviderSettings, TaskDetail } from "@klava/contracts";
import { PanelCard, ShellRegion, Stack, StatusPill } from "@klava/ui";
import type { PropsWithChildren } from "react";
import { ApprovalQueue } from "../features/security/ApprovalQueue";

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
  return (
    <ShellRegion title="Context Pane">
      <Stack gap={12}>
        {task ? (
          <PanelCard title="Task state" subtitle={`Guard ${task.guardMode}`}>
            <div className="detail-line">
              <span>Status</span>
              <StatusPill
                tone={task.status === "failed" ? "danger" : task.status === "succeeded" ? "success" : "accent"}
                value={task.status.replace("_", " ")}
              />
            </div>
            <div className="detail-line">
              <span>Messages</span>
              <strong>{task.messages.length}</strong>
            </div>
            <div className="detail-line">
              <span>Terminal runs</span>
              <strong>{task.terminalEntries.length}</strong>
            </div>
          </PanelCard>
        ) : null}

        {task ? <ApprovalQueue approvals={task.approvals} onApprove={onApprove} onReject={onReject} /> : null}

        {children}

        {health ? (
          <PanelCard title="Runtime" subtitle={health.providerConfigured ? "Provider connected" : "Needs onboarding"}>
            <div className="detail-line">
              <span>Version</span>
              <strong>{health.runtimeVersion}</strong>
            </div>
            <div className="detail-line">
              <span>Storage</span>
              <span className="detail-line__value">{health.storagePath}</span>
            </div>
          </PanelCard>
        ) : null}
      </Stack>
    </ShellRegion>
  );
}
