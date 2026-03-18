import assert from "node:assert/strict";
import test from "node:test";
import type { TaskMessage } from "@klava/contracts";
import { createTaskTemplate } from "./storage";
import { buildTaskMemoryPrompt, deriveTaskMemory } from "./task-memory";

function message(role: TaskMessage["role"], taskId: string, content: string): TaskMessage {
  return {
    id: crypto.randomUUID(),
    taskId,
    role,
    content,
    createdAt: "2026-03-18T00:00:00.000Z",
    meta: {},
  };
}

test("deriveTaskMemory extracts goals, preferences, constraints, and open loops", () => {
  const task = createTaskTemplate("Memory task", "ru");
  task.guardMode = "strict";
  task.messages.push(
    message("user", task.id, "Отвечай по-русски и без дешёвых упрощений."),
    message("assistant", task.id, "Хорошо, буду отвечать по-русски и держать высокий уровень качества."),
    message("user", task.id, "Сделай persistent memory и verifier layer."),
  );
  task.approvals.push({
    id: crypto.randomUUID(),
    taskId: task.id,
    action: "Guarded terminal command",
    command: "winget install example-package",
    riskClass: "guarded",
    impact: "This changes the local machine state.",
    requiresAdmin: false,
    status: "pending",
    createdAt: "2026-03-18T00:00:00.000Z",
    resolvedAt: null,
    rollbackHint: "Uninstall the package if needed.",
    meta: {},
  });

  const memory = deriveTaskMemory(task);
  const kinds = new Set(memory.entries.map((entry) => entry.kind));

  assert.ok(memory.summary);
  assert.equal(kinds.has("goal"), true);
  assert.equal(kinds.has("preference"), true);
  assert.equal(kinds.has("constraint"), true);
  assert.equal(kinds.has("open_loop"), true);
  assert.match(buildTaskMemoryPrompt(memory, "ru") ?? "", /Долговременная память задачи/i);
});
