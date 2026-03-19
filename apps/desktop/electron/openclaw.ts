import type { ChildProcess } from "node:child_process";
import { createWriteStream } from "node:fs";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { app, BrowserWindow, shell } from "electron";
import type { OpenClawBridgeState } from "@klava/contracts";
import { createKlavaRuntime } from "@klava/runtime";
import { DESKTOP_RUNTIME_URL } from "./config";
import { defaultCommandRunner, detectOpenClawBridgeState } from "./openclaw-bridge";
import {
  clearManagedOpenClawState,
  configureProcessForManagedOpenClaw,
  readManagedOpenClawState,
  resolveManagedOpenClawRuntime,
  spawnManagedOpenClawCli,
  writeManagedOpenClawState,
  type ManagedOpenClawRuntime,
} from "./openclaw-managed-runtime";

let runtimeController: Awaited<ReturnType<typeof createKlavaRuntime>> | null = null;
let openClawBridgeStateCache: OpenClawBridgeState | null = null;
let openClawBridgeStateCacheExpiresAt = 0;
let openClawControlWindow: BrowserWindow | null = null;
let openClawGatewayProcess: ChildProcess | null = null;
let openClawGatewayOwnedByDesktop = false;
let openClawGatewayStartPromise: Promise<OpenClawBridgeState> | null = null;
let openClawAutoStartScheduled = false;
let openClawAutoStartAttempts = 0;
let openClawAutoStartRetryTimer: ReturnType<typeof setTimeout> | null = null;
let openClawResolutionFailure: string | null = null;

export function getDesktopLogPath() {
  return path.join(app.getPath("userData"), "logs", "desktop.log");
}

export function getOpenClawGatewayLogPath() {
  return path.join(app.getPath("userData"), "logs", "openclaw-gateway.log");
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resolveManagedRuntime() {
  try {
    const runtime = await resolveManagedOpenClawRuntime();
    configureProcessForManagedOpenClaw(runtime);
    const signature = `${runtime.version ?? "unknown"}@${runtime.cliPath}`;
    if (openClawResolutionFailure !== signature) {
      openClawResolutionFailure = signature;
      await appendDesktopLog(`Bundled OpenClaw runtime resolved: ${signature}`);
    }
    return runtime;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (openClawResolutionFailure !== message) {
      openClawResolutionFailure = message;
      await appendDesktopLog(`Bundled OpenClaw runtime resolution failed: ${message}`);
    }
    return null;
  }
}

async function probeControlUi(url: string, timeoutMs = 1_500) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function killProcessTree(pid: number) {
  if (process.platform === "win32") {
    await defaultCommandRunner("taskkill", ["/PID", String(pid), "/T", "/F"], 10_000);
    return;
  }

  try {
    process.kill(pid, "SIGTERM");
  } catch {
    // Ignore stale pid failures.
  }
}

async function isProcessAlive(pid: number) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  if (process.platform === "win32") {
    const result = await defaultCommandRunner("tasklist", ["/FI", `PID eq ${pid}`, "/FO", "CSV", "/NH"], 5_000);
    return result.exitCode === 0 && result.stdout.includes(`"${pid}"`);
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function sameManagedRuntimeCliPath(runtime: ManagedOpenClawRuntime, cliPath: string | null | undefined) {
  if (!cliPath) {
    return false;
  }

  return path.normalize(cliPath) === path.normalize(runtime.cliPath);
}

async function waitForProcessExit(pid: number, timeoutMs = 10_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (!(await isProcessAlive(pid))) {
      return true;
    }

    await sleep(300);
  }

  return false;
}

async function cleanupStaleManagedGateway() {
  const staleState = await readManagedOpenClawState();
  if (!staleState?.pid) {
    return;
  }

  if (openClawGatewayProcess?.pid === staleState.pid && openClawGatewayProcess.exitCode === null) {
    return;
  }

  await appendDesktopLog(`Cleaning stale managed OpenClaw gateway pid=${staleState.pid}.`);
  await killProcessTree(staleState.pid);
  await clearManagedOpenClawState();
}

async function waitForGatewayReady(runtime: ManagedOpenClawRuntime, child: ChildProcess, timeoutMs = 25_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (child.exitCode !== null) {
      throw new Error(`Bundled OpenClaw gateway exited early with code ${child.exitCode}.`);
    }

    if (await probeControlUi(runtime.controlUiUrl, 1_000)) {
      return;
    }

    await sleep(450);
  }

  throw new Error(`Timed out waiting for bundled OpenClaw gateway at ${runtime.controlUiUrl}.`);
}

