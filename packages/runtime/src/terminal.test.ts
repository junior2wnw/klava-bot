import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { commandRequiresAdmin, runCommand } from "./terminal";

test("commandRequiresAdmin only elevates selected Windows machine commands", () => {
  assert.equal(commandRequiresAdmin("winget install Git.Git", "win32"), true);
  assert.equal(commandRequiresAdmin("Write-Output 'hello'", "win32"), false);
  assert.equal(commandRequiresAdmin("winget install Git.Git", "linux"), false);
});

test("runCommand preserves nested PowerShell pipeline variables on Windows", { skip: process.platform !== "win32" }, async () => {
  const result = await runCommand(
    'powershell -NoLogo -NoProfile -NonInteractive -Command "$items = @(1,2); $items | Where-Object { $_ -eq 2 } | ForEach-Object { Write-Output $_ }"',
  );

  assert.equal(result.exitCode, 0);
  assert.match(result.output, /(^|[\r\n])2($|[\r\n])/);
});

test("runCommand preserves UTF-8 output on Windows", { skip: process.platform !== "win32" }, async () => {
  const result = await runCommand("Write-Output 'привет'");

  assert.equal(result.exitCode, 0);
  assert.match(result.output, /привет/i);
});

test("runCommand routes openclaw commands through OPENCLAW_CLI_PATH when a bundled runtime is configured", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "klava-runtime-openclaw-"));
  const scriptPath = path.join(tempDir, "openclaw.mjs");
  const previousCliPath = process.env.OPENCLAW_CLI_PATH;

  try {
    await writeFile(
      scriptPath,
      "process.stdout.write(JSON.stringify({ args: process.argv.slice(2), electronRunAsNode: process.env.ELECTRON_RUN_AS_NODE ?? null }));\n",
      "utf8",
    );
    process.env.OPENCLAW_CLI_PATH = scriptPath;

    const result = await runCommand('openclaw cron add --name "Morning brief" --cron "0 7 * * *" --message "Summarize overnight updates."');

    assert.equal(result.exitCode, 0);
    assert.match(result.output, /"cron"/);
    assert.match(result.output, /"Morning brief"/);
    assert.match(result.output, /"electronRunAsNode":"1"/);
  } finally {
    if (previousCliPath) {
      process.env.OPENCLAW_CLI_PATH = previousCliPath;
    } else {
      delete process.env.OPENCLAW_CLI_PATH;
    }
    await rm(tempDir, { recursive: true, force: true });
  }
});
