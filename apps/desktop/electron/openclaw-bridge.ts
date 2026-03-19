import { spawn } from "node:child_process";
import type { OpenClawBridgeState, OpenClawCapability, OpenClawGatewayStatus } from "@klava/contracts";

export type CommandInvocationResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

export type CommandRunner = (file: string, args: string[], timeoutMs?: number) => Promise<CommandInvocationResult>;
export type CommandSpawnPlan = {
  file: string;
  args: string[];
  env: NodeJS.ProcessEnv;
  shell: boolean;
};

type FetchLike = typeof fetch;

type DetectOpenClawBridgeOptions = {
  env?: NodeJS.ProcessEnv;
  fetchImpl?: FetchLike;
  runCommand?: CommandRunner;
  now?: () => Date;
  cliFile?: string;
  managedByDesktop?: boolean;
  desktopOwnsGatewayProcess?: boolean;
  embeddedRuntimeAvailable?: boolean;
  embeddedRuntimeVersion?: string | null;
};

const DEFAULT_GATEWAY_PORT = 18789;
const DEFAULT_HTTP_TIMEOUT_MS = 2_500;
const DEFAULT_CLI_TIMEOUT_MS = 8_000;

const OPENCLAW_CAPABILITIES: Array<Omit<OpenClawCapability, "available">> = [
  {
    id: "multi_channel_gateway",
    title: "Multi-channel gateway",
    description: "One OpenClaw Gateway can connect channels such as Telegram, WhatsApp, Discord, iMessage, and WebChat.",
  },
  {
    id: "multi_agent_routing",
    title: "Multi-agent routing",
    description: "OpenClaw owns sessions, routing, per-agent isolation, and sender-scoped conversations.",
  },
  {
    id: "media_support",
    title: "Media and voice notes",
    description: "OpenClaw supports images, audio, documents, and voice-note style media flows through the gateway.",
  },
  {
    id: "control_ui",
    title: "Web Control UI",
    description: "The upstream Control UI exposes chat, config, sessions, and node management in the official dashboard.",
  },
  {
    id: "browser_automation",
    title: "Browser automation",
    description: "The upstream browser tool can start a managed browser, inspect pages, act, capture snapshots, and control state.",
  },
  {
    id: "plugin_tools",
    title: "Plugin tools and channels",
    description: "Plugins can extend channels, register agent tools, and add optional capability packs without rewriting the gateway.",
  },
  {
    id: "mobile_nodes",
    title: "Mobile nodes",
    description: "OpenClaw can pair iOS and Android nodes for camera, canvas, and voice-enabled workflows.",
  },
];

export function defaultCliFile(env: NodeJS.ProcessEnv) {
  if (env.OPENCLAW_CLI_PATH?.trim()) {
    return env.OPENCLAW_CLI_PATH.trim();
  }

  return process.platform === "win32" ? "openclaw.cmd" : "openclaw";
}

export function buildCommandSpawnPlan(
  file: string,
  args: string[],
  env: NodeJS.ProcessEnv = process.env,
): CommandSpawnPlan {
  const trimmedFile = file.trim();
  const lowerFile = trimmedFile.toLowerCase();
  const isNodeScript = /\.(?:mjs|cjs|js)$/i.test(lowerFile);
  const isWindowsShellScript = /\.(?:cmd|bat)$/i.test(lowerFile);
  const explicitNodeBinary = env.OPENCLAW_NODE_PATH?.trim();

  if (isNodeScript) {
    return {
      file: explicitNodeBinary || process.execPath,
      args: [trimmedFile, ...args],
      env: explicitNodeBinary
        ? env
        : {
            ...env,
            ELECTRON_RUN_AS_NODE: "1",
          },
      shell: false,
    };
  }

  return {
    file: trimmedFile,
    args,
    env,
    shell: process.platform === "win32" && (isWindowsShellScript || !/[\\/]/.test(trimmedFile)),
  };
}