function markStateStarting(state: OpenClawBridgeState) {
  const notes = [
    "Klava is starting the bundled OpenClaw gateway in the background.",
    ...state.notes,
  ];
  const suggestedActions = [
    "Wait a few seconds and refresh the bridge state again.",
    "Open the Control UI once the gateway finishes booting.",
  ];

  return {
    ...state,
    gatewayStatus: "starting" as const,
    summary: "Klava is launching the bundled OpenClaw runtime right now. The Control UI and social channels will become available as soon as the gateway finishes booting.",
    notes,
    suggestedActions,
  };
}

async function detectDesktopManagedOpenClawState() {
  const managedRuntime = await resolveManagedRuntime();
  const state = await detectOpenClawBridgeState({
    env: managedRuntime?.env ?? process.env,
    cliFile: managedRuntime?.cliPath,
    managedByDesktop: true,
    desktopOwnsGatewayProcess: openClawGatewayOwnedByDesktop,
    embeddedRuntimeAvailable: Boolean(managedRuntime),
    embeddedRuntimeVersion: managedRuntime?.version ?? null,
  });

  if (openClawGatewayStartPromise && state.gatewayStatus !== "running") {
    return markStateStarting(state);
  }

  return state;
}

export async function getOpenClawBridgeState(forceRefresh = false) {
  if (!forceRefresh && openClawBridgeStateCache && Date.now() < openClawBridgeStateCacheExpiresAt) {
    return openClawBridgeStateCache;
  }

  const state = await detectDesktopManagedOpenClawState();
  openClawBridgeStateCache = state;
  openClawBridgeStateCacheExpiresAt = Date.now() + 4_000;
  await appendDesktopLog(`OpenClaw bridge: ${state.gatewayStatus} (${state.summary})`);
  return state;
}

export async function refreshOpenClawBridgeState() {
  openClawBridgeStateCache = null;
  openClawBridgeStateCacheExpiresAt = 0;
  return getOpenClawBridgeState(true);
}

function attachGatewayProcess(child: ChildProcess, runtime: ManagedOpenClawRuntime) {
  const logPath = getOpenClawGatewayLogPath();
  let stream: ReturnType<typeof createWriteStream> | null = null;

  void mkdir(path.dirname(logPath), { recursive: true })
    .then(() => {
      stream = createWriteStream(logPath, { flags: "a" });
      child.stdout?.pipe(stream);
      child.stderr?.pipe(stream);
    })
    .catch(async (error) => {
      await appendDesktopLog(`Failed to prepare OpenClaw gateway log stream: ${error instanceof Error ? error.message : String(error)}`);
    });

  child.on("exit", (code, signal) => {
    stream?.end();
    if (openClawGatewayProcess === child) {
      openClawGatewayProcess = null;
      openClawGatewayOwnedByDesktop = false;
    }
    void clearManagedOpenClawState();
    void appendDesktopLog(
      `Bundled OpenClaw gateway exited with code=${code ?? "null"} signal=${signal ?? "null"} at ${runtime.controlUiUrl}.`,
    );
    openClawBridgeStateCache = null;
    openClawBridgeStateCacheExpiresAt = 0;
  });
}

