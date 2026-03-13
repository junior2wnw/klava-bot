import assert from "node:assert/strict";
import test from "node:test";
import type { TaskMessage } from "@klava/contracts";
import { detectModelCommandIntent, detectTranslationIntent } from "./language";

function message(role: TaskMessage["role"], content: string): TaskMessage {
  return {
    id: `${role}-${content}`,
    taskId: "task-1",
    role,
    content,
    createdAt: "2026-03-13T00:00:00.000Z",
    meta: {},
  };
}

test("translation intent falls back to the previous message when the operator asks only for target language", () => {
  const intent = detectTranslationIntent("переведи на русский", [
    message("assistant", "I checked the local mouse path through Windows device inventory."),
  ]);

  assert.deepEqual(intent, {
    targetLanguage: "ru",
    sourceText: "I checked the local mouse path through Windows device inventory.",
  });
});

test("translation intent keeps inline text when the source is provided in the same message", () => {
  const intent = detectTranslationIntent("переведи на русский: Driver is up to date.", []);

  assert.deepEqual(intent, {
    targetLanguage: "ru",
    sourceText: "Driver is up to date.",
  });
});

test("natural-language model switch requests are parsed deterministically", () => {
  assert.deepEqual(detectModelCommandIntent("переключи модель на gpt-5.2-mini"), {
    kind: "pin",
    model: "gpt-5.2-mini",
  });
  assert.deepEqual(detectModelCommandIntent("включи автовыбор модели"), {
    kind: "auto",
  });
  assert.deepEqual(detectModelCommandIntent("покажи модели"), {
    kind: "list",
  });
});
