import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createExecutionJournal, createJournalEvent } from "./execution-journal";
import { retrieveTaskContext } from "./semantic-retrieval";
import { createTaskTemplate } from "./storage";
import { deriveTaskMemory } from "./task-memory";

test("semantic retrieval ranks journal and workspace evidence together", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "klava-retrieval-"));

  try {
    await writeFile(
      path.join(tempRoot, "resume-playbook.md"),
      [
        "# Restart-safe resume",
        "Execution journal checkpoints are used to recover an interrupted agent run after a runtime restart.",
        "Resume uses the saved tool history and checkpoint timeline.",
      ].join("\n"),
      "utf8",
    );

    const task = createTaskTemplate("Semantic retrieval");
    task.messages.push(
      {
        id: crypto.randomUUID(),
        taskId: task.id,
        role: "user",
        content: "Make restart-safe resume reliable and keep the execution journal accurate.",
        createdAt: "2026-03-18T00:00:00.000Z",
        meta: {},
      },
      {
        id: crypto.randomUUID(),
        taskId: task.id,
        role: "assistant",
        content: "I will preserve the execution timeline and keep resume checkpoints durable.",
        createdAt: "2026-03-18T00:01:00.000Z",
        meta: {},
      },
    );
    task.memory = deriveTaskMemory(task);
    task.journal = createExecutionJournal();
    task.journal.events.push(
      createJournalEvent(task.id, {
        scope: "runtime",
        kind: "runtime.recovered",
        title: "Recovered interrupted execution state after runtime restart",
        detail: "1 agent run moved to a resumable state from saved checkpoints.",
        level: "warning",
        taskStatus: "idle",
      }),
    );

    const bundle = await retrieveTaskContext(task, "restart-safe resume execution journal", tempRoot, undefined, {
      maxHits: 6,
      includeWorkspace: true,
      maxWorkspaceFileHits: 3,
    });

    assert.equal(bundle.usedWorkspace, true);
    assert.equal(bundle.hits.some((hit) => hit.source === "journal"), true);
    assert.equal(bundle.hits.some((hit) => hit.source === "workspace_file"), true);
    assert.match(bundle.hits.map((hit) => hit.excerpt).join("\n"), /checkpoint|resume/i);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