export function defaultCommandRunner(file: string, args: string[], timeoutMs = DEFAULT_CLI_TIMEOUT_MS) {
  return new Promise<CommandInvocationResult>((resolve) => {
    const plan = buildCommandSpawnPlan(file, args, process.env);
    const child = spawn(plan.file, plan.args, {
      windowsHide: true,
      env: plan.env,
      shell: plan.shell,
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      child.kill();
      resolve({
        stdout,
        stderr: `${stderr}\nCommand timed out after ${timeoutMs}ms.`.trim(),
        exitCode: 124,
      });
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

function normalizeBaseUrl(raw: string | null | undefined, fallbackPort = DEFAULT_GATEWAY_PORT) {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return `http://127.0.0.1:${fallbackPort}/`;
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol === "ws:") {
      url.protocol = "http:";
    } else if (url.protocol === "wss:") {
      url.protocol = "https:";
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    if (!url.pathname || url.pathname === "") {
      url.pathname = "/";
    }

    return url.toString();
  } catch {
    return null;
  }
}

function buildProbeHeaders(env: NodeJS.ProcessEnv) {
  const headers = new Headers();
  const token = env.OPENCLAW_GATEWAY_TOKEN?.trim();
  const password = env.OPENCLAW_GATEWAY_PASSWORD?.trim();

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (password) {
    headers.set("x-openclaw-password", password);
  }

  return headers;
}

function sanitizeCliOutput(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 4_000 ? `${trimmed.slice(0, 4_000)}\n\n[truncated]` : trimmed;
}

async function probeControlUi(url: string | null, env: NodeJS.ProcessEnv, fetchImpl: FetchLike) {
  if (!url) {
    return {
      reachable: false,
      authRequired: false,
      note: "No Control UI URL is configured.",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_HTTP_TIMEOUT_MS);

  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: buildProbeHeaders(env),
      redirect: "follow",
      signal: controller.signal,
    });
    const contentType = response.headers.get("content-type") ?? "";
    const authRequired = response.status === 401 || response.status === 403;
    const looksLikeControlUi = /text\/html|application\/xhtml\+xml/i.test(contentType);

    return {
      reachable: response.ok && looksLikeControlUi,
      authRequired,
      note: response.ok
        ? looksLikeControlUi
          ? `Control UI responded with ${response.status}.`
          : `Gateway responded with ${response.status}, but the content type was ${contentType || "unknown"}.`
        : `Gateway responded with ${response.status}.`,
    };
  } catch (error) {
    return {
      reachable: false,
      authRequired: false,
      note: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function runOpenClawCli(
  env: NodeJS.ProcessEnv,
  args: string[],
  runCommand: CommandRunner,
  timeoutMs = DEFAULT_CLI_TIMEOUT_MS,
  cliFile?: string,
) {
  return runCommand(cliFile ?? defaultCliFile(env), args, timeoutMs);
}

function parseJsonIfPossible(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function collectJsonStrings(value: unknown, bucket: string[]) {
  if (typeof value === "string") {
    bucket.push(value);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectJsonStrings(item, bucket);
    }
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  for (const entry of Object.values(value)) {
    collectJsonStrings(entry, bucket);
  }
}

function inferGatewayStatus(input: {
  cliAvailable: boolean;
  manualUrlConfigured: boolean;
  controlUiReachable: boolean;
  cliStatusText: string;
  healthText: string;
}) {
  if (input.controlUiReachable) {
    return "running" as const;
  }

  const combined = `${input.cliStatusText}\n${input.healthText}`.toLowerCase();
  if (!input.cliAvailable && !input.manualUrlConfigured) {
    return "not_installed" as const;
  }
  if (/\bstarting\b|booting|initializing|warming up|launching/.test(combined)) {
    return "starting" as const;
  }
  if (/\brunning\b|\bok\b|healthy|ready|reachable/.test(combined)) {
    return "degraded" as const;
  }
  if (/\bstopped\b|not running|inactive/.test(combined)) {
    return "stopped" as const;
  }
  if (/not found|not recognized|enoent|cannot find|missing/.test(combined) && !input.manualUrlConfigured) {
    return "not_installed" as const;
  }
  if (/unreachable|refused|timed out|timeout|econnrefused|network/.test(combined) || input.manualUrlConfigured) {
    return "unreachable" as const;
  }

  return "unknown" as const;
}

function inferBrowserAutomationReady(browserStatusText: string) {
  const lowered = browserStatusText.toLowerCase();
  if (!lowered) {
    return false;
  }

  if (/disabled|not available|playwright is not available|501/.test(lowered)) {
    return false;
  }

  return /running|connected|ready|ok|tabs|browser/.test(lowered);
}

function buildCapabilities(
  gatewayStatus: OpenClawGatewayStatus,
  controlUiReachable: boolean,
  browserAutomationReady: boolean,
  cliAvailable: boolean,
) {
  return OPENCLAW_CAPABILITIES.map((capability) => {
    if (capability.id === "control_ui") {
      return { ...capability, available: controlUiReachable };
    }

    if (capability.id === "browser_automation") {
      return { ...capability, available: browserAutomationReady };
    }

    if (capability.id === "multi_channel_gateway" || capability.id === "multi_agent_routing") {
      return { ...capability, available: gatewayStatus === "running" || gatewayStatus === "degraded" };
    }

    return { ...capability, available: cliAvailable };
  });
}

function buildSuggestedActions(
  status: OpenClawGatewayStatus,
  gatewayUrl: string | null,
  embeddedRuntimeAvailable: boolean,
) {
  switch (status) {
    case "not_installed":
      if (embeddedRuntimeAvailable) {
        return [
          "Restart Klava so the desktop can re-attach the bundled OpenClaw runtime.",
          "If the embedded runtime is still missing, reinstall or rebuild the Klava desktop package.",
        ];
      }
      return [
        "npm install -g openclaw@latest",
        "openclaw onboard --install-daemon",
        "openclaw channels login",
        "openclaw gateway --port 18789",
      ];
    case "starting":
      return [
        "Wait a few seconds and refresh the bridge state again.",
        "Open the Control UI once the gateway finishes booting.",
      ];
    case "stopped":
      return [
        "openclaw gateway start --json",
        "openclaw gateway --port 18789",
      ];
    case "unreachable":
      return gatewayUrl
        ? [
            `Check that the OpenClaw Gateway is reachable at ${gatewayUrl}.`,
            "Verify OPENCLAW_GATEWAY_URL / OPENCLAW_CONTROL_UI_URL if you are targeting a remote gateway.",
            "If gateway auth is enabled, set OPENCLAW_GATEWAY_TOKEN or OPENCLAW_GATEWAY_PASSWORD for desktop-side health probes.",
          ]
        : ["Check the OpenClaw Gateway URL configuration."];
    case "degraded":
      return [
        "Refresh the bridge state after the gateway finishes booting.",
        "Open the full Control UI and inspect sessions, channels, or browser status directly in upstream OpenClaw.",
      ];
    case "running":
      return [
        "Open the Control UI window for the full upstream OpenClaw surface.",
        "Use the upstream dashboard for channels, sessions, nodes, browser, and plugin-managed capabilities.",
      ];
    case "unknown":
    default:
      return [
        "Refresh the bridge state.",
        "Run `openclaw gateway status --json` locally to inspect the upstream gateway state.",
      ];
  }
}

function buildSummary(input: {
  cliAvailable: boolean;
  gatewayStatus: OpenClawGatewayStatus;
  controlUiReachable: boolean;
  gatewayUrl: string | null;
  embeddedRuntimeAvailable: boolean;
}) {
  if (!input.cliAvailable && input.gatewayStatus === "not_installed" && input.embeddedRuntimeAvailable) {
    return "Klava expected a bundled OpenClaw runtime, but the embedded CLI could not be started from this desktop package.";
  }

  if (!input.cliAvailable && input.gatewayStatus === "not_installed") {
    return "OpenClaw CLI was not detected on this machine yet, so Klava is currently running without the upstream gateway surface.";
  }

  if (input.gatewayStatus === "running") {
    return `OpenClaw is detected and the upstream Control UI is reachable at ${input.gatewayUrl ?? "the configured gateway URL"}.`;
  }

  if (input.gatewayStatus === "starting") {
    return "OpenClaw is starting, but the desktop cannot confirm the full upstream surface yet. Refresh once the gateway finishes booting.";
  }

  if (input.gatewayStatus === "degraded") {
    return "OpenClaw is detected, but the desktop could not fully confirm every upstream surface yet. The gateway appears to be booting or only partially reachable.";
  }

  if (input.gatewayStatus === "stopped") {
    return "OpenClaw is installed, but its gateway is not running right now.";
  }

  if (input.gatewayStatus === "unreachable") {
    return "OpenClaw is configured or expected, but the desktop could not reach the upstream gateway/control UI from this machine.";
  }

  return "OpenClaw bridge state is unknown right now. Refresh the bridge state or inspect the upstream gateway status directly.";
}

export async function detectOpenClawBridgeState(
  options: DetectOpenClawBridgeOptions = {},
): Promise<OpenClawBridgeState> {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;
  const runCommand = options.runCommand ?? defaultCommandRunner;
  const now = options.now ?? (() => new Date());
  const cliFile = options.cliFile ?? defaultCliFile(env);
  const manualUrlConfigured = Boolean(env.OPENCLAW_GATEWAY_URL?.trim() || env.OPENCLAW_CONTROL_UI_URL?.trim());
  const fallbackPort = Number(env.OPENCLAW_GATEWAY_PORT ?? DEFAULT_GATEWAY_PORT) || DEFAULT_GATEWAY_PORT;
  const gatewayUrl = normalizeBaseUrl(env.OPENCLAW_GATEWAY_URL, fallbackPort);
  const controlUiUrl = normalizeBaseUrl(env.OPENCLAW_CONTROL_UI_URL, fallbackPort) ?? gatewayUrl;
  const authConfigured = Boolean(env.OPENCLAW_GATEWAY_TOKEN?.trim() || env.OPENCLAW_GATEWAY_PASSWORD?.trim());
  const embeddedRuntimeAvailable = options.embeddedRuntimeAvailable ?? false;
  const managedByDesktop = options.managedByDesktop ?? embeddedRuntimeAvailable;
  const desktopOwnsGatewayProcess = options.desktopOwnsGatewayProcess ?? false;
  const embeddedRuntimeVersion = options.embeddedRuntimeVersion ?? null;

  const cliVersionResult = await runOpenClawCli(env, ["--version"], runCommand, 4_000, cliFile);
  const cliAvailable = cliVersionResult.exitCode === 0;
  const cliVersion = cliAvailable
    ? sanitizeCliOutput(cliVersionResult.stdout || cliVersionResult.stderr) || null
    : null;

  const gatewayStatusResult = cliAvailable
    ? await runOpenClawCli(env, ["gateway", "status", "--json"], runCommand, DEFAULT_CLI_TIMEOUT_MS, cliFile)
    : { stdout: "", stderr: cliVersionResult.stderr, exitCode: cliVersionResult.exitCode };
  const healthResult = cliAvailable
    ? await runOpenClawCli(env, ["status", "--json", "--timeout", "3000"], runCommand, 5_000, cliFile)
    : { stdout: "", stderr: "", exitCode: 1 };
  const browserStatusResult = cliAvailable
    ? await runOpenClawCli(env, ["browser", "status", "--json"], runCommand, 5_000, cliFile)
    : { stdout: "", stderr: "", exitCode: 1 };
  const controlUiProbe = await probeControlUi(controlUiUrl, env, fetchImpl);

  const gatewayStatusJson = parseJsonIfPossible(gatewayStatusResult.stdout);
  const healthStatusJson = parseJsonIfPossible(healthResult.stdout);
  const browserStatusJson = parseJsonIfPossible(browserStatusResult.stdout);

  const gatewayStatusStrings: string[] = [];
  collectJsonStrings(gatewayStatusJson, gatewayStatusStrings);
  collectJsonStrings(healthStatusJson, gatewayStatusStrings);

  const gatewayStatusText = sanitizeCliOutput(
    [
      gatewayStatusResult.stdout,
      gatewayStatusResult.stderr,
      healthResult.stdout,
      healthResult.stderr,
      gatewayStatusStrings.join("\n"),
      controlUiProbe.note,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  const browserStatusStrings: string[] = [];
  collectJsonStrings(browserStatusJson, browserStatusStrings);
  const browserStatusText = sanitizeCliOutput(
    [browserStatusResult.stdout, browserStatusResult.stderr, browserStatusStrings.join("\n")].filter(Boolean).join("\n"),
  );
  const browserAutomationReady = browserStatusResult.exitCode === 0 && inferBrowserAutomationReady(browserStatusText);

  const gatewayStatus = inferGatewayStatus({
    cliAvailable,
    manualUrlConfigured,
    controlUiReachable: controlUiProbe.reachable,
    cliStatusText: gatewayStatusText,
    healthText: browserStatusText,
  });

  const notes = [
    embeddedRuntimeAvailable
      ? `Bundled OpenClaw runtime: ${embeddedRuntimeVersion ?? "version unknown"}.`
      : "Bundled OpenClaw runtime is not available in this desktop environment.",
    cliAvailable ? `Detected OpenClaw CLI: ${cliVersion ?? "version unknown"}.` : "OpenClaw CLI was not detected in PATH.",
    gatewayStatusText ? `Gateway probe: ${gatewayStatusText}` : null,
    browserStatusText ? `Browser probe: ${browserStatusText}` : null,
    controlUiProbe.authRequired ? "Gateway auth is enabled or the Control UI rejected the unauthenticated desktop probe." : null,
  ].filter((value): value is string => Boolean(value));

    return {
    detectedAt: now().toISOString(),
    bridgeMode: cliAvailable || controlUiProbe.reachable || embeddedRuntimeAvailable ? "embedded_plus_openclaw" : "embedded_only",
    managedByDesktop,
    desktopOwnsGatewayProcess,
    embeddedRuntimeAvailable,
    embeddedRuntimeVersion,
    cliAvailable,
    cliVersion,
    gatewayUrl,
    controlUiUrl,
    gatewayStatus,
    controlUiReachable: controlUiProbe.reachable,
    browserAutomationReady,
    authConfigured,
    summary: buildSummary({
      cliAvailable,
      gatewayStatus,
      controlUiReachable: controlUiProbe.reachable,
      gatewayUrl: controlUiUrl,
      embeddedRuntimeAvailable,
    }),
    notes,
    suggestedActions: buildSuggestedActions(gatewayStatus, controlUiUrl, embeddedRuntimeAvailable),
    capabilities: buildCapabilities(gatewayStatus, controlUiProbe.reachable, browserAutomationReady, cliAvailable),
  };
}
