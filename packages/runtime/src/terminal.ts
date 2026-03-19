import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export type GuardAssessment =
  | { kind: "safe" }
  | { kind: "guarded"; reason: string }
  | { kind: "blocked"; reason: string };

export type CommandResult = {
  output: string;
  exitCode: number;
};

const blockedPatterns: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\brm\s+-rf\b/i, reason: "recursive destructive deletion is blocked" },
  { pattern: /\bformat\b/i, reason: "disk formatting is blocked" },
  { pattern: /\bshutdown\b/i, reason: "forced shutdown is blocked" },
  { pattern: /\breboot\b/i, reason: "forced reboot is blocked" },
  { pattern: /\bdiskpart\b/i, reason: "low-level disk partitioning is blocked" },
  { pattern: /\breg\s+delete\b/i, reason: "destructive registry deletion is blocked" },
];

const guardedPatterns: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\bwinget\s+install\b/i, reason: "package installation changes the system state" },
  { pattern: /\bchoco\s+install\b/i, reason: "package installation changes the system state" },
  { pattern: /\bbrew\s+(install|upgrade|uninstall)\b/i, reason: "package management changes the system state" },
  { pattern: /\bopenclaw\s+update\b(?!.*--dry-run)/i, reason: "OpenClaw updates change the installed runtime" },
  { pattern: /\bopenclaw\s+gateway\s+(install|uninstall|start|stop|restart|run)\b/i, reason: "OpenClaw gateway lifecycle changes running services" },
  { pattern: /\bopenclaw\s+channels\s+(add|remove|login|logout)\b/i, reason: "OpenClaw channel changes affect connected social accounts" },
  { pattern: /\bopenclaw\s+cron\s+(add|edit|rm|enable|disable|run)\b/i, reason: "OpenClaw trigger changes affect background automation" },
  { pattern: /\bopenclaw\s+hooks\s+(enable|disable|install|update)\b(?!.*--dry-run)/i, reason: "OpenClaw hook changes affect the automation surface" },
  { pattern: /\bopenclaw\s+webhooks\s+gmail\s+(setup|run)\b/i, reason: "webhook setup changes external trigger integration" },
  { pattern: /\bopenclaw\s+plugins\s+(install|enable|disable)\b/i, reason: "plugin changes affect OpenClaw capabilities" },
  { pattern: /\bsudo\b/i, reason: "elevated shell execution is guarded" },
  { pattern: /\bsc\s+(start|stop|config)\b/i, reason: "service control affects system services" },
  { pattern: /\bRestart-Service\b/i, reason: "service restart affects running workloads" },
  { pattern: /\bStop-Service\b/i, reason: "service stop affects running workloads" },
  { pattern: /\bStart-Service\b/i, reason: "service start affects running workloads" },
  { pattern: /\blaunchctl\s+(load|unload|bootstrap|bootout|enable|disable|kickstart)\b/i, reason: "service control affects running workloads" },
  { pattern: /\bnetsh\b/i, reason: "network configuration is guarded" },
  { pattern: /\bnetworksetup\b/i, reason: "network configuration is guarded" },
  { pattern: /\bSet-NetFirewallProfile\b/i, reason: "firewall changes are guarded" },
  { pattern: /\bRemove-Item\b/i, reason: "file deletion is guarded" },
  { pattern: /\bMove-Item\b/i, reason: "file moves are guarded" },
  { pattern: /\bRename-Item\b/i, reason: "file renames are guarded" },
  { pattern: /\breg\s+add\b/i, reason: "registry writes are guarded" },
];

const windowsAdminPatterns: RegExp[] = [
  /\bwinget\s+(install|upgrade|uninstall)\b/i,
  /\bchoco\s+install\b/i,
  /\bsc\s+(start|stop|config)\b/i,
  /\bRestart-Service\b/i,
  /\bStop-Service\b/i,
  /\bStart-Service\b/i,
  /\bnetsh\b/i,
  /\bSet-NetFirewallProfile\b/i,
  /\breg\s+add\b/i,
];

export function assessCommand(command: string): GuardAssessment {
  const trimmed = command.trim();
  for (const item of blockedPatterns) {
    if (item.pattern.test(trimmed)) {
      return { kind: "blocked", reason: item.reason };
    }
  }

  for (const item of guardedPatterns) {
    if (item.pattern.test(trimmed)) {
      return { kind: "guarded", reason: item.reason };
    }
  }

  return { kind: "safe" };
}

function sanitizeOutput(output: string) {
  const trimmed = output.trim();
  if (!trimmed) {
    return "(no output)";
  }
  return trimmed.length > 6000 ? `${trimmed.slice(0, 6000)}\n\n[output truncated]` : trimmed;
}

