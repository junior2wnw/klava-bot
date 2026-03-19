import assert from "node:assert/strict";
import test from "node:test";
import { resolveOpenClawDialog } from "./openclaw-dialog";

test("resolveOpenClawDialog safely passes through upstream CLI commands", () => {
  const resolution = resolveOpenClawDialog("/openclaw channels status", "en");

  assert.deepEqual(resolution, {
    kind: "command",
    command: "openclaw channels status",
  });
});

test("resolveOpenClawDialog blocks shell chaining in upstream pass-through", () => {
  const resolution = resolveOpenClawDialog("/openclaw status && whoami", "en");

  assert.equal(resolution?.kind, "message");
  assert.equal(resolution?.level, "warning");
  assert.match(resolution?.message ?? "", /blocks shell chaining/i);
});

test("resolveOpenClawDialog turns daily schedule requests into OpenClaw cron jobs", () => {
  const resolution = resolveOpenClawDialog("every day at 07:00 summarize overnight updates", "en");

  assert.equal(resolution?.kind, "command");
  assert.match(resolution?.command ?? "", /^openclaw cron add /i);
  assert.match(resolution?.command ?? "", /--cron '0 7 \* \* \*'/i);
  assert.match(resolution?.command ?? "", /--message 'summarize overnight updates'/i);
});

test("resolveOpenClawDialog returns a guided social setup response when credentials are still needed", () => {
  const resolution = resolveOpenClawDialog("connect telegram", "en");

  assert.equal(resolution?.kind, "message");
  assert.equal(resolution?.level, "info");
  assert.match(resolution?.message ?? "", /channels add --channel telegram --token/i);
  assert.match(resolution?.message ?? "", /dashboard/i);
});
