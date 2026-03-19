import { spawn, type ChildProcess, type StdioOptions } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { app } from "electron";
import { buildCommandSpawnPlan, defaultCommandRunner } from "./openclaw-bridge";

const DEFAULT_GATEWAY_PORT = 18789;

export type ManagedOpenClawRuntime = {
  cliPath: string;
  nodePath: string | null;
  packageRoot: string;
  version: string | null;
  gatewayPort: number;
  gatewayUrl: string;
  controlUiUrl: string;
  env: NodeJS.ProcessEnv;
};

type PersistedManagedGatewayState = {
  pid: number;
  gatewayPort: number;
  cliPath: string;
  startedAt: string;
  version: string | null;
};

let managedRuntimeCache: ManagedOpenClawRuntime | null = null;

async function pathExists(filePath: string) {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function defaultGatewayPort(baseEnv: NodeJS.ProcessEnv = process.env) {
  const raw = Number(baseEnv.OPENCLAW_GATEWAY_PORT ?? `${DEFAULT_GATEWAY_PORT}`);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_GATEWAY_PORT;
}

export function buildManagedOpenClawEnv(
  cliPath: string,
  baseEnv: NodeJS.ProcessEnv = process.env,
  gatewayPort = defaultGatewayPort(baseEnv),
  nodePath?: string | null,
): NodeJS.ProcessEnv {
  const gatewayUrl = `http://127.0.0.1:${gatewayPort}/`;
  return {
    ...baseEnv,
    OPENCLAW_CLI_PATH: cliPath,
    ...(nodePath ? { OPENCLAW_NODE_PATH: nodePath } : {}),
    OPENCLAW_GATEWAY_PORT: String(gatewayPort),
    OPENCLAW_GATEWAY_URL: gatewayUrl,
    OPENCLAW_CONTROL_UI_URL: gatewayUrl,
  };
}

function unpackedAsarPath(filePath: string) {
  return filePath.replace(`${path.sep}app.asar${path.sep}`, `${path.sep}app.asar.unpacked${path.sep}`);
}

function buildEntryCandidates() {
  const envCliPath = process.env.OPENCLAW_CLI_PATH?.trim();
  const candidates = new Set<string>();

  if (envCliPath) {
    candidates.add(unpackedAsarPath(envCliPath));
    candidates.add(envCliPath);
  }

  try {
    const resolved = require.resolve("openclaw/cli-entry");
    candidates.add(unpackedAsarPath(resolved));
    candidates.add(resolved);
  } catch {
    // Ignore local resolution failures and continue with packaged candidates.
  }

  const appPath = app.getAppPath();
  const vendoredRuntimeRelativePath = path.join("vendor", "openclaw-runtime", "node_modules", "openclaw", "openclaw.mjs");
  const packagedCandidates = [
    path.join(process.resourcesPath, "app.asar.unpacked", vendoredRuntimeRelativePath),
    path.join(process.resourcesPath, "app.asar", vendoredRuntimeRelativePath),
    path.join(appPath, vendoredRuntimeRelativePath),
    path.join(unpackedAsarPath(appPath), vendoredRuntimeRelativePath),
    path.join(process.cwd(), "apps", "desktop", vendoredRuntimeRelativePath),
    path.join(process.cwd(), vendoredRuntimeRelativePath),
    path.join(process.resourcesPath, "app.asar.unpacked", "node_modules", "openclaw", "openclaw.mjs"),
    path.join(process.resourcesPath, "app.asar", "node_modules", "openclaw", "openclaw.mjs"),
    path.join(appPath, "node_modules", "openclaw", "openclaw.mjs"),
    path.join(unpackedAsarPath(appPath), "node_modules", "openclaw", "openclaw.mjs"),
    path.join(process.cwd(), "node_modules", "openclaw", "openclaw.mjs"),
  ];

  for (const candidate of packagedCandidates) {
    candidates.add(candidate);
  }

  return [...candidates];
}

async function readPackageVersion(cliPath: string) {
  const packageRoot =
    path.basename(path.dirname(cliPath)) === "bin"
      ? path.join(path.dirname(path.dirname(cliPath)), "node_modules", "openclaw")
      : path.dirname(cliPath);
  const packageJsonPath = path.join(packageRoot, "package.json");
  if (!(await pathExists(packageJsonPath))) {
    return null;
  }

  try {
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as { version?: string };
    return typeof packageJson.version === "string" ? packageJson.version : null;
  } catch {
    return null;
  }
}

async function resolveBundledNodePath(cliPath: string) {
  const maybeVendorRoot =
    path.basename(path.dirname(cliPath)) === "bin"
      ? path.dirname(path.dirname(cliPath))
      : path.basename(path.dirname(cliPath)) === "openclaw"
        ? path.dirname(path.dirname(path.dirname(cliPath)))
        : null;
  if (!maybeVendorRoot) {
    return null;
  }

  const bundledNodePath = path.join(maybeVendorRoot, "bin", process.platform === "win32" ? "node.exe" : "node");
  return (await pathExists(bundledNodePath)) ? bundledNodePath : null;
}

export async function resolveManagedOpenClawRuntime() {
  if (managedRuntimeCache && (await pathExists(managedRuntimeCache.cliPath))) {
    return managedRuntimeCache;
  }

  const candidates = buildEntryCandidates();
  for (const candidate of candidates) {
    if (!(await pathExists(candidate))) {
      continue;
    }

    const version = await readPackageVersion(candidate);
    const nodePath = await resolveBundledNodePath(candidate);
    const gatewayPort = defaultGatewayPort();
    const packageRoot =
      path.basename(path.dirname(candidate)) === "bin"
        ? path.join(path.dirname(path.dirname(candidate)), "node_modules", "openclaw")
        : path.dirname(candidate);
    const runtime: ManagedOpenClawRuntime = {
      cliPath: candidate,
      nodePath,
      packageRoot,
      version,
      gatewayPort,
      gatewayUrl: `http://127.0.0.1:${gatewayPort}/`,
      controlUiUrl: `http://127.0.0.1:${gatewayPort}/`,
      env: buildManagedOpenClawEnv(candidate, process.env, gatewayPort, nodePath),
    };

    managedRuntimeCache = runtime;
    return runtime;
  }

  throw new Error(
    `Bundled OpenClaw runtime is missing. Checked: ${candidates.map((candidate) => `"${candidate}"`).join(", ")}`,
  );
}

export function configureProcessForManagedOpenClaw(runtime: ManagedOpenClawRuntime) {
  for (const [key, value] of Object.entries(runtime.env)) {
    if (typeof value === "string") {
      process.env[key] = value;
    }
  }
}

export async function runManagedOpenClawCli(args: string[], timeoutMs = 10_000) {
  const runtime = await resolveManagedOpenClawRuntime();
  configureProcessForManagedOpenClaw(runtime);
  return defaultCommandRunner(runtime.cliPath, args, timeoutMs);
}

export async function spawnManagedOpenClawCli(
  args: string[],
  options: {
    stdio?: StdioOptions;
    env?: NodeJS.ProcessEnv;
    detached?: boolean;
  } = {},
): Promise<{ runtime: ManagedOpenClawRuntime; child: ChildProcess }> {
  const runtime = await resolveManagedOpenClawRuntime();
  configureProcessForManagedOpenClaw(runtime);
  const plan = buildCommandSpawnPlan(runtime.cliPath, args, {
    ...runtime.env,
    ...(options.env ?? {}),
  });
  const child = spawn(plan.file, plan.args, {
    cwd: runtime.packageRoot,
    env: plan.env,
    shell: plan.shell,
    detached: options.detached ?? false,
    windowsHide: true,
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
  });
  return { runtime, child };
}

export function getManagedOpenClawStateFilePath() {
  return path.join(app.getPath("userData"), "openclaw", "managed-gateway.json");
}

export async function readManagedOpenClawState() {
  const statePath = getManagedOpenClawStateFilePath();
  if (!(await pathExists(statePath))) {
    return null;
  }

  try {
    return JSON.parse(await readFile(statePath, "utf8")) as PersistedManagedGatewayState;
  } catch {
    return null;
  }
}

export async function writeManagedOpenClawState(state: PersistedManagedGatewayState) {
  const statePath = getManagedOpenClawStateFilePath();
  const fs = await import("node:fs/promises");
  await fs.mkdir(path.dirname(statePath), { recursive: true });
  await fs.writeFile(statePath, JSON.stringify(state, null, 2), "utf8");
}

export async function clearManagedOpenClawState() {
  const fs = await import("node:fs/promises");
  await fs.rm(getManagedOpenClawStateFilePath(), { force: true });
}
