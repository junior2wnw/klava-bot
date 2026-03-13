import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { AppPaths } from "./storage";

function sanitizeLogMessage(message: string) {
  return message.replace(/\s+/g, " ").trim();
}

export class RuntimeLogger {
  constructor(private readonly paths: AppPaths) {}

  get logPath() {
    return path.join(this.paths.rootDir, "logs", "runtime.log");
  }

  async log(message: string) {
    try {
      const line = `[${new Date().toISOString()}] ${sanitizeLogMessage(message)}\n`;
      await mkdir(path.dirname(this.logPath), { recursive: true });
      await appendFile(this.logPath, line, "utf8");
    } catch {
      // Logging must never block the main runtime path.
    }
  }

  async readRecentLines(maxLines = 80) {
    try {
      const raw = await readFile(this.logPath, "utf8");
      return raw
        .split(/\r?\n/)
        .map((line) => line.trimEnd())
        .filter((line) => line.length > 0)
        .slice(-maxLines);
    } catch {
      return [];
    }
  }
}