async function beginGatewayStart(reason: "auto" | "manual") {
  const runtime = await resolveManagedRuntime();
  if (!runtime) {
    throw new Error("Bundled OpenClaw runtime is not available in this Klava build.");
  }

  const managedState = await readManagedOpenClawState();

  if (await probeControlUi(runtime.controlUiUrl)) {
    const canAdoptManagedGateway =
      Boolean(managedState?.pid) &&
      managedState?.gatewayPort === runtime.gatewayPort &&
      sameManagedRuntimeCliPath(runtime, managedState?.cliPath) &&
      (await isProcessAlive(managedState.pid));
    openClawGatewayOwnedByDesktop = canAdoptManagedGateway;
    await appendDesktopLog(
      canAdoptManagedGateway
        ? `Adopting already running bundled OpenClaw gateway pid=${managedState?.pid} at ${runtime.controlUiUrl}.`
        : `OpenClaw gateway already reachable at ${runtime.controlUiUrl}; desktop will attach without respawning it.`,
    );
    return refreshOpenClawBridgeState();
  }

  await cleanupStaleManagedGateway();

  if (await probeControlUi(runtime.controlUiUrl)) {
    openClawGatewayOwnedByDesktop = false;
    await appendDesktopLog(`OpenClaw gateway became reachable at ${runtime.controlUiUrl} after stale-process cleanup.`);
    return refreshOpenClawBridgeState();
  }

  if (openClawGatewayProcess && openClawGatewayProcess.exitCode === null) {
    await waitForGatewayReady(runtime, openClawGatewayProcess, 12_000);
    return refreshOpenClawBridgeState();
  }

  await appendDesktopLog(`Starting bundled OpenClaw gateway (${reason}) from ${runtime.cliPath}.`);
  openClawBridgeStateCache = null;
  openClawBridgeStateCacheExpiresAt = 0;

  const { child } = await spawnManagedOpenClawCli(
    ["gateway", "run", "--allow-unconfigured", "--bind", "loopback", "--port", String(runtime.gatewayPort)],
    {
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  openClawGatewayProcess = child;
  openClawGatewayOwnedByDesktop = true;
  attachGatewayProcess(child, runtime);

  if (child.pid) {
    await writeManagedOpenClawState({
      pid: child.pid,
      gatewayPort: runtime.gatewayPort,
      cliPath: runtime.cliPath,
      startedAt: new Date().toISOString(),
      version: runtime.version,
    });
  }

  await waitForGatewayReady(runtime, child, 25_000);
  await appendDesktopLog(`Bundled OpenClaw gateway is ready at ${runtime.controlUiUrl}.`);
  return refreshOpenClawBridgeState();
}

function startGateway(reason: "auto" | "manual") {
  if (openClawGatewayStartPromise) {
    return openClawGatewayStartPromise;
  }

  openClawGatewayStartPromise = beginGatewayStart(reason).finally(() => {
    openClawGatewayStartPromise = null;
  });

  return openClawGatewayStartPromise;
}

function clearAutoStartRetryTimer() {
  if (!openClawAutoStartRetryTimer) {
    return;
  }

  clearTimeout(openClawAutoStartRetryTimer);
  openClawAutoStartRetryTimer = null;
}

function resetAutoStartState() {
  openClawAutoStartScheduled = false;
  openClawAutoStartAttempts = 0;
  clearAutoStartRetryTimer();
}

function scheduleAutoStartRetry() {
  if (openClawAutoStartAttempts >= 3 || openClawAutoStartRetryTimer) {
    return;
  }

  const delayMs = 1_500 * Math.max(openClawAutoStartAttempts, 1);
  openClawAutoStartRetryTimer = setTimeout(() => {
    openClawAutoStartRetryTimer = null;
    openClawAutoStartScheduled = false;
    scheduleAutoStartOpenClawGateway();
  }, delayMs);
}

function scheduleAutoStartOpenClawGateway() {
  if (openClawAutoStartScheduled) {
    return;
  }

  openClawAutoStartScheduled = true;
  openClawAutoStartAttempts += 1;
  void startGateway("auto")
    .then(async () => {
      await appendDesktopLog(`Bundled OpenClaw auto-start succeeded on attempt ${openClawAutoStartAttempts}.`);
      resetAutoStartState();
    })
    .catch(async (error) => {
      openClawAutoStartScheduled = false;
      await appendDesktopLog(
        `Bundled OpenClaw auto-start attempt ${openClawAutoStartAttempts} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      scheduleAutoStartRetry();
    });
}

export async function startOpenClawGateway() {
  clearAutoStartRetryTimer();
  openClawAutoStartScheduled = false;
  return startGateway("manual");
}

export async function stopOpenClawGateway() {
  await appendDesktopLog("Stopping bundled OpenClaw gateway.");

  const managedState = await readManagedOpenClawState();
  const pid = openClawGatewayProcess?.pid ?? managedState?.pid ?? null;

  if (pid && openClawGatewayOwnedByDesktop) {
    await killProcessTree(pid);
    const exited = await waitForProcessExit(pid, 10_000);
    if (!exited) {
      await appendDesktopLog(`Timed out waiting for bundled OpenClaw gateway pid=${pid} to exit cleanly.`);
    }
  } else {
    await appendDesktopLog("OpenClaw gateway stop skipped because the current gateway is not desktop-owned.");
  }

  openClawGatewayProcess = null;
  openClawGatewayOwnedByDesktop = false;
  await clearManagedOpenClawState();
  return refreshOpenClawBridgeState();
}

export async function openOpenClawControlWindow() {
  let state = await getOpenClawBridgeState(true);
  if (state.gatewayStatus !== "running" || !state.controlUiUrl) {
    state = await startOpenClawGateway();
  }

  if (!state.controlUiUrl) {
    await appendDesktopLog("OpenClaw control window requested, but no Control UI URL is available.");
    return false;
  }

  if (openClawControlWindow && !openClawControlWindow.isDestroyed()) {
    if (openClawControlWindow.webContents.getURL() !== state.controlUiUrl) {
      await openClawControlWindow.loadURL(state.controlUiUrl);
    }
    openClawControlWindow.focus();
    return true;
  }

  openClawControlWindow = new BrowserWindow({
    show: false,
    width: 1500,
    height: 960,
    minWidth: 1100,
    minHeight: 720,
    autoHideMenuBar: true,
    backgroundColor: "#171311",
    title: "OpenClaw Control UI",
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  if (process.platform !== "darwin") {
    openClawControlWindow.removeMenu();
    openClawControlWindow.setMenuBarVisibility(false);
  }

  openClawControlWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  openClawControlWindow.on("closed", () => {
    openClawControlWindow = null;
  });

  openClawControlWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedUrl) => {
    void appendDesktopLog(
      `OpenClaw window did-fail-load: code=${errorCode} description=${errorDescription} url=${validatedUrl}`,
    );
  });

  openClawControlWindow.webContents.on("did-finish-load", () => {
    if (openClawControlWindow && !openClawControlWindow.isVisible()) {
      openClawControlWindow.show();
    }
  });

  await appendDesktopLog(`Opening OpenClaw Control UI at ${state.controlUiUrl}.`);
  await openClawControlWindow.loadURL(state.controlUiUrl);
  return true;
}

export async function ensureRuntime() {
  const managedRuntime = await resolveManagedRuntime();

  if (await runtimeIsHealthy()) {
    await appendDesktopLog("Reusing existing local runtime.");
    if (managedRuntime) {
      scheduleAutoStartOpenClawGateway();
    }
    void getOpenClawBridgeState().catch(async (error) => {
      await appendDesktopLog(`OpenClaw bridge refresh failed: ${error instanceof Error ? error.message : String(error)}`);
    });
    return;
  }

  await appendDesktopLog("Starting embedded local runtime.");
  runtimeController = await createKlavaRuntime();
  await runtimeController.start();
  await appendDesktopLog("Embedded local runtime started.");

  if (managedRuntime) {
    scheduleAutoStartOpenClawGateway();
  }

  void getOpenClawBridgeState().catch(async (error) => {
    await appendDesktopLog(`OpenClaw bridge refresh failed: ${error instanceof Error ? error.message : String(error)}`);
  });
}

export async function stopRuntime() {
  resetAutoStartState();
  try {
    await stopOpenClawGateway();
  } catch (error) {
    await appendDesktopLog(`Bundled OpenClaw shutdown failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!runtimeController) {
    return;
  }

  await appendDesktopLog("Stopping embedded local runtime.");
  await runtimeController.stop();
  runtimeController = null;
}
