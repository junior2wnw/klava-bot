import assert from "node:assert/strict";
import test from "node:test";
import { parseAgentDecision } from "./parser";

test("parseAgentDecision accepts fenced JSON payloads", () => {
  const decision = parseAgentDecision(`\`\`\`json
  {
    "kind": "final",
    "summary": "done",
    "message": "Solved",
    "plan": []
  }
  \`\`\``);

  assert.equal(decision.kind, "final");
  assert.equal(decision.summary, "done");
});

test("parseAgentDecision extracts the first balanced JSON object from noisy output", () => {
  const decision = parseAgentDecision(
    `I will return the payload now {"kind":"tool","summary":"inspect","message":"Checking","plan":[],"tool":{"name":"filesystem.read","path":"package.json","maxLines":20}} trailing text`,
  );

  assert.equal(decision.kind, "tool");
  assert.equal(decision.tool?.name, "filesystem.read");
});
