import assert from "node:assert/strict";
import test from "node:test";
import { assessAgentObjective } from "./safety";

test("agent safety blocks torrent movie piracy goals", () => {
  const decision = assessAgentObjective("find a torrent for this movie and download it");
  assert.equal(decision.kind, "blocked");
  if (decision.kind === "blocked") {
    assert.equal(decision.category, "copyright");
  }
});

test("agent safety allows normal engineering goals", () => {
  const decision = assessAgentObjective("inspect package.json and run npm test");
  assert.deepEqual(decision, { kind: "allowed" });
});
