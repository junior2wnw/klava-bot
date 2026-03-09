import type { TaskSummary } from "@klava/contracts";
import { PanelCard, StatusPill, tokens } from "@klava/ui";

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
  return (
    <PanelCard
      title={task.title}
      subtitle={task.lastMessagePreview ?? "No conversation yet"}
      actions={<StatusPill tone={taskTone(task.status)} value={task.status.replace("_", " ")} />}
      style={{
        background: selected ? "#fffdf7" : tokens.color.surface,
        borderColor: selected ? tokens.color.accent : tokens.color.border,
        boxShadow: selected ? "0 18px 38px rgba(15, 118, 110, 0.12)" : tokens.shadow.panel,
      }}
    >
      <div className="task-card__meta">
        <span>Guard {task.guardMode}</span>
        <span>{task.pendingApprovalCount} pending approvals</span>
      </div>
    </PanelCard>
  );
}
