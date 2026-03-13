import assert from "node:assert/strict";
import test from "node:test";
import { runCommand } from "./terminal";

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