function escapePowerShellSingleQuotedString(value: string) {
  return value.replace(/'/g, "''");
}

function buildWindowsPowerShellBootstrap(command: string) {
  const encodedCommand = Buffer.from(command, "utf8").toString("base64");
  return [
    "$ErrorActionPreference = 'Continue'",
    "[Console]::InputEncoding = [System.Text.Encoding]::UTF8",
    "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
    "$OutputEncoding = [System.Text.Encoding]::UTF8",
    "try { chcp 65001 > $null } catch {}",
    `$klavaBytes = [Convert]::FromBase64String('${encodedCommand}')`,
    "$klavaCommand = [System.Text.Encoding]::UTF8.GetString($klavaBytes)",
    "Invoke-Expression $klavaCommand",
  ].join("; ");
}

function encodePowerShellCommand(command: string) {
  return Buffer.from(command, "utf16le").toString("base64");
}

function buildWindowsElevatedWorkerScript(command: string, resultPath: string) {
  const encodedCommand = Buffer.from(command, "utf8").toString("base64");
  const escapedResultPath = escapePowerShellSingleQuotedString(resultPath);
  return [
    "$ErrorActionPreference = 'Continue'",
    "[Console]::InputEncoding = [System.Text.Encoding]::UTF8",
    "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
    "$OutputEncoding = [System.Text.Encoding]::UTF8",
    "try { chcp 65001 > $null } catch {}",
    `$klavaEncodedCommand = '${encodedCommand}'`,
    "$klavaJob = Start-Job -ScriptBlock {",
    "  param($encodedCommand)",
    "  $ErrorActionPreference = 'Continue'",
    "  [Console]::InputEncoding = [System.Text.Encoding]::UTF8",
    "  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
    "  $OutputEncoding = [System.Text.Encoding]::UTF8",
    "  try { chcp 65001 > $null } catch {}",
    "  $klavaCommand = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($encodedCommand))",
    "  try {",
    "    $klavaOutputLines = Invoke-Expression $klavaCommand *>&1",
    "    $klavaExitCode = if ($LASTEXITCODE -is [int]) { $LASTEXITCODE } elseif ($?) { 0 } else { 1 }",
    "    [pscustomobject]@{ exitCode = $klavaExitCode; output = ($klavaOutputLines | Out-String -Width 4096) }",
    "  } catch {",
    "    [pscustomobject]@{ exitCode = if ($LASTEXITCODE -is [int]) { $LASTEXITCODE } else { 1 }; output = ($_ | Out-String) }",
    "  }",
    "} -ArgumentList $klavaEncodedCommand",
    "$klavaResult = $null",
    "try {",
    "  if (Wait-Job -Id $klavaJob.Id -Timeout 30) {",
    "    $klavaResult = Receive-Job -Id $klavaJob.Id",
    "  } else {",
    "    Stop-Job -Id $klavaJob.Id -ErrorAction SilentlyContinue",
    "    $klavaResult = [pscustomobject]@{ exitCode = 124; output = 'Command timed out after 30s.' }",
    "  }",
    "} finally {",
    "  Remove-Job -Id $klavaJob.Id -Force -ErrorAction SilentlyContinue",
    "}",
    `[System.IO.File]::WriteAllText('${escapedResultPath}', ($klavaResult | ConvertTo-Json -Compress), [System.Text.Encoding]::UTF8)`,
    "exit [int]$klavaResult.exitCode",
  ].join("; ");
}

function splitCommandLine(command: string) {
  const tokens: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;

  for (let index = 0; index < command.length; index += 1) {
    const char = command[index] ?? "";
    if (!quote && /\s/.test(char)) {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    if (char === '"' || char === "'") {
      if (!quote) {
        quote = char;
        continue;
      }

      if (quote === char) {
        quote = null;
        continue;
      }
    }

    current += char;
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

function buildDirectSpawnPlan(file: string, args: string[]) {
  const trimmedFile = file.trim();
  const lowerFile = trimmedFile.toLowerCase();
  const isNodeScript = /\.(?:mjs|cjs|js)$/i.test(lowerFile);
  const isWindowsShellScript = /\.(?:cmd|bat)$/i.test(lowerFile);
  const explicitNodeBinary = process.env.OPENCLAW_NODE_PATH?.trim();

  if (isNodeScript) {
    return {
      file: explicitNodeBinary || process.execPath,
      args: [trimmedFile, ...args],
      env: explicitNodeBinary
        ? process.env
        : {
            ...process.env,
            ELECTRON_RUN_AS_NODE: "1",
          },
    };
  }

  return {
    file: trimmedFile,
    args,
    env: process.env,
    shell: process.platform === "win32" && (isWindowsShellScript || !/[\\/]/.test(trimmedFile)),
  };
}

function resolveManagedOpenClawCommand(command: string) {
  const cliPath = process.env.OPENCLAW_CLI_PATH?.trim();
  if (!cliPath) {
    return null;
  }

  const tokens = splitCommandLine(command.trim());
  if ((tokens[0] ?? "").toLowerCase() !== "openclaw") {
    return null;
  }

  return buildDirectSpawnPlan(cliPath, tokens.slice(1));
}

function runSpawnedProcess(
  file: string,
  args: string[],
  timeoutMs = 30_000,
  options: { env?: NodeJS.ProcessEnv; shell?: boolean } = {},
): Promise<CommandResult> {
  return new Promise((resolve) => {
    const child = spawn(file, args, {
      windowsHide: true,
      env: options.env ?? process.env,
      shell: options.shell,
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      clearTimeout(timeout);
      const output = timedOut ? `${stdout}\n${stderr}\nCommand timed out after 30s.` : `${stdout}\n${stderr}`;
      resolve({
        output: sanitizeOutput(output),
        exitCode: timedOut ? 124 : code ?? 1,
      });
    });

    child.on("error", (error) => {
      clearTimeout(timeout);
      resolve({
        output: sanitizeOutput(error.message),
        exitCode: 1,
      });
    });
  });
}

export function commandRequiresAdmin(command: string, platform = process.platform) {
  if (platform !== "win32") {
    return false;
  }

  return windowsAdminPatterns.some((pattern) => pattern.test(command.trim()));
}

export function runCommand(command: string): Promise<CommandResult> {
  const managedOpenClawCommand = resolveManagedOpenClawCommand(command);
  if (managedOpenClawCommand) {
    return runSpawnedProcess(managedOpenClawCommand.file, managedOpenClawCommand.args, 30_000, {
      env: managedOpenClawCommand.env,
      shell: managedOpenClawCommand.shell,
    });
  }

  const unixShell = process.env.SHELL?.trim() || (process.platform === "darwin" ? "/bin/zsh" : "/bin/bash");
  const explicitPowerShellProcess = /^\s*(?:powershell|pwsh)(?:\.exe)?\b/i.test(command);
  const explicitPowerShellTokens = explicitPowerShellProcess ? splitCommandLine(command) : [];
  const shellCommand =
    process.platform === "win32"
      ? explicitPowerShellProcess
        ? {
            file: explicitPowerShellTokens[0] || "powershell",
            args: explicitPowerShellTokens.slice(1),
          }
        : {
            file: "powershell",
            args: ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", buildWindowsPowerShellBootstrap(command)],
          }
      : {
          file: unixShell,
          args: ["-lc", command],
        };

  return runSpawnedProcess(shellCommand.file, shellCommand.args);
}

export async function runElevatedCommand(command: string): Promise<CommandResult> {
  if (process.platform !== "win32") {
    return {
      output: "Elevated command execution is only available on Windows in this build.",
      exitCode: 1,
    };
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "klava-uac-"));
  const resultPath = path.join(tempDir, "result.json");
  const escapedResultPath = escapePowerShellSingleQuotedString(resultPath);
  const workerEncodedCommand = encodePowerShellCommand(buildWindowsElevatedWorkerScript(command, resultPath));
  const wrapperScript = [
    "$ErrorActionPreference = 'Stop'",
    "$klavaResult = $null",
    "try {",
    `  $klavaProcess = Start-Process -FilePath 'powershell.exe' -Verb RunAs -WindowStyle Hidden -Wait -PassThru -ArgumentList @('-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-EncodedCommand','${workerEncodedCommand}')`,
    `  if (Test-Path '${escapedResultPath}') {`,
    `    $klavaResult = Get-Content -Path '${escapedResultPath}' -Raw -Encoding UTF8 | ConvertFrom-Json`,
    "  } else {",
    "    $klavaResult = [pscustomobject]@{ exitCode = if ($null -ne $klavaProcess.ExitCode) { [int]$klavaProcess.ExitCode } else { 1 }; output = '' }",
    "  }",
    "} catch {",
    "  $klavaExitCode = if ($_.Exception.HResult -eq -2147023673) { 1223 } else { 1 }",
    "  $klavaResult = [pscustomobject]@{ exitCode = $klavaExitCode; output = $_.Exception.Message }",
    "}",
    "$klavaResult | ConvertTo-Json -Compress",
  ].join("; ");

  try {
    const wrapperResult = await runSpawnedProcess(
      "powershell",
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-EncodedCommand",
        encodePowerShellCommand(wrapperScript),
      ],
      120_000,
    );
    let parsed: Partial<CommandResult>;
    try {
      parsed = JSON.parse(wrapperResult.output) as Partial<CommandResult>;
    } catch {
      return {
        output: sanitizeOutput(wrapperResult.output),
        exitCode: wrapperResult.exitCode === 0 ? 1 : wrapperResult.exitCode,
      };
    }
    return {
      output: sanitizeOutput(typeof parsed.output === "string" ? parsed.output : ""),
      exitCode: typeof parsed.exitCode === "number" ? parsed.exitCode : 1,
    };
  } catch (error) {
    return {
      output: sanitizeOutput(error instanceof Error ? error.message : String(error)),
      exitCode: 1,
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
