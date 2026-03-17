import type { TaskSummary } from "@klava/contracts";
import { Button, ShellRegion, Stack } from "@klava/ui";
import { useAppI18n } from "../i18n/AppI18n";
import { TaskSummaryCard } from "../features/tasks/TaskSummaryCard";

export function TaskRail({
  busy,
  selectedTaskId,
  tasks,
  onCreateTask,
  onSelectTask,
}: {
  busy: boolean;
  selectedTaskId: string | null;
  tasks: TaskSummary[];
  onCreateTask: () => void;
  onSelectTask: (taskId: string) => void;
}) {
  const { t } = useAppI18n();
  return (
    <ShellRegion
      title={t("Task Rail", "Список задач")}
      actions={
        <Button onClick={onCreateTask} disabled={busy} style={{ height: 36 }}>
          {t("New task", "Новая задача")}
        </Button>
      }
    >
      <Stack gap={12}>
        {tasks.map((task) => {
          const selected = task.id === selectedTaskId;
          return (
            <button
              key={task.id}
              className={selected ? "task-card task-card--active" : "task-card"}
              onClick={() => onSelectTask(task.id)}
              type="button"
            >
              <TaskSummaryCard selected={selected} task={task} />
            </button>
          );
        })}
      </Stack>
    </ShellRegion>
  );
}
