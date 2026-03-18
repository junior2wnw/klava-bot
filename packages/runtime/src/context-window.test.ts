import assert from "node:assert/strict";
import test from "node:test";
import type { TaskMessage } from "@klava/contracts";
import { buildConversationMemorySummary, compactConversationMessages } from "./context-window";

function message(role: TaskMessage["role"], content: string): TaskMessage {
  return {
    id: crypto.randomUUID(),
    taskId: "task-1",
    role,
    content,
    createdAt: "2026-03-18T00:00:00.000Z",
    meta: {},
  };
}

test("buildConversationMemorySummary keeps the important arc of older messages", () => {
  const summary = buildConversationMemorySummary([
    message("user", "We are building a desktop AI operator and the top priority is robust context compression."),
    message("assistant", "Understood. I will keep the architecture modular and provider-agnostic."),
    message("user", "Also make sure greetings do not trigger agent planning noise."),
    message("assistant", "I will add a conversational fast path and preserve the user's language."),
  ]);

  assert.ok(summary);
  assert.match(summary ?? "", /context compression/i);
  assert.match(summary ?? "", /greetings do not trigger agent planning noise/i);
});

test("compactConversationMessages adds a memory summary and keeps the newest messages verbatim", () => {
  const transcript = [
    message("user", "Initial goal: make the runtime reliable on long conversations."),
    message("assistant", "I will improve the memory layer."),
    message("user", "Keep the system prompt strict about language alignment."),
    message("assistant", "I will make the latest user message the strongest language signal."),
    message("user", "Add automatic context compression."),
    message("assistant", "I will build a compact summary of earlier dialogue."),
    message("user", "Preserve the newest execution details exactly."),
    message("assistant", "I will keep the newest messages verbatim."),
  ];

  const compacted = compactConversationMessages("task-1", transcript, {
    maxChars: 420,
    maxMessages: 5,
    preserveRecentMessages: 3,
    maxSummaryChars: 180,
  });

  assert.equal(compacted.compacted, true);
  assert.equal(compacted.messages.filter((item) => item.role === "system").length, 1);
  assert.match(compacted.messages[0]?.content ?? "", /Compressed memory of earlier conversation/i);
  assert.equal(compacted.messages.at(-1)?.content, "I will keep the newest messages verbatim.");
  assert.ok(compacted.compactedChars < compacted.originalChars);
});

test("compactConversationMessages leaves short transcripts untouched", () => {
  const transcript = [
    message("user", "hello"),
    message("assistant", "Hi!"),
  ];

  const compacted = compactConversationMessages("task-1", transcript, {
    maxChars: 500,
    maxMessages: 6,
    preserveRecentMessages: 4,
  });

  assert.equal(compacted.compacted, false);
  assert.equal(compacted.messages.length, transcript.length);
});
