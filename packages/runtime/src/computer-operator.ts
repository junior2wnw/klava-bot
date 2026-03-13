import { spawn } from "node:child_process";
import os from "node:os";
import type { LocalRuntimeAdvice, MachineProfile } from "@klava/contracts";
import {
  detectComputerIntent,
  type ComputerIntent,
  type ComputerSkill,
  type DeviceCategory,
  type PackageAction,
  type SoftwareCatalogEntry,
} from "./computer-intents";
import { RuntimeLogger } from "./logging";

type CommandResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

type DriverRow = {
  DeviceName?: string | null;
  DeviceID?: string | null;
  DriverVersion?: string | null;
  DriverProviderName?: string | null;
  DriverDate?: string | null;
  InfName?: string | null;
  Manufacturer?: string | null;
  DeviceClass?: string | null;
};

type PnpDeviceRow = {
  Status?: string | null;
  Class?: string | null;
  FriendlyName?: string | null;
  InstanceId?: string | null;
  Manufacturer?: string | null;
  Present?: boolean | null;
};

type PnpUtilMatchingDriverRow = {
  DriverName?: string | null;
  ProviderName?: string | null;
  ClassName?: string | null;
  DriverVersion?: string | null;
  DriverStatus?: string | null;
  DriverRank?: string | null;
  SignerName?: string | null;
};

type PnpUtilDeviceReport = {
  InstanceId: string;
  DeviceDescription: string | null;
  ClassName: string | null;
  ManufacturerName: string | null;
  Status: string | null;
  DriverName: string | null;
  MatchingDrivers: PnpUtilMatchingDriverRow[];
};

type WindowsUpdateDriverSummary = {
  querySucceeded: boolean;
  resultCode: number | null;
  availableDriverUpdates: number;
};

type ProblemDeviceRow = {
  Name?: string | null;
  Status?: string | null;
  ConfigManagerErrorCode?: number | null;
  DeviceID?: string | null;
  PNPClass?: string | null;
  Manufacturer?: string | null;
  Service?: string | null;
};

type VideoControllerRow = {
  Name?: string | null;
  DriverVersion?: string | null;
  DriverDate?: string | null;
};

type InstalledSoftwareRow = {
  DisplayName?: string | null;
  DisplayVersion?: string | null;
  Publisher?: string | null;
  InstallDate?: string | null;
};

type DiskRow = {
  DeviceID?: string | null;
  VolumeName?: string | null;
  SizeGb?: number | null;
  FreeGb?: number | null;
};

type NetworkRow = {
  Description?: string | null;
  IPv4?: string | null;
  IPv6?: string | null;
  Gateway?: string | null;
  Dns?: string | null;
  MACAddress?: string | null;
};

type ProcessRow = {
  Name?: string | null;
  Id?: number | null;
  CPU?: number | null;
  StartTime?: string | null;
};

type ServiceRow = {
  Name?: string | null;
  DisplayName?: string | null;
  Status?: string | null;
  StartType?: string | null;
};

type StorageRow = {
  Model?: string | null;
  InterfaceType?: string | null;
  MediaType?: string | null;
  SizeGb?: number | null;
  SerialNumber?: string | null;
};

type CachedResult = {
  expiresAt: number;
  result: ComputerHandledResult;
};

export type ComputerHandledResult =
  | { kind: "not_handled" }
  | {
      kind: "answer";
      status: "succeeded" | "failed";
      skill: ComputerSkill;
      intent: ComputerIntent["kind"];
      toolMessage: string;
      assistantMessage: string;
    }
  | {
      kind: "command";
      skill: ComputerSkill;
      intent: ComputerIntent["kind"];
      toolMessage: string;
      assistantMessage: string;
      command: string;
    };

const JSON_TIMEOUT_MS = 20_000;
const COMMAND_TIMEOUT_MS = 10_000;
const CACHE_TTL_MS = 15_000;

const driverCategoryConfig: Record<
  DeviceCategory,
  {
    label: string;
    pnpClassName: string;
    devicePatterns: string[];
    classPatterns: string[];
  }
> = {
  mouse: {
    label: "mouse",
    pnpClassName: "Mouse",
    devicePatterns: ["mouse", "touchpad", "trackpad", "hid-compliant mouse"],
    classPatterns: ["mouse", "hidclass"],
  },
  keyboard: {
    label: "keyboard",
    pnpClassName: "Keyboard",
    devicePatterns: ["keyboard", "hid keyboard", "клавиатура"],
    classPatterns: ["keyboard", "hidclass"],
  },
  gpu: {
    label: "GPU/display",
    pnpClassName: "Display",
    devicePatterns: ["nvidia", "geforce", "radeon", "intel.*graphics", "display", "graphics", "video"],
    classPatterns: ["display"],
  },
  network: {
    label: "network adapter",
    pnpClassName: "Net",
    devicePatterns: ["ethernet", "wi-?fi", "wireless", "bluetooth", "realtek", "broadcom", "intel.*network"],
    classPatterns: ["net"],
  },
  audio: {
    label: "audio",
    pnpClassName: "MEDIA",
    devicePatterns: ["audio", "sound", "speaker", "microphone", "realtek audio"],
    classPatterns: ["media", "audio"],
  },
  bluetooth: {
    label: "bluetooth",
    pnpClassName: "Bluetooth",
    devicePatterns: ["bluetooth"],
    classPatterns: ["bluetooth", "net"],
  },
  storage: {
    label: "storage",
    pnpClassName: "DiskDrive",
    devicePatterns: ["nvme", "ssd", "sata", "storage", "disk", "ahci"],
    classPatterns: ["diskdrive", "hdc", "scsiadapter"],
  },
  camera: {
    label: "camera",
    pnpClassName: "Camera",
    devicePatterns: ["camera", "webcam", "imaging"],
    classPatterns: ["image", "camera"],
  },
  printer: {
    label: "printer",
    pnpClassName: "Printer",
    devicePatterns: ["printer", "print"],
    classPatterns: ["printer"],
  },
};

function escapePowerShellSingleQuoted(value: string) {
  return value.replace(/'/g, "''");
}

function toPowerShellArray(values: string[]) {
  return `@(${values.map((value) => `'${escapePowerShellSingleQuoted(value)}'`).join(", ")})`;
}

function asArray<T>(value: T | T[] | null | undefined) {
  if (!value) {
    return [] as T[];
  }

  return Array.isArray(value) ? value : [value];
}

function firstLine(value: string) {
  return (
    value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? "(no output)"
  );
}

function formatNumber(value: number | null | undefined, fractionDigits = 1) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "unknown";
  }

  return value.toFixed(fractionDigits);
}

