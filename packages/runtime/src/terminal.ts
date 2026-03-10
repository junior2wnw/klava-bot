import { spawn } from "node:child_process";

export type GuardAssessment =
  | { kind: "safe" }
  | { kind: "guarded"; reason: string }
  | { kind: "blocked"; reason: string };

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

export function runCommand(command: string): Promise<{ output: string; exitCode: number }> {
  return new Promise((resolve) => {
    const unixShell = process.env.SHELL?.trim() || (process.platform === "darwin" ? "/bin/zsh" : "/bin/bash");
    const shellCommand =
      process.platform === "win32"
        ? {
            file: "powershell",
            args: ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", command],
          }
        : {
            file: unixShell,
            args: ["-lc", command],
          };

    const child = spawn(shellCommand.file, shellCommand.args, {
      windowsHide: true,
      env: process.env,
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, 30_000);

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
