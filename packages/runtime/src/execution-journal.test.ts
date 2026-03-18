import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { AgentRun, TaskDetail } from "@klava/contracts";
import { RuntimeStore, type AppPaths, createTaskTemplate } from "./storage";

async function withTempAppPaths(run: (paths: AppPaths) => Promise<void>) {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "klava-journal-test-"));
  const paths: AppPaths = {
    rootDir: tempRoot,
    statePath: path.join(tempRoot, "state.json"),
    secretsPath: path.join(tempRoot, "secrets.json"),
    keyPath: path.join(tempRoot, "vault.key"),
  };

  try {
    await run(paths);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

function runningAgentRun(task: TaskDetail): AgentRun {
  const timestamp = "2026-03-18T00:10:00.000Z";
  return {
    id: crypto.randomUUID(),
    taskId: task.id,
    title: "Recover me",
    goal: "Inspect the repo and continue after restart.",
    status: "running",
    provider: null,
    model: null,
    autoResume: true,
    maxIterations: 8,
    iteration: 3,
    startedAt: timestamp,
    updatedAt: timestamp,
    finishedAt: null,
    pendingApprovalId: null,
    lastAssistantMessage: null,
    summary: "The agent was mid-run before the runtime stopped.",
    plan: [],
    toolCalls: [],
  };
}

test("runtime store recovers interrupted agent runs into resumable journal state", async () => {
  await withTempAppPaths(async (paths) => {
    const task = createTaskTemplate("Restart recovery");
    task.status = "running";
    task.agentRuns.unshift(runningAgentRun(task));

    await mkdir(paths.rootDir, { recursive: true });
    await writeFile(
      paths.statePath,
      JSON.stringify(
        {
          selectedTaskId: task.id,
          tasks: [task],
        },
        null,
        2,
      ),
      "utf8",
    );

    const store = new RuntimeStore(paths);
    await store.init();
    const recoveredTask = store.getTask(task.id);

    assert.ok(recoveredTask);
    assert.equal(recoveredTask?.agentRuns[0]?.status, "needs_input");
    assert.equal(recoveredTask?.journal.activeResume?.mode, "continue_agent");
    assert.equal(
      recoveredTask?.journal.events.some((event) => event.kind === "runtime.recovered"),
      true,
    );
  });
});
