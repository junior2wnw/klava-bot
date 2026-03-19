import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { defaultCommandRunner, detectOpenClawBridgeState } from "./openclaw-bridge";

type MockCommandResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

function commandRunnerFromMap(map: Record<string, MockCommandResult>) {
  return async (_file: string, args: string[]) => {
    const key = args.join(" ");
    const result = map[key];
    if (!result) {
      throw new Error(`Unexpected OpenClaw CLI invocation: ${key}`);
    }
    return result;
  };
}

test("detectOpenClawBridgeState returns not_installed when CLI is missing and no manual gateway is configured", async () => {
  const state = await detectOpenClawBridgeState({
    env: {},
    now: () => new Date("2026-03-19T09:00:00.000Z"),
    runCommand: commandRunnerFromMap({
      "--version": {
        stdout: "",
        stderr: "'openclaw' is not recognized as an internal or external command.",
        exitCode: 1,
      },
    }),
    fetchImpl: async () => {
      throw new Error("connect ECONNREFUSED 127.0.0.1:18789");
    },
  });

  assert.equal(state.gatewayStatus, "not_installed");
  assert.equal(state.bridgeMode, "embedded_only");
  assert.equal(state.cliAvailable, false);
  assert.equal(state.controlUiReachable, false);
  assert.equal(state.desktopOwnsGatewayProcess, false);
  assert.equal(state.browserAutomationReady, false);
  assert.match(state.summary, /CLI was not detected/i);
  assert.ok(state.suggestedActions.some((action) => action.includes("npm install -g openclaw@latest")));
});

test("detectOpenClawBridgeState reports a running upstream gateway when CLI and Control UI both respond", async () => {
  const state = await detectOpenClawBridgeState({
    env: {},
    now: () => new Date("2026-03-19T09:05:00.000Z"),
    runCommand: commandRunnerFromMap({
      "--version": {
        stdout: "openclaw 2.4.1",
        stderr: "",
        exitCode: 0,
      },
      "gateway status --json": {
        stdout: JSON.stringify({ status: "running", gateway: "ready" }),
        stderr: "",
        exitCode: 0,
      },
      "status --json --timeout 3000": {
        stdout: JSON.stringify({ health: "ok", daemon: "ready" }),
        stderr: "",
        exitCode: 0,
      },
      "browser status --json": {
        stdout: JSON.stringify({ browser: "ready", tabs: 2 }),
        stderr: "",
        exitCode: 0,
      },
    }),
    fetchImpl: async () =>
      new Response("<html><body>OpenClaw</body></html>", {
        status: 200,
        headers: {
          "content-type": "text/html; charset=utf-8",
        },
      }),
  });

  assert.equal(state.gatewayStatus, "running");
  assert.equal(state.bridgeMode, "embedded_plus_openclaw");
  assert.equal(state.cliAvailable, true);
  assert.equal(state.controlUiReachable, true);
  assert.equal(state.desktopOwnsGatewayProcess, false);
  assert.equal(state.browserAutomationReady, true);
  assert.equal(state.cliVersion, "openclaw 2.4.1");
  assert.ok(state.capabilities.find((capability) => capability.id === "control_ui")?.available);
  assert.ok(state.capabilities.find((capability) => capability.id === "browser_automation")?.available);
});

test("detectOpenClawBridgeState reports unreachable when a manual gateway URL is configured but probes fail", async () => {
  const state = await detectOpenClawBridgeState({
    env: {
      OPENCLAW_CONTROL_UI_URL: "http://10.0.0.5:18789",
    },
    now: () => new Date("2026-03-19T09:10:00.000Z"),
    runCommand: commandRunnerFromMap({
      "--version": {
        stdout: "",
        stderr: "ENOENT",
        exitCode: 1,
      },
    }),
    fetchImpl: async () => {
      throw new Error("connect ECONNREFUSED 10.0.0.5:18789");
    },
  });

  assert.equal(state.gatewayStatus, "unreachable");
  assert.equal(state.bridgeMode, "embedded_only");
  assert.equal(state.controlUiUrl, "http://10.0.0.5:18789/");
  assert.ok(state.suggestedActions.some((action) => action.includes("10.0.0.5:18789")));
});

test("detectOpenClawBridgeState keeps browser automation disabled when the upstream browser tool is unavailable", async () => {
  const state = await detectOpenClawBridgeState({
    env: {},
    now: () => new Date("2026-03-19T09:15:00.000Z"),
    runCommand: commandRunnerFromMap({
      "--version": {
        stdout: "openclaw 2.4.1",
        stderr: "",
        exitCode: 0,
      },
      "gateway status --json": {
        stdout: JSON.stringify({ status: "running" }),
        stderr: "",
        exitCode: 0,
      },
      "status --json --timeout 3000": {
        stdout: JSON.stringify({ health: "ok" }),
        stderr: "",
        exitCode: 0,
      },
      "browser status --json": {
        stdout: JSON.stringify({ status: "disabled" }),
        stderr: "",
        exitCode: 0,
      },
    }),
    fetchImpl: async () =>
      new Response("<html><body>OpenClaw</body></html>", {
        status: 200,
        headers: {
          "content-type": "text/html",
        },
      }),
  });

  assert.equal(state.gatewayStatus, "running");
  assert.equal(state.browserAutomationReady, false);
  assert.equal(
    state.capabilities.find((capability) => capability.id === "browser_automation")?.available,
    false,
  );
});

test("detectOpenClawBridgeState surfaces missing bundled runtime without telling the user to install a global CLI", async () => {
  const state = await detectOpenClawBridgeState({
    env: {},
    cliFile: "D:\\missing\\openclaw.mjs",
    embeddedRuntimeAvailable: true,
    embeddedRuntimeVersion: "2026.3.13",
    desktopOwnsGatewayProcess: true,
    now: () => new Date("2026-03-19T09:20:00.000Z"),
    runCommand: commandRunnerFromMap({
      "--version": {
        stdout: "",
        stderr: "ENOENT",
        exitCode: 1,
      },
    }),
    fetchImpl: async () => {
      throw new Error("connect ECONNREFUSED 127.0.0.1:18789");
    },
  });

  assert.equal(state.embeddedRuntimeAvailable, true);
  assert.equal(state.embeddedRuntimeVersion, "2026.3.13");
  assert.equal(state.managedByDesktop, true);
  assert.equal(state.desktopOwnsGatewayProcess, true);
  assert.equal(state.gatewayStatus, "not_installed");
  assert.match(state.summary, /bundled OpenClaw runtime/i);
  assert.ok(state.notes.some((note) => note.includes("2026.3.13")));
  assert.ok(!state.suggestedActions.some((action) => action.includes("npm install -g openclaw")));
});

test("defaultCommandRunner executes JavaScript CLI entrypoints directly through a Node-compatible runtime", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "klava-openclaw-cli-"));
  const scriptPath = path.join(tempDir, "openclaw.mjs");

  try {
    await writeFile(
      scriptPath,
      "process.stdout.write(JSON.stringify({ args: process.argv.slice(2), electronRunAsNode: process.env.ELECTRON_RUN_AS_NODE ?? null }));\n",
      "utf8",
    );

    const result = await defaultCommandRunner(scriptPath, ["channels", "status", "--json"], 4_000);

    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /"channels"/);
    assert.match(result.stdout, /"status"/);
    assert.match(result.stdout, /"electronRunAsNode":"1"/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
