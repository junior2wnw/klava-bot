import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { app } from "electron";
import { createKlavaRuntime } from "@klava/runtime";
import { DESKTOP_RUNTIME_URL } from "./config";

let runtimeController: Awaited<ReturnType<typeof createKlavaRuntime>> | null = null;

export function getDesktopLogPath() {
  return path.join(app.getPath("userData"), "logs", "desktop.log");
}

export async function appendDesktopLog(message: string) {
  const logPath = getDesktopLogPath();
  await mkdir(path.dirname(logPath), { recursive: true });
  const line = `[${new Date().toISOString()}] ${message}\n`;
  await appendFile(logPath, line, "utf8");
}

export async function runtimeIsHealthy() {
  try {
    const response = await fetch(`${DESKTOP_RUNTIME_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

export async function ensureRuntime() {
  if (await runtimeIsHealthy()) {
    await appendDesktopLog("Reusing existing local runtime.");
    return;
  }

  await appendDesktopLog("Starting embedded local runtime.");
  runtimeController = await createKlavaRuntime();
  await runtimeController.start();
  await appendDesktopLog("Embedded local runtime started.");
}

export async function stopRuntime() {
  if (!runtimeController) {
    return;
  }

  await appendDesktopLog("Stopping embedded local runtime.");
  await runtimeController.stop();
  runtimeController = null;
}