function dedupeByKey<T>(items: T[], resolveKey: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = resolveKey(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function buildAssistantResult(
  skill: ComputerSkill,
  intent: ComputerIntent["kind"],
  toolMessage: string,
  assistantMessage: string,
  status: "succeeded" | "failed" = "succeeded",
): ComputerHandledResult {
  return {
    kind: "answer",
    skill,
    intent,
    toolMessage,
    assistantMessage,
    status,
  };
}

export class ComputerOperator {
  private readonly cache = new Map<string, CachedResult>();

  constructor(
    private readonly options: {
      machineProfile: MachineProfile;
      localRuntimeAdvice: LocalRuntimeAdvice;
      logger: RuntimeLogger;
    },
  ) {}

  async handle(input: string): Promise<ComputerHandledResult> {
    const intent = detectComputerIntent(input);
    if (!intent) {
      return { kind: "not_handled" };
    }

    const cacheKey = this.cacheKey(intent);
    if (cacheKey) {
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        await this.options.logger.log(`Computer skill cache hit. skill=${intent.skill} intent=${intent.kind}.`);
        return cached.result;
      }
    }

    await this.options.logger.log(`Computer skill matched. skill=${intent.skill} intent=${intent.kind}.`);

    try {
      const result = await this.executeIntent(intent);
      if (cacheKey && result.kind === "answer" && result.status === "succeeded") {
        this.cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, result });
      }
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown computer operator error";
      await this.options.logger.log(`Computer skill failed. skill=${intent.skill} intent=${intent.kind}. ${message}`);
      return buildAssistantResult(
        intent.skill,
        intent.kind,
        `Computer skill matched ${intent.kind}, but the local execution failed.`,
        `I understood this as a local computer action, but the local check failed: ${message}`,
        "failed",
      );
    }
  }

  async executeIntent(intent: ComputerIntent): Promise<ComputerHandledResult> {
    switch (intent.kind) {
      case "computer_capabilities":
        return this.describeCapabilities(intent);
      case "inspect_driver":
        return this.inspectDrivers(intent);
      case "driver_overview":
        return this.inspectDriverOverview(intent);
      case "software_version":
        return this.inspectSoftwareVersion(intent);
      case "installed_software":
        return this.inspectInstalledSoftware(intent);
      case "system_summary":
        return this.inspectSystemSummary(intent);
      case "disk_usage":
        return this.inspectDiskUsage(intent);
      case "network_summary":
        return this.inspectNetworkSummary(intent);
      case "process_lookup":
        return this.inspectProcess(intent);
      case "service_lookup":
        return this.inspectService(intent);
      case "storage_devices":
        return this.inspectStorageDevices(intent);
      case "local_runtime_advice":
        return this.inspectLocalRuntimeAdvice(intent);
      case "package_action":
        return this.preparePackageAction(intent);
      default:
        return { kind: "not_handled" };
    }
  }

  async describeCapabilities(intent: Extract<ComputerIntent, { kind: "computer_capabilities" }>) {
    const assistantMessage = [
      "I can route common computer tasks directly in the local runtime instead of sending them to the model.",
      "",
      "Currently wired skills:",
      "- driver checks for mouse, keyboard, GPU/display, network, audio, bluetooth, storage, camera, and printer",
      "- installed app and version checks for common tools like Git, Docker, VS Code, Node.js, Python, PowerShell, Ollama, Chrome, Edge, and Firefox",
      "- disk usage, storage-device summary, network summary, process checks, and service status",
      "- local-AI suitability advice based on this machine profile",
      "- package install, upgrade, and uninstall for known Windows packages through guarded winget commands",
    ].join("\n");

    return buildAssistantResult(
      intent.skill,
      intent.kind,
      "Computer capability overview requested.",
      assistantMessage,
    );
  }

  async inspectSystemSummary(intent: Extract<ComputerIntent, { kind: "system_summary" }>) {
    const profile = this.options.machineProfile;
    const gpuLine =
      profile.gpus.length > 0
        ? profile.gpus.map((gpu) => `${gpu.name}${gpu.memoryGb ? ` (${gpu.memoryGb.toFixed(1)} GB)` : ""}`).join("; ")
        : "No GPU details detected";

    const assistantMessage = [
      "System summary for this machine:",
      `- OS: ${profile.platformLabel} ${profile.osVersion} (${profile.architecture})`,
      `- CPU: ${profile.cpuModel ?? "Unknown CPU"}; ${profile.logicalCores} logical cores${profile.physicalCores ? `, ${profile.physicalCores} physical cores` : ""}`,
      `- Memory: ${formatNumber(profile.memoryGb)} GB RAM`,
      `- GPU: ${gpuLine}`,
      `- Hostname: ${os.hostname()}`,
    ].join("\n");

    return buildAssistantResult(intent.skill, intent.kind, "Collected a local machine summary.", assistantMessage);
  }

  async inspectLocalRuntimeAdvice(intent: Extract<ComputerIntent, { kind: "local_runtime_advice" }>) {
    const advice = this.options.localRuntimeAdvice;
    const recommendedOption = advice.options.find((option) => option.recommended) ?? advice.options[0] ?? null;
    const assistantMessage = [
      `Local AI verdict: ${advice.verdict}.`,
      advice.summary,
      "",
      ...advice.reasons.map((reason) => `- ${reason}`),
      recommendedOption
        ? `- Recommended runtime: ${recommendedOption.runtime} (${recommendedOption.apiBaseUrl})`
        : "- No local runtime is recommended for this machine profile.",
      recommendedOption?.modelRecommendation
        ? `- Recommended model: ${recommendedOption.modelRecommendation.modelId} - ${recommendedOption.modelRecommendation.summary}`
        : "- No local model recommendation is available right now.",
      advice.cloudFallbackProvider ? `- Cloud fallback: ${advice.cloudFallbackProvider}` : "- No cloud fallback selected.",
      recommendedOption?.modelRecommendation?.installCommand
        ? `- Install hint: ${recommendedOption.modelRecommendation.installCommand}`
        : "- No install command was attached to the recommendation.",
    ].join("\n");

    return buildAssistantResult(
      intent.skill,
      intent.kind,
      "Reported local-runtime advice from the machine profile analysis.",
      assistantMessage,
    );
  }

  buildWingetCommand(action: PackageAction, software: SoftwareCatalogEntry) {
    if (!software.wingetId) {
      throw new Error(`No safe exact winget package id is configured for ${software.displayName}.`);
    }

    if (action === "install") {
      return `winget install --id ${software.wingetId} --exact --accept-package-agreements --accept-source-agreements --disable-interactivity`;
    }

    if (action === "upgrade") {
      return `winget upgrade --id ${software.wingetId} --exact --accept-package-agreements --accept-source-agreements --disable-interactivity`;
    }

    return `winget uninstall --id ${software.wingetId} --exact --disable-interactivity`;
  }

  async preparePackageAction(intent: Extract<ComputerIntent, { kind: "package_action" }>) {
    this.assertWindowsCapability("package management");
    return {
      kind: "command",
      skill: intent.skill,
      intent: intent.kind,
      toolMessage: `Matched a package-management request for ${intent.software.displayName}.`,
      assistantMessage:
        `I matched this to a local Windows package action for ${intent.software.displayName}. ` +
        "The exact command is ready and will go through guard approval if your task is not in off mode.",
      command: this.buildWingetCommand(intent.action, intent.software),
    } satisfies ComputerHandledResult;
  }

  async inspectDrivers(intent: Extract<ComputerIntent, { kind: "inspect_driver" }>) {
    this.assertWindowsCapability("driver inspection");
    const config = driverCategoryConfig[intent.deviceCategory];
    const devices = await this.queryPnpDevices(config.pnpClassName);
    const activeDevices = this.prioritizeActiveDevices(devices);
    const deviceIds = (activeDevices.length ? activeDevices : devices)
      .map((device) => device.InstanceId?.trim() ?? "")
      .filter((value) => value.length > 0);
    const rows = deviceIds.length
      ? await this.queryDriverRowsForDeviceIds(deviceIds)
      : await this.queryDriverRows(config.devicePatterns, config.classPatterns);
    const pnputilReports = await this.queryPnPUtilDriverReports(config.pnpClassName);
    const relevantReports = this.filterRelevantDriverReports(pnputilReports, deviceIds);
    const updateSummary = intent.queryLatest ? await this.queryWindowsUpdateDriverSummary() : null;

    if (!rows.length && !relevantReports.length && !activeDevices.length) {
      return buildAssistantResult(
        intent.skill,
        intent.kind,
        `Investigated local ${config.label} drivers through Windows device inventory and driver ranking.`,
        `I investigated the local ${config.label} devices, but I did not find an active device or driver match on this machine.`,
        "failed",
      );
    }

    const activeDriverSummary = this.summarizeActiveDriverRows(rows, activeDevices, relevantReports);
    const outrankedSummary = this.summarizeOutrankedDriverCandidates(relevantReports);
    const updateSummaryLines = updateSummary ? this.describeWindowsUpdateDriverSummary(updateSummary) : [];

    const assistantMessage = [
      `I checked the local ${config.label} path through Windows device inventory, driver ranking, and local update state.`,
      "",
      activeDriverSummary.length
        ? "Active devices and installed drivers:"
        : `I found ${config.label} driver evidence, but not a clean active-device mapping.`,
      ...activeDriverSummary,
      ...(outrankedSummary.length ? ["", "Other matching driver packages present but not installed:", ...outrankedSummary] : []),
      ...(updateSummaryLines.length ? ["", "Windows Update:", ...updateSummaryLines] : []),
      "",
      ...this.buildDriverConclusion(config.label, rows, outrankedSummary, updateSummary, intent.queryLatest),
    ].join("\n");

    return buildAssistantResult(
      intent.skill,
      intent.kind,
      `Investigated local ${config.label} drivers using Get-PnpDevice, Win32_PnPSignedDriver, pnputil, and Windows Update state.`,
      assistantMessage,
    );
  }

  async inspectDriverOverview(intent: Extract<ComputerIntent, { kind: "driver_overview" }>) {
    this.assertWindowsCapability("driver inspection");
    const problemDevices = await this.queryProblemDevices();
    const problemDeviceIds = problemDevices
      .map((device) => device.DeviceID?.trim() ?? "")
      .filter((value) => value.length > 0);
    const problemDriverRows = problemDeviceIds.length ? await this.queryDriverRowsForDeviceIds(problemDeviceIds) : [];
    const graphicsRows = await this.queryVideoControllerRows();
    const updateSummary = intent.queryLatest ? await this.queryWindowsUpdateDriverSummary() : null;

    const problemLines = this.describeProblemDevices(problemDevices, problemDriverRows);
    const graphicsLines = this.describeVideoControllers(graphicsRows);
    const updateSummaryLines = updateSummary ? this.describeWindowsUpdateDriverSummary(updateSummary) : [];
    const assistantMessage = [
      "I audited the local driver state using Windows device health, signed-driver inventory, key graphics-driver versions, and Windows Update.",
      "",
      "Devices that currently need attention:",
      ...(problemLines.length ? problemLines : ["- I do not currently see Plug and Play devices with a non-zero ConfigManagerErrorCode."]),
      "",
      "Key graphics drivers currently installed:",
      ...(graphicsLines.length ? graphicsLines : ["- No graphics controller rows were returned by Win32_VideoController."]),
      ...(updateSummaryLines.length ? ["", "Windows Update:", ...updateSummaryLines] : []),
      "",
      "Priority recommendation:",
      ...this.buildDriverOverviewRecommendation(problemDevices, graphicsRows, updateSummary),
    ].join("\n");

    return buildAssistantResult(
      intent.skill,
      intent.kind,
      "Audited local driver health across problem devices, key graphics drivers, and Windows Update state.",
      assistantMessage,
    );
  }

  async inspectSoftwareVersion(intent: Extract<ComputerIntent, { kind: "software_version" }>) {
    const cliVersions: string[] = [];
    for (const check of intent.software.versionChecks) {
      const result = await this.tryRunProgram(check.command, check.args);
      if (result) {
        cliVersions.push(check.label ? `${check.label}: ${result}` : result);
      }
    }

    const installedRows = await this.queryInstalledSoftware(intent.software.registryPatterns, 6);
    if (!cliVersions.length && !installedRows.length) {
      return buildAssistantResult(
        intent.skill,
        intent.kind,
        `Checked ${intent.software.displayName} version information.`,
        `${intent.software.displayName} was not detected through the usual CLI or installed-app inventory on this machine.`,
        "failed",
      );
    }

    const assistantMessage = [
      `${intent.software.displayName} status on this machine:`,
      ...cliVersions.map((line) => `- CLI: ${line}`),
      ...installedRows.slice(0, 3).map((row) => {
        const version = row.DisplayVersion?.trim() || "unknown version";
        const publisher = row.Publisher?.trim() ? `, publisher ${row.Publisher.trim()}` : "";
        return `- Installed app: ${row.DisplayName?.trim() || intent.software.displayName} ${version}${publisher}`;
      }),
      intent.queryLatest
        ? "- I checked the installed local version only; I did not compare it to the vendor's latest online release."
        : "",
    ]
      .filter((line) => line.length > 0)
      .join("\n");

    return buildAssistantResult(
      intent.skill,
      intent.kind,
      `Collected local version signals for ${intent.software.displayName}.`,
      assistantMessage,
    );
  }

  async inspectInstalledSoftware(intent: Extract<ComputerIntent, { kind: "installed_software" }>) {
    const rows = await this.queryInstalledSoftware(intent.software?.registryPatterns ?? [], 25);
    if (!rows.length) {
      return buildAssistantResult(
        intent.skill,
        intent.kind,
        "Queried the installed-software inventory.",
        intent.software
          ? `I did not find installed entries matching ${intent.software.displayName}.`
          : "I queried the installed-software inventory, but no entries were returned.",
        "failed",
      );
    }

    const title = intent.software
      ? `Installed entries matching ${intent.software.displayName}:`
      : "Installed applications (first 25 entries):";
    const assistantMessage = [
      title,
      ...rows.map((row, index) => {
        const name = row.DisplayName?.trim() || "Unknown app";
        const version = row.DisplayVersion?.trim() ? ` ${row.DisplayVersion.trim()}` : "";
        const publisher = row.Publisher?.trim() ? ` by ${row.Publisher.trim()}` : "";
        return `${index + 1}. ${name}${version}${publisher}`;
      }),
    ].join("\n");

    return buildAssistantResult(intent.skill, intent.kind, "Queried the installed application inventory.", assistantMessage);
  }

  async inspectDiskUsage(intent: Extract<ComputerIntent, { kind: "disk_usage" }>) {
    this.assertWindowsCapability("disk usage inspection");
    const disks = await this.queryDiskUsage();
    if (!disks.length) {
      return buildAssistantResult(
        intent.skill,
        intent.kind,
        "Queried local disk usage.",
        "I queried local disk usage, but no fixed disks were returned.",
        "failed",
      );
    }

    const assistantMessage = [
      "Fixed-disk usage:",
      ...disks.map((disk) => {
        const size = typeof disk.SizeGb === "number" ? disk.SizeGb : 0;
        const free = typeof disk.FreeGb === "number" ? disk.FreeGb : 0;
        const percentFree = size > 0 ? `${((free / size) * 100).toFixed(1)}% free` : "free space unknown";
        return `- ${disk.DeviceID ?? "?"}${disk.VolumeName ? ` (${disk.VolumeName})` : ""}: ${formatNumber(free)} GB free of ${formatNumber(size)} GB (${percentFree})`;
      }),
    ].join("\n");

    return buildAssistantResult(intent.skill, intent.kind, "Collected fixed-disk usage from Windows.", assistantMessage);
  }

  async inspectNetworkSummary(intent: Extract<ComputerIntent, { kind: "network_summary" }>) {
    if (process.platform === "win32") {
      const rows = await this.queryNetworkRows();
      if (!rows.length) {
        return buildAssistantResult(
          intent.skill,
          intent.kind,
          "Queried active network adapters.",
          "I checked the active network adapters, but I did not get any IP-enabled adapter rows back.",
          "failed",
        );
      }

      const assistantMessage = [
        "Active network adapters:",
        ...rows.slice(0, 5).map((row) => {
          const dns = row.Dns?.trim() ? `, DNS ${row.Dns.trim()}` : "";
          const gateway = row.Gateway?.trim() ? `, gateway ${row.Gateway.trim()}` : "";
          const ipv4 = row.IPv4?.trim() ? `IPv4 ${row.IPv4.trim()}` : "no IPv4";
          return `- ${row.Description?.trim() || "Adapter"}: ${ipv4}${row.IPv6?.trim() ? `, IPv6 ${row.IPv6.trim()}` : ""}${gateway}${dns}`;
        }),
      ].join("\n");

      return buildAssistantResult(intent.skill, intent.kind, "Collected active network configuration.", assistantMessage);
    }

    const interfaces = os.networkInterfaces();
    const lines = Object.entries(interfaces)
      .map(([name, addresses]) => {
        const formatted = (addresses ?? [])
          .filter((address) => !address.internal)
          .map((address) => `${address.family} ${address.address}`)
          .join(", ");
        return formatted ? `- ${name}: ${formatted}` : null;
      })
      .filter((line): line is string => Boolean(line));

    return buildAssistantResult(
      intent.skill,
      intent.kind,
      "Collected active network interfaces from the local OS.",
      lines.length ? `Active network interfaces:\n${lines.join("\n")}` : "No external network interfaces were detected.",
      lines.length ? "succeeded" : "failed",
    );
  }

  async inspectProcess(intent: Extract<ComputerIntent, { kind: "process_lookup" }>) {
    this.assertWindowsCapability("process inspection");
    const rows = await this.queryProcessRows(intent.software.processNames);
    if (!rows.length) {
      return buildAssistantResult(
        intent.skill,
        intent.kind,
        `Checked running processes for ${intent.software.displayName}.`,
        `${intent.software.displayName} does not appear to be running right now.`,
      );
    }

    const assistantMessage = [
      `${intent.software.displayName} is running.`,
      `- Matching processes: ${rows.length}`,
      ...rows.slice(0, 5).map((row) => {
        const cpu = typeof row.CPU === "number" ? `, CPU ${row.CPU.toFixed(2)}` : "";
        return `- ${row.Name ?? "process"} (PID ${row.Id ?? "?"}${cpu}${row.StartTime ? `, started ${row.StartTime}` : ""})`;
      }),
    ].join("\n");

    return buildAssistantResult(
      intent.skill,
      intent.kind,
      `Checked running process list for ${intent.software.displayName}.`,
      assistantMessage,
    );
  }

  async inspectService(intent: Extract<ComputerIntent, { kind: "service_lookup" }>) {
    this.assertWindowsCapability("service inspection");
    const serviceNames = intent.software?.serviceNames.length ? intent.software.serviceNames : [];
    const rows = await this.queryServiceRows(serviceNames, intent.query);
    if (!rows.length) {
      const target = intent.software?.displayName ?? intent.query ?? "the requested service";
      return buildAssistantResult(
        intent.skill,
        intent.kind,
        "Queried Windows services.",
        `I queried Windows services, but I did not find a match for ${target}.`,
        "failed",
      );
    }

    const assistantMessage = [
      "Service status:",
      ...rows.slice(0, 8).map((row) => {
        return `- ${row.DisplayName?.trim() || row.Name?.trim() || "Unknown service"} (${row.Name?.trim() || "?"}) - ${row.Status?.trim() || "unknown"}${row.StartType?.trim() ? `, startup ${row.StartType.trim()}` : ""}`;
      }),
    ].join("\n");

    return buildAssistantResult(intent.skill, intent.kind, "Collected Windows service status.", assistantMessage);
  }

  async inspectStorageDevices(intent: Extract<ComputerIntent, { kind: "storage_devices" }>) {
    this.assertWindowsCapability("storage-device inspection");
    const rows = await this.queryStorageRows();
    if (!rows.length) {
      return buildAssistantResult(
        intent.skill,
        intent.kind,
        "Queried physical storage devices.",
        "I queried the physical storage devices, but no disk rows came back.",
        "failed",
      );
    }

    const assistantMessage = [
      "Physical storage devices:",
      ...rows.slice(0, 6).map((row) => {
        const model = row.Model?.trim() || "Unknown disk";
        const interfaceType = row.InterfaceType?.trim() || "unknown bus";
        const media = row.MediaType?.trim() || "unknown media";
        return `- ${model} - ${media}, ${interfaceType}, ${formatNumber(row.SizeGb)} GB${row.SerialNumber?.trim() ? `, serial ${row.SerialNumber.trim()}` : ""}`;
      }),
    ].join("\n");

    return buildAssistantResult(intent.skill, intent.kind, "Collected physical storage device details.", assistantMessage);
  }

  private prioritizeActiveDevices(devices: PnpDeviceRow[]) {
    const active = devices.filter((device) => {
      const status = device.Status?.trim().toLowerCase();
      return status === "ok" || status === "started" || device.Present === true;
    });

    return active.length ? active : devices;
  }

  private filterRelevantDriverReports(reports: PnpUtilDeviceReport[], deviceIds: string[]) {
    if (deviceIds.length === 0) {
      return reports;
    }

    const deviceIdSet = new Set(deviceIds.map((value) => value.toLowerCase()));
    const filtered = reports.filter((report) => deviceIdSet.has(report.InstanceId.toLowerCase()));
    return filtered.length ? filtered : reports;
  }

  private summarizeActiveDriverRows(
    rows: DriverRow[],
    activeDevices: PnpDeviceRow[],
    reports: PnpUtilDeviceReport[],
  ) {
    const activeById = new Map(activeDevices.map((device) => [device.InstanceId?.toLowerCase() ?? "", device]));
    const reportById = new Map(reports.map((report) => [report.InstanceId.toLowerCase(), report]));
    const relevantRows: DriverRow[] = rows.length
      ? rows
      : reports.map((report) => ({
          DeviceName: report.DeviceDescription,
          DeviceID: report.InstanceId,
          InfName: report.DriverName,
        }));

    const summarized = relevantRows.slice(0, 8).map((row) => {
      const deviceId = row.DeviceID?.trim() ?? "";
      const device = activeById.get(deviceId.toLowerCase());
      const report = reportById.get(deviceId.toLowerCase());
      const name = device?.FriendlyName?.trim() || row.DeviceName?.trim() || report?.DeviceDescription?.trim() || "Unknown device";
      const provider = row.DriverProviderName?.trim() || row.Manufacturer?.trim() || report?.ManufacturerName?.trim() || "unknown provider";
      const version = row.DriverVersion?.trim() || this.extractInstalledVersionFromReport(report) || "unknown version";
      const inf = row.InfName?.trim() || report?.DriverName?.trim() || "unknown INF";
      const status = report?.Status?.trim() ? `, status ${report.Status.trim().toLowerCase()}` : "";
      const date = row.DriverDate?.trim() ? `, date ${row.DriverDate.trim()}` : "";
      return {
        key: `${name}|${inf}|${version}|${provider}|${status}|${date}`,
        name,
        inf,
        version,
        provider,
        status,
        date,
      };
    });

    const grouped = summarized.reduce<Array<(typeof summarized)[number] & { count: number }>>((accumulator, item) => {
      const existing = accumulator.find((candidate) => candidate.key === item.key);
      if (existing) {
        existing.count += 1;
        return accumulator;
      }

      accumulator.push({ ...item, count: 1 });
      return accumulator;
    }, []);

    return grouped.slice(0, 5).map((item, index) => {
      const countSuffix = item.count > 1 ? ` x${item.count}` : "";
      return `${index + 1}. ${item.name}${countSuffix} - ${item.inf} ${item.version} by ${item.provider}${item.date}${item.status}`;
    });
  }

  private summarizeOutrankedDriverCandidates(reports: PnpUtilDeviceReport[]) {
    const candidates = reports.flatMap((report) =>
      report.MatchingDrivers.filter((driver) => (driver.DriverStatus ?? "").toLowerCase().includes("outranked")).map((driver) => ({
        instanceId: report.InstanceId,
        driverName: driver.DriverName?.trim() || "unknown",
        driverVersion: driver.DriverVersion?.trim() || "unknown version",
        providerName: driver.ProviderName?.trim() || "unknown provider",
      })),
    );

    return dedupeByKey(candidates, (candidate) => `${candidate.driverName}|${candidate.driverVersion}|${candidate.providerName}`)
      .slice(0, 5)
      .map(
        (candidate, index) =>
          `${index + 1}. ${candidate.driverName} ${candidate.driverVersion} by ${candidate.providerName} (present, but outranked by the installed driver)`,
      );
  }

  private describeWindowsUpdateDriverSummary(summary: WindowsUpdateDriverSummary) {
    if (!summary.querySucceeded) {
      return ["I could not complete the Windows Update driver check from the local COM API."];
    }

    if (summary.availableDriverUpdates === 0) {
      return ["Windows Update does not currently report any pending driver updates."];
    }

    return [
      `Windows Update currently reports ${summary.availableDriverUpdates} pending driver update${summary.availableDriverUpdates === 1 ? "" : "s"} in the local scan.`,
      "That means I cannot guarantee the current driver is the newest one available through Windows Update without a deeper per-update match.",
    ];
  }

  private buildDriverConclusion(
    label: string,
    rows: DriverRow[],
    outrankedSummary: string[],
    updateSummary: WindowsUpdateDriverSummary | null,
    queryLatest: boolean,
  ) {
    const primary = rows[0];
    const primaryVersion = primary?.DriverVersion?.trim() || "unknown version";
    const primaryInf = primary?.InfName?.trim() || "the installed INF";
    const lines = [
      `Conclusion: the active ${label} driver currently selected by Windows is ${primaryInf} ${primaryVersion}.`,
    ];

    if (outrankedSummary.length > 0) {
      lines.push("The higher-numbered generic package you may see in raw driver listings is not necessarily the active driver; pnputil marked at least one alternative as outranked.");
    }

    if (queryLatest && updateSummary?.querySucceeded && updateSummary.availableDriverUpdates === 0) {
      lines.push("From the Windows-managed path, I do not see a newer driver being offered right now.");
    } else if (queryLatest) {
      lines.push("This still does not prove that the hardware vendor site has no newer OEM-specific driver outside Windows Update.");
    }

    return lines;
  }

  private extractInstalledVersionFromReport(report: PnpUtilDeviceReport | undefined) {
    const best = report?.MatchingDrivers.find((driver) =>
      (driver.DriverStatus ?? "").toLowerCase().includes("best ranked"),
    );
    return best?.DriverVersion?.trim() || null;
  }

  private cacheKey(intent: ComputerIntent) {
    switch (intent.kind) {
      case "inspect_driver":
        return `${intent.kind}:${intent.deviceCategory}:${intent.queryLatest}`;
      case "driver_overview":
        return `${intent.kind}:${intent.queryLatest}`;
      case "software_version":
        return `${intent.kind}:${intent.software.key}:${intent.queryLatest}`;
      case "installed_software":
        return `${intent.kind}:${intent.software?.key ?? "all"}`;
      case "system_summary":
      case "disk_usage":
      case "network_summary":
      case "storage_devices":
      case "local_runtime_advice":
      case "computer_capabilities":
        return intent.kind;
      case "process_lookup":
        return `${intent.kind}:${intent.software.key}`;
      case "service_lookup":
        return `${intent.kind}:${intent.software?.key ?? ""}:${intent.query ?? ""}`;
      default:
        return null;
    }
  }

  private assertWindowsCapability(label: string) {
    if (process.platform !== "win32") {
      throw new Error(`${label} is currently implemented for Windows hosts in this build.`);
    }
  }

  private async queryDriverRows(devicePatterns: string[], classPatterns: string[]) {
    const script = [
      "$ErrorActionPreference = 'Stop'",
      "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
      `$devicePatterns = ${toPowerShellArray(devicePatterns)}`,
      `$classPatterns = ${toPowerShellArray(classPatterns)}`,
      "$drivers = Get-CimInstance Win32_PnPSignedDriver | Where-Object {",
      "  $deviceName = [string]$_.DeviceName",
      "  $deviceClass = [string]$_.DeviceClass",
      "  $match = $false",
      "  foreach ($pattern in $devicePatterns) { if ($deviceName -match $pattern) { $match = $true; break } }",
      "  if (-not $match) { foreach ($pattern in $classPatterns) { if ($deviceClass -match $pattern) { $match = $true; break } } }",
      "  $match",
      "} | Select-Object DeviceName, DeviceID, DriverVersion, DriverProviderName, @{Name='DriverDate';Expression={ if ($_.DriverDate) { try { (Get-Date $_.DriverDate).ToString('yyyy-MM-dd') } catch { [string]$_.DriverDate } } else { $null } }}, InfName, Manufacturer, DeviceClass",
      "$drivers | ConvertTo-Json -Depth 4 -Compress",
    ].join("; ");

    const rows = await this.runPowerShellJson<DriverRow>(script);
    return dedupeByKey(rows, (row) => `${row.DeviceID ?? row.DeviceName ?? ""}|${row.DriverVersion ?? ""}`);
  }

  private async queryPnpDevices(className: string) {
    const script = [
      "$ErrorActionPreference = 'Stop'",
      "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
      `Get-PnpDevice -Class '${escapePowerShellSingleQuoted(className)}' -ErrorAction SilentlyContinue | Select-Object Status, Class, FriendlyName, InstanceId, Manufacturer, Present | ConvertTo-Json -Depth 4 -Compress`,
    ].join("; ");

    const rows = await this.runPowerShellJson<PnpDeviceRow>(script);
    return dedupeByKey(rows, (row) => (row.InstanceId ?? "").toLowerCase());
  }

  private async queryDriverRowsForDeviceIds(deviceIds: string[]) {
    const script = [
      "$ErrorActionPreference = 'Stop'",
      "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
      `$ids = ${toPowerShellArray(deviceIds)}`,
      "Get-CimInstance Win32_PnPSignedDriver | Where-Object { $ids -contains $_.DeviceID } | Select-Object DeviceName, DeviceID, DriverVersion, DriverProviderName, @{Name='DriverDate';Expression={ if ($_.DriverDate) { try { (Get-Date $_.DriverDate).ToString('yyyy-MM-dd') } catch { [string]$_.DriverDate } } else { $null } }}, InfName, Manufacturer, DeviceClass | ConvertTo-Json -Depth 4 -Compress",
    ].join("; ");

    const rows = await this.runPowerShellJson<DriverRow>(script);
    return dedupeByKey(rows, (row) => `${row.DeviceID ?? row.DeviceName ?? ""}|${row.DriverVersion ?? ""}`);
  }

  private async queryPnPUtilDriverReports(className: string) {
    const script = [
      "$ErrorActionPreference = 'Stop'",
      "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
      `$raw = & pnputil /enum-devices /class '${escapePowerShellSingleQuoted(className)}' /drivers 2>&1 | Out-String -Width 4096`,
      "$raw",
    ].join("; ");
    const result = await this.runProcess(
      "powershell",
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
      30_000,
    );
    if (result.exitCode !== 0) {
      throw new Error(firstLine(`${result.stdout}\n${result.stderr}`));
    }

    return this.parsePnpUtilDriverReports(result.stdout);
  }

  private async queryWindowsUpdateDriverSummary(): Promise<WindowsUpdateDriverSummary> {
    const script = [
      "$ErrorActionPreference = 'Stop'",
      "$session = New-Object -ComObject Microsoft.Update.Session",
      "$searcher = $session.CreateUpdateSearcher()",
      "$result = $searcher.Search(\"IsInstalled=0 and Type='Driver'\")",
      "[PSCustomObject]@{ ResultCode = [int]$result.ResultCode; Updates = $result.Updates.Count } | ConvertTo-Json -Compress",
    ].join("; ");

    try {
      const [summary] = await this.runPowerShellJson<{ ResultCode?: number; Updates?: number }>(script, 75_000);
      return {
        querySucceeded: true,
        resultCode: typeof summary?.ResultCode === "number" ? summary.ResultCode : null,
        availableDriverUpdates: typeof summary?.Updates === "number" ? summary.Updates : 0,
      };
    } catch {
      return {
        querySucceeded: false,
        resultCode: null,
        availableDriverUpdates: 0,
      };
    }
  }

  private async queryProblemDevices() {
    const script = [
      "$ErrorActionPreference = 'Stop'",
      "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
      "Get-CimInstance Win32_PnPEntity | Where-Object { $_.ConfigManagerErrorCode -ne 0 } | Select-Object Name, Status, ConfigManagerErrorCode, DeviceID, PNPClass, Manufacturer, Service | ConvertTo-Json -Depth 4 -Compress",
    ].join("; ");

    const rows = await this.runPowerShellJson<ProblemDeviceRow>(script);
    return dedupeByKey(rows, (row) => `${row.DeviceID ?? row.Name ?? ""}|${row.ConfigManagerErrorCode ?? ""}`);
  }

  private async queryVideoControllerRows() {
    const script = [
      "$ErrorActionPreference = 'Stop'",
      "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
      "Get-CimInstance Win32_VideoController | Select-Object Name, DriverVersion, @{Name='DriverDate';Expression={ if ($_.DriverDate) { try { (Get-Date $_.DriverDate).ToString('yyyy-MM-dd') } catch { [string]$_.DriverDate } } else { $null } }} | ConvertTo-Json -Depth 4 -Compress",
    ].join("; ");

    const rows = await this.runPowerShellJson<VideoControllerRow>(script);
    return dedupeByKey(rows, (row) => `${row.Name ?? ""}|${row.DriverVersion ?? ""}`);
  }

  private describeProblemDevices(problemDevices: ProblemDeviceRow[], problemDriverRows: DriverRow[]) {
    const driverById = new Map(problemDriverRows.map((row) => [(row.DeviceID ?? "").toLowerCase(), row]));
    return problemDevices.slice(0, 8).map((device, index) => {
      const deviceId = device.DeviceID?.trim() ?? "";
      const driver = driverById.get(deviceId.toLowerCase());
      const name = device.Name?.trim() || "Unknown device";
      const code = typeof device.ConfigManagerErrorCode === "number" ? device.ConfigManagerErrorCode : null;
      const codeText = code === null ? "unknown problem code" : `error code ${code}`;
      const status = device.Status?.trim() ? `, status ${device.Status.trim().toLowerCase()}` : "";
      const pnpClass = device.PNPClass?.trim() ? `, class ${device.PNPClass.trim()}` : "";
      const inf = driver?.InfName?.trim() ? `, INF ${driver.InfName.trim()}` : "";
      const version = driver?.DriverVersion?.trim() ? ` ${driver.DriverVersion.trim()}` : "";
      const provider = driver?.DriverProviderName?.trim() || device.Manufacturer?.trim() || null;
      const providerText = provider ? `, provider ${provider}` : "";
      const service = device.Service?.trim() ? `, service ${device.Service.trim()}` : "";
      const hint = code !== null ? ` (${this.describeConfigManagerError(code)})` : "";
      return `${index + 1}. ${name} - ${codeText}${hint}${status}${pnpClass}${inf}${version}${providerText}${service}`;
    });
  }

  private describeVideoControllers(rows: VideoControllerRow[]) {
    return rows.slice(0, 5).map((row, index) => {
      const name = row.Name?.trim() || "Unknown graphics controller";
      const version = row.DriverVersion?.trim() || "unknown version";
      const date = row.DriverDate?.trim() ? `, date ${row.DriverDate.trim()}` : "";
      return `${index + 1}. ${name} - ${version}${date}`;
    });
  }

  private buildDriverOverviewRecommendation(
    problemDevices: ProblemDeviceRow[],
    graphicsRows: VideoControllerRow[],
    updateSummary: WindowsUpdateDriverSummary | null,
  ) {
    const firstProblem = problemDevices[0];
    if (firstProblem) {
      const label = firstProblem.Name?.trim() || "the top problem device";
      const lines = [`- Update or reinstall the driver for ${label} first, because it is currently reporting a device problem in Windows.`];

      if ((firstProblem.PNPClass ?? "").toLowerCase().includes("usb") || /usb/i.test(firstProblem.Name ?? "")) {
        lines.push("- For a USB controller problem, prefer the motherboard or OEM chipset/USB package before generic driver packs.");
      }

      if (graphicsRows.length > 0) {
        lines.push("- I do not currently see a local failure signal on the active graphics drivers, so they are lower priority than the broken device above.");
      }

      if (updateSummary?.querySucceeded && updateSummary.availableDriverUpdates > 0) {
        lines.push("- Windows Update still reports pending driver updates, so check that queue after fixing the broken device.");
      }

      lines.push("- This is still a local-only conclusion; the hardware vendor site can carry a newer OEM-specific package than Windows.");
      return lines;
    }

    if (updateSummary?.querySucceeded && updateSummary.availableDriverUpdates > 0) {
      return [
        "- I do not see a broken Plug and Play device locally, but Windows Update does report pending driver updates.",
        "- Start with the pending Windows Update driver items, then verify whether any vendor-specific package is still newer.",
      ];
    }

    return [
      "- I do not currently see a broken Plug and Play device or a pending Windows Update driver item that clearly demands attention.",
      "- If you want a stricter check, the next step is a vendor-specific pass for GPU, chipset, Wi-Fi, audio, and motherboard drivers.",
    ];
  }

  private describeConfigManagerError(code: number) {
    switch (code) {
      case 1:
        return "device is not configured correctly";
      case 10:
        return "device cannot start";
      case 14:
        return "device needs a restart";
      case 22:
        return "device is disabled";
      case 28:
        return "driver is not installed";
      case 31:
        return "Windows cannot load the required drivers";
      case 43:
        return "device reported a failure after it started";
      default:
        return "Windows reports a device problem";
    }
  }

  private parsePnpUtilDriverReports(output: string) {
    const reports: PnpUtilDeviceReport[] = [];
    const lines = output.split(/\r?\n/).map((line) => line.trimEnd());
    let current: PnpUtilDeviceReport | null = null;
    let currentDriver: PnpUtilMatchingDriverRow | null = null;
    let inMatchingDrivers = false;

    const pushCurrentDriver = () => {
      if (current && currentDriver && (currentDriver.DriverName ?? "").trim().length > 0) {
        current.MatchingDrivers.push(currentDriver);
      }
      currentDriver = null;
    };

    const pushCurrentReport = () => {
      pushCurrentDriver();
      if (current) {
        reports.push(current);
      }
      current = null;
      inMatchingDrivers = false;
    };

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      if (trimmed.startsWith("Instance ID:")) {
        pushCurrentReport();
        current = {
          InstanceId: trimmed.slice("Instance ID:".length).trim(),
          DeviceDescription: null,
          ClassName: null,
          ManufacturerName: null,
          Status: null,
          DriverName: null,
          MatchingDrivers: [],
        };
        continue;
      }

      if (!current) {
        continue;
      }

      if (trimmed === "Matching Drivers:") {
        inMatchingDrivers = true;
        continue;
      }

      const separatorIndex = trimmed.indexOf(":");
      if (separatorIndex <= 0) {
        continue;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim();

      if (!inMatchingDrivers) {
        if (key === "Device Description") {
          current.DeviceDescription = value || null;
        } else if (key === "Class Name") {
          current.ClassName = value || null;
        } else if (key === "Manufacturer Name") {
          current.ManufacturerName = value || null;
        } else if (key === "Status") {
          current.Status = value || null;
        } else if (key === "Driver Name") {
          current.DriverName = value || null;
        }
        continue;
      }

      if (key === "Driver Name") {
        pushCurrentDriver();
        currentDriver = { DriverName: value || null };
        continue;
      }

      if (!currentDriver) {
        continue;
      }

      if (key === "Provider Name") {
        currentDriver.ProviderName = value || null;
      } else if (key === "Class Name") {
        currentDriver.ClassName = value || null;
      } else if (key === "Driver Version") {
        currentDriver.DriverVersion = value || null;
      } else if (key === "Driver Status") {
        currentDriver.DriverStatus = value || null;
      } else if (key === "Driver Rank") {
        currentDriver.DriverRank = value || null;
      } else if (key === "Signer Name") {
        currentDriver.SignerName = value || null;
      }
    }

    pushCurrentReport();
    return reports;
  }

  private async queryInstalledSoftware(patterns: string[], limit: number) {
    if (process.platform !== "win32") {
      return [] as InstalledSoftwareRow[];
    }

    const filteringScript =
      patterns.length > 0
        ? [
            `$patterns = ${toPowerShellArray(patterns)}`,
            "$items = $items | Where-Object {",
            "  $name = [string]$_.DisplayName",
            "  $match = $false",
            "  foreach ($pattern in $patterns) { if ($name -like ('*' + $pattern + '*')) { $match = $true; break } }",
            "  $match",
            "}",
          ].join("; ")
        : "";

    const script = [
      "$ErrorActionPreference = 'Stop'",
      "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
      "$paths = @(",
      "  'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',",
      "  'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',",
      "  'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'",
      ")",
      "$items = Get-ItemProperty $paths -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName } | Select-Object DisplayName, DisplayVersion, Publisher, InstallDate",
      filteringScript,
      `$items = $items | Sort-Object DisplayName | Select-Object -First ${Math.max(1, limit)}`,
      "$items | ConvertTo-Json -Depth 4 -Compress",
    ]
      .filter((part) => part.length > 0)
      .join("; ");

    const rows = await this.runPowerShellJson<InstalledSoftwareRow>(script);
    return dedupeByKey(rows, (row) => (row.DisplayName ?? "").toLowerCase());
  }

  private async queryDiskUsage() {
    const script = [
      "$ErrorActionPreference = 'Stop'",
      "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
      "Get-CimInstance Win32_LogicalDisk -Filter \"DriveType=3\" | Select-Object DeviceID, VolumeName, @{Name='SizeGb';Expression={[math]::Round($_.Size / 1GB, 1)}}, @{Name='FreeGb';Expression={[math]::Round($_.FreeSpace / 1GB, 1)}} | ConvertTo-Json -Depth 4 -Compress",
    ].join("; ");

    return this.runPowerShellJson<DiskRow>(script);
  }

  private async queryNetworkRows() {
    const script = [
      "$ErrorActionPreference = 'Stop'",
      "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
      "Get-CimInstance Win32_NetworkAdapterConfiguration -Filter \"IPEnabled=TRUE\" | Select-Object Description, @{Name='IPv4';Expression={ ($_.IPAddress | Where-Object { $_ -match '^\\d+\\.' } | Select-Object -First 1) }}, @{Name='IPv6';Expression={ ($_.IPAddress | Where-Object { $_ -match ':' } | Select-Object -First 1) }}, @{Name='Gateway';Expression={ ($_.DefaultIPGateway | Select-Object -First 1) }}, @{Name='Dns';Expression={ ($_.DNSServerSearchOrder -join ', ') }}, MACAddress | ConvertTo-Json -Depth 4 -Compress",
    ].join("; ");

    return this.runPowerShellJson<NetworkRow>(script);
  }

  private async queryProcessRows(processNames: string[]) {
    if (processNames.length === 0) {
      return [] as ProcessRow[];
    }

    const script = [
      "$ErrorActionPreference = 'Stop'",
      "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
      `$targets = ${toPowerShellArray(processNames)}`,
      "Get-Process -ErrorAction SilentlyContinue | Where-Object { $targets -contains $_.ProcessName } | Select-Object Name, Id, CPU, @{Name='StartTime';Expression={ try { $_.StartTime.ToString('s') } catch { $null } }} | ConvertTo-Json -Depth 4 -Compress",
    ].join("; ");

    return this.runPowerShellJson<ProcessRow>(script);
  }

  private async queryServiceRows(serviceNames: string[], query: string | null) {
    const exactNames = serviceNames.filter((value) => value.trim().length > 0);
    const wildcard = query?.trim() ? query.trim() : null;
    if (exactNames.length === 0 && !wildcard) {
      return [] as ServiceRow[];
    }

    const conditions: string[] = [];

    if (exactNames.length > 0) {
      conditions.push("$names -contains $_.Name");
    }

    if (wildcard) {
      const escaped = escapePowerShellSingleQuoted(wildcard);
      conditions.push(`$_.Name -like '*${escaped}*' -or $_.DisplayName -like '*${escaped}*'`);
    }

    const whereClause = conditions.length > 0 ? conditions.join(" -or ") : "$true";
    const script = [
      "$ErrorActionPreference = 'Stop'",
      "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
      exactNames.length > 0 ? `$names = ${toPowerShellArray(exactNames)}` : "",
      `Get-Service | Where-Object { ${whereClause} } | Select-Object Name, DisplayName, Status, StartType | ConvertTo-Json -Depth 4 -Compress`,
    ]
      .filter((part) => part.length > 0)
      .join("; ");

    return this.runPowerShellJson<ServiceRow>(script);
  }

  private async queryStorageRows() {
    const script = [
      "$ErrorActionPreference = 'Stop'",
      "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
      "Get-CimInstance Win32_DiskDrive | Select-Object Model, InterfaceType, MediaType, @{Name='SizeGb';Expression={[math]::Round($_.Size / 1GB, 1)}}, SerialNumber | ConvertTo-Json -Depth 4 -Compress",
    ].join("; ");

    return this.runPowerShellJson<StorageRow>(script);
  }

  private async runPowerShellJson<T>(script: string, timeoutMs = JSON_TIMEOUT_MS) {
    const result = await this.runProcess(
      "powershell",
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
      timeoutMs,
    );

    if (result.exitCode !== 0) {
      throw new Error(firstLine(`${result.stdout}\n${result.stderr}`));
    }

    const output = result.stdout.trim();
    if (!output) {
      return [] as T[];
    }

    try {
      return asArray(JSON.parse(output) as T | T[]);
    } catch (error) {
      throw new Error(
        `Failed to parse local PowerShell output as JSON. ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async tryRunProgram(command: string, args: string[]) {
    const result = await this.runProcess(command, args, COMMAND_TIMEOUT_MS);
    if (result.exitCode !== 0) {
      return null;
    }

    const output = firstLine(`${result.stdout}\n${result.stderr}`);
    return output === "(no output)" ? null : output;
  }

  private runProcess(file: string, args: string[], timeoutMs: number): Promise<CommandResult> {
    return new Promise((resolve) => {
      const child = spawn(file, args, {
        windowsHide: true,
        env: process.env,
      });

      let stdout = "";
      let stderr = "";
      let settled = false;
      let timedOut = false;

      const finish = (result: CommandResult) => {
        if (settled) {
          return;
        }
        settled = true;
        resolve(result);
      };

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

      child.on("error", (error) => {
        clearTimeout(timeout);
        finish({
          stdout,
          stderr: `${stderr}\n${error.message}`.trim(),
          exitCode: 1,
        });
      });

      child.on("close", (code) => {
        clearTimeout(timeout);
        finish({
          stdout,
          stderr: timedOut ? `${stderr}\nCommand timed out after ${timeoutMs}ms.`.trim() : stderr,
          exitCode: timedOut ? 124 : code ?? 1,
        });
      });
    });
  }
}
