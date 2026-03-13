import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { LocalRuntimeAdvice, MachineProfile } from "@klava/contracts";
import { ComputerOperator } from "./computer-operator";
import { RuntimeLogger } from "./logging";
import type { AppPaths } from "./storage";

const TEST_MACHINE_PROFILE: MachineProfile = {
  detectedAt: "2026-03-13T00:00:00.000Z",
  platform: "win32",
  platformLabel: "Windows",
  osVersion: "11",
  architecture: "x64",
  cpuModel: "Test CPU",
  physicalCores: 8,
  logicalCores: 16,
  memoryGb: 32,
  gpus: [],
};

const TEST_LOCAL_ADVICE: LocalRuntimeAdvice = {
  verdict: "recommended",
  summary: "Local inference is supported.",
  reasons: ["Enough RAM is available."],
  recommendedRuntime: "ollama",
  cloudFallbackProvider: "openrouter",
  options: [
    {
      runtime: "ollama",
      recommended: true,
      summary: "Ollama is a good default.",
      reasons: ["Works locally."],
      apiBaseUrl: "http://127.0.0.1:11434/v1",
      modelRecommendation: {
        modelId: "qwen2.5:7b",
        summary: "Balanced local model.",
        rationale: "Good balance.",
        installCommand: "ollama pull qwen2.5:7b",
      },
    },
  ],
};

async function withTempLogger(run: (logger: RuntimeLogger) => Promise<void>) {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "klava-computer-operator-test-"));
  const paths: AppPaths = {
    rootDir: tempRoot,
    statePath: path.join(tempRoot, "state.json"),
    secretsPath: path.join(tempRoot, "secrets.json"),
    keyPath: path.join(tempRoot, "vault.key"),
  };

  try {
    await run(new RuntimeLogger(paths));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

test("driver investigation explains the installed driver, outranked candidates, and windows update state", async () => {
  await withTempLogger(async (logger) => {
    const operator = new ComputerOperator({
      machineProfile: TEST_MACHINE_PROFILE,
      localRuntimeAdvice: TEST_LOCAL_ADVICE,
      logger,
    }) as any;

    operator.queryPnpDevices = async () => [
      {
        Status: "OK",
        Class: "Mouse",
        FriendlyName: "HID-compliant mouse",
        InstanceId: "HID\\VID_A8A5&PID_2255&MI_00&COL01\\8&29555156&0&0000",
        Manufacturer: "Microsoft",
        Present: true,
      },
    ];
    operator.queryDriverRowsForDeviceIds = async () => [
      {
        DeviceName: "HID-compliant mouse",
        DeviceID: "HID\\VID_A8A5&PID_2255&MI_00&COL01\\8&29555156&0&0000",
        DriverVersion: "10.0.26100.1150",
        DriverProviderName: "Microsoft",
        DriverDate: "2006-06-21",
        InfName: "msmouse.inf",
        Manufacturer: "Microsoft",
        DeviceClass: "Mouse",
      },
    ];
    operator.queryPnPUtilDriverReports = async () => [
      {
        InstanceId: "HID\\VID_A8A5&PID_2255&MI_00&COL01\\8&29555156&0&0000",
        DeviceDescription: "HID-compliant mouse",
        ClassName: "Mouse",
        ManufacturerName: "Microsoft",
        Status: "Started",
        DriverName: "msmouse.inf",
        MatchingDrivers: [
          {
            DriverName: "msmouse.inf",
            ProviderName: "Microsoft",
            ClassName: "Mouse",
            DriverVersion: "06/21/2006 10.0.26100.1150",
            DriverStatus: "Best Ranked / Installed",
          },
          {
            DriverName: "input.inf",
            ProviderName: "Microsoft",
            ClassName: "HIDClass",
            DriverVersion: "06/21/2006 10.0.26100.7920",
            DriverStatus: "Outranked",
          },
        ],
      },
    ];
    operator.queryWindowsUpdateDriverSummary = async () => ({
      querySucceeded: true,
      resultCode: 2,
      availableDriverUpdates: 0,
    });

    const result = await operator.executeIntent({
      kind: "inspect_driver",
      skill: "driver_inspection",
      deviceCategory: "mouse",
      queryLatest: true,
    });

    assert.equal(result.kind, "answer");
    assert.equal(result.status, "succeeded");
    assert.match(result.assistantMessage, /msmouse\.inf 10\.0\.26100\.1150/i);
    assert.match(result.assistantMessage, /input\.inf 06\/21\/2006 10\.0\.26100\.7920/i);
    assert.match(result.assistantMessage, /outranked by the installed driver/i);
    assert.match(result.assistantMessage, /Windows Update does not currently report any pending driver updates/i);
    assert.match(result.assistantMessage, /I do not see a newer driver being offered right now/i);
  });
});

test("driver overview prioritizes broken devices before healthy graphics drivers", async () => {
  await withTempLogger(async (logger) => {
    const operator = new ComputerOperator({
      machineProfile: TEST_MACHINE_PROFILE,
      localRuntimeAdvice: TEST_LOCAL_ADVICE,
      logger,
    }) as any;

    operator.queryProblemDevices = async () => [
      {
        Name: "AMD USB 3.10 eXtensible Host Controller",
        Status: "Error",
        ConfigManagerErrorCode: 43,
        DeviceID: "PCI\\VEN_1022&DEV_1639",
        PNPClass: "USB",
        Manufacturer: "Advanced Micro Devices, Inc.",
        Service: "USBXHCI",
      },
    ];
    operator.queryDriverRowsForDeviceIds = async () => [
      {
        DeviceName: "AMD USB 3.10 eXtensible Host Controller",
        DeviceID: "PCI\\VEN_1022&DEV_1639",
        DriverVersion: "10.0.22621.3527",
        DriverProviderName: "Microsoft",
        DriverDate: "2025-12-11",
        InfName: "usbxhci.inf",
        Manufacturer: "Microsoft",
        DeviceClass: "USB",
      },
    ];
    operator.queryVideoControllerRows = async () => [
      {
        Name: "NVIDIA GeForce RTX 3070",
        DriverVersion: "32.0.15.9159",
        DriverDate: "2025-12-11",
      },
      {
        Name: "AMD Radeon(TM) Graphics",
        DriverVersion: "31.0.21924.61",
        DriverDate: "2025-12-11",
      },
    ];
    operator.queryWindowsUpdateDriverSummary = async () => ({
      querySucceeded: true,
      resultCode: 2,
      availableDriverUpdates: 1,
    });

    const result = await operator.executeIntent({
      kind: "driver_overview",
      skill: "driver_inspection",
      queryLatest: true,
    });

    assert.equal(result.kind, "answer");
    assert.equal(result.status, "succeeded");
    assert.match(result.assistantMessage, /Devices that currently need attention:/i);
    assert.match(result.assistantMessage, /AMD USB 3\.10 eXtensible Host Controller - error code 43/i);
    assert.match(result.assistantMessage, /usbxhci\.inf 10\.0\.22621\.3527/i);
    assert.match(result.assistantMessage, /Key graphics drivers currently installed:/i);
    assert.match(result.assistantMessage, /NVIDIA GeForce RTX 3070 - 32\.0\.15\.9159/i);
    assert.match(result.assistantMessage, /Update or reinstall the driver for AMD USB 3\.10 eXtensible Host Controller first/i);
  });
});
