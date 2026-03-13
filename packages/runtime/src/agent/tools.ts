import { spawn } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import type { RuntimeLogger } from "../logging";

const DEFAULT_MAX_FILE_LINES = 120;
const DEFAULT_MAX_SEARCH_RESULTS = 40;
const MAX_PREVIEW_CHARS = 8_000;

export type FileReadResult = {
  summary: string;
  resolvedPath: string;
  outputPreview: string;
};

export type FileSearchResult = {
  summary: string;
  resolvedPath: string;
  outputPreview: string;
};

function resolveInputPath(inputPath: string, cwd: string) {
  const trimmed = inputPath.trim();
  if (!trimmed) {
    throw new Error("A path is required.");
  }

  return path.isAbsolute(trimmed) ? path.normalize(trimmed) : path.resolve(cwd, trimmed);
}

function truncatePreview(value: string, maxChars = MAX_PREVIEW_CHARS) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "(no output)";
  }

  return trimmed.length > maxChars ? `${trimmed.slice(0, maxChars)}\n\n[output truncated]` : trimmed;
}

function toPreviewLines(raw: string, maxLines: number) {
  const lines = raw.split(/\r?\n/);
  const sliced = lines.slice(0, maxLines);
  const suffix = lines.length > maxLines ? `\n\n[truncated to first ${maxLines} lines]` : "";
  return truncatePreview(`${sliced.join("\n")}${suffix}`);
}

function runProcess(file: string, args: string[], timeoutMs = 20_000) {
  return new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve) => {
    const child = spawn(file, args, {
      cwd: process.cwd(),
      windowsHide: true,
      env: process.env,
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill();
        resolve({
          stdout,
          stderr: `${stderr}\nCommand timed out after ${timeoutMs}ms.`,
          exitCode: 124,
        });
      }
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      resolve({
        stdout,
        stderr: `${stderr}\n${error.message}`.trim(),
        exitCode: 1,
      });
    });

    child.on("close", (code) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      resolve({
        stdout,
        stderr,
        exitCode: code ?? 1,
      });
    });
  });
}

export async function readTextFileSnippet(
  inputPath: string,
  cwd: string,
  maxLines = DEFAULT_MAX_FILE_LINES,
  logger?: RuntimeLogger,
): Promise<FileReadResult> {
  const resolvedPath = resolveInputPath(inputPath, cwd);
  await access(resolvedPath, fsConstants.R_OK);
  const raw = await readFile(resolvedPath, "utf8");

  if (raw.includes("\u0000")) {
    throw new Error(`The file at ${resolvedPath} looks binary and is not safe to inject into the text agent path.`);
  }

  await logger?.log(`Agent filesystem.read resolved ${resolvedPath}.`);

  return {
    summary: `Read ${resolvedPath}.`,
    resolvedPath,
    outputPreview: toPreviewLines(raw, Math.max(1, maxLines)),
  };
}

async function searchWithRipgrep(pattern: string, resolvedPath: string, maxResults: number) {
  const args = [
    "-n",
    "--no-heading",
    "--smart-case",
    "--max-count",
    String(Math.max(1, maxResults)),
    pattern,
    resolvedPath,
  ];
  return runProcess("rg", args, 20_000);
}

async function searchWithPowerShell(pattern: string, resolvedPath: string, maxResults: number) {
  const escapedPattern = pattern.replace(/'/g, "''");
  const escapedPath = resolvedPath.replace(/'/g, "''");
  const script = [
    "$ErrorActionPreference = 'Stop'",
    "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
    `$files = if (Test-Path '${escapedPath}' -PathType Container) { Get-ChildItem -Path '${escapedPath}' -Recurse -File -ErrorAction SilentlyContinue } else { Get-Item '${escapedPath}' }`,
    `$matches = $files | Select-String -Pattern '${escapedPattern}' -CaseSensitive:$false | Select-Object -First ${Math.max(1, maxResults)} Path, LineNumber, Line`,
    "$matches | ForEach-Object { \"{0}:{1}:{2}\" -f $_.Path, $_.LineNumber, $_.Line.Trim() }",
  ].join("; ");

  return runProcess(
    "powershell",
    ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
    25_000,
  );
}

export async function searchWorkspaceText(
  pattern: string,
  inputPath: string | undefined,
  cwd: string,
  maxResults = DEFAULT_MAX_SEARCH_RESULTS,
  logger?: RuntimeLogger,
): Promise<FileSearchResult> {
  const resolvedPath = resolveInputPath(inputPath?.trim() || ".", cwd);
  await access(resolvedPath, fsConstants.R_OK);

  let result = await searchWithRipgrep(pattern, resolvedPath, maxResults);
  if (result.exitCode !== 0 && /not recognized|not found|enoent/i.test(`${result.stdout}\n${result.stderr}`)) {
    result = await searchWithPowerShell(pattern, resolvedPath, maxResults);
  }

  if (result.exitCode !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || `Search failed for ${resolvedPath}.`);
  }

  await logger?.log(`Agent filesystem.search matched pattern="${pattern}" in ${resolvedPath}.`);

  return {
    summary: `Searched ${resolvedPath} for "${pattern}".`,
    resolvedPath,
    outputPreview: truncatePreview(result.stdout || "(no matches)"),
  };
}
