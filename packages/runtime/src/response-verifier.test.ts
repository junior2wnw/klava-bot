import assert from "node:assert/strict";
import test from "node:test";
import type { TaskDetail } from "@klava/contracts";
import { createTaskTemplate } from "./storage";
import { verifyAssistantResponse } from "./response-verifier";

function baseTask() {
  return createTaskTemplate("Verifier task", "en");
}

test("verifyAssistantResponse softens unsupported execution claims without evidence", () => {
  const task = baseTask();
  const verified = verifyAssistantResponse(task, "I checked package.json. The package name is @klava/runtime.", "en");

  assert.deepEqual(verified.issues, ["unsupported_execution_claim"]);
  assert.match(verified.content, /do not have a verified local execution result/i);
  assert.doesNotMatch(verified.content, /^I checked package\.json/i);
});

test("verifyAssistantResponse keeps execution claims when the task has evidence", () => {
  const task = baseTask();
  task.terminalEntries.push({
    id: crypto.randomUUID(),
    taskId: task.id,
    command: "type package.json",
    output: "{ \"name\": \"@klava/runtime\" }",
    exitCode: 0,
    status: "completed",
    createdAt: "2026-03-18T00:00:00.000Z",
  });

  const verified = verifyAssistantResponse(task, "I checked package.json. The package name is @klava/runtime.", "en");

  assert.deepEqual(verified.issues, []);
  assert.equal(verified.content, "I checked package.json. The package name is @klava/runtime.");
});
