import assert from "node:assert/strict";
import test from "node:test";
import { detectComputerIntent } from "./computer-intents";

test("detects a russian mouse-driver query as a local driver inspection intent", () => {
  const intent = detectComputerIntent(
    "\u043f\u0440\u043e\u0432\u0435\u0440\u044c \u0434\u0440\u0430\u0439\u0432\u0435\u0440 \u043c\u044b\u0448\u0438 \u0443 \u043c\u0435\u043d\u044f \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0442\u0435\u043b\u044c\u043d\u043e \u043f\u043e\u0441\u043b\u0435\u0434\u043d\u044f\u044f \u0432\u0435\u0440\u0441\u0438\u044f?",
  );

  assert.ok(intent);
  assert.equal(intent.kind, "inspect_driver");
  assert.equal(intent.skill, "driver_inspection");
  assert.equal(intent.deviceCategory, "mouse");
  assert.equal(intent.queryLatest, true);
});

test("detects winget-safe package install requests for known software", () => {
  const intent = detectComputerIntent("install git for me");

  assert.ok(intent);
  assert.equal(intent.kind, "package_action");
  assert.equal(intent.skill, "package_management");
  assert.equal(intent.action, "install");
  assert.equal(intent.software.key, "git");
});

test("detects software version checks for common developer tools", () => {
  const intent = detectComputerIntent("what version of docker do I have installed?");

  assert.ok(intent);
  assert.equal(intent.kind, "software_version");
  assert.equal(intent.skill, "software_version");
  assert.equal(intent.software.key, "docker");
});

test("detects local-runtime advice requests", () => {
  const intent = detectComputerIntent("can I run ollama on this computer?");

  assert.ok(intent);
  assert.equal(intent.kind, "local_runtime_advice");
  assert.equal(intent.skill, "local_runtime_advice");
});

test("ignores generic chat that is not a computer-skill request", () => {
  const intent = detectComputerIntent("write a short poem about sunrise");
  assert.equal(intent, null);
});
