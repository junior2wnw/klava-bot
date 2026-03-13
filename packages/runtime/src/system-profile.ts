import { execFile } from "node:child_process";
import os from "node:os";
import type { GpuDevice, LocalRuntimeAdvice, LocalRuntimeOption, LocalRuntime, MachineProfile } from "@klava/contracts";
import { DEFAULT_LOCAL_OLLAMA_BASE_URL, DEFAULT_LOCAL_VLLM_BASE_URL } from "./constants";

type ExecResult = {
  stdout: string;
  stderr: string;
};

function platformLabel(platform: NodeJS.Platform | string) {
  switch (platform) {
    case "win32":
      return "Windows";
    case "darwin":
      return "macOS";
    case "linux":
      return "Linux";
    default:
      return "Unknown platform";
  }
}

function roundMemoryGb(bytes: number) {
  return Math.round((bytes / 1024 / 1024 / 1024) * 10) / 10;
}

function safeJsonParse<T>(raw: string) {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function normalizeArray<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value;
  }

  return value ? [value] : [];
}

function detectGpuVendor(name: string, vendorHint = ""): GpuDevice["vendor"] {
  const source = `${name} ${vendorHint}`.toLowerCase();

  if (source.includes("nvidia") || source.includes("geforce") || source.includes("quadro") || source.includes("rtx")) {
    return "nvidia";
  }

  if (source.includes("amd") || source.includes("radeon")) {
    return "amd";
  }

  if (source.includes("intel") || source.includes("uhd") || source.includes("iris")) {
    return "intel";
  }

  if (source.includes("apple")) {
    return "apple";
  }

  return "unknown";
}

function isIntegratedGpu(name: string, vendor: GpuDevice["vendor"]) {
  const lowered = name.toLowerCase();

  if (vendor === "intel" || vendor === "apple") {
    return true;
  }

  return [
    "integrated",
    "uhd",
    "iris",
    "radeon graphics",
    "vega",
    "apu",
    "igpu",
  ].some((token) => lowered.includes(token));
}

function dedupeGpus(gpus: GpuDevice[]) {
  const seen = new Set<string>();
  return gpus.filter((gpu) => {
    const key = `${gpu.name.toLowerCase()}::${gpu.vendor}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function toGpuDevice(name: string, vendorHint = "", memoryBytes?: number | null) {
  const vendor = detectGpuVendor(name, vendorHint);
  return {
    name: name.trim(),
    vendor,
    integrated: isIntegratedGpu(name, vendor),
    memoryGb: typeof memoryBytes === "number" && memoryBytes > 0 ? roundMemoryGb(memoryBytes) : null,
  } satisfies GpuDevice;
}

function runFile(command: string, args: string[]) {
  return new Promise<ExecResult>((resolve, reject) => {
    const child = execFile(command, args, { timeout: 8_000, windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }

      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      });
    });

    child.on("error", reject);
  });
}

async function detectWindowsHardware() {
  const script = [
    "$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1 Name, NumberOfCores, NumberOfLogicalProcessors;",
    "$gpus = @(Get-CimInstance Win32_VideoController | Select-Object Name, AdapterCompatibility, AdapterRAM);",
    "@{ cpu = $cpu; gpus = $gpus } | ConvertTo-Json -Compress -Depth 4",
  ].join(" ");

  const encodedCommand = Buffer.from(script, "utf16le").toString("base64");
  const { stdout } = await runFile("powershell", [
    "-NoLogo",
    "-NoProfile",
    "-NonInteractive",
    "-EncodedCommand",
    encodedCommand,
  ]);
  return safeJsonParse<{
    cpu?: {
      Name?: string;
      NumberOfCores?: number;
      NumberOfLogicalProcessors?: number;
    };
    gpus?: Array<{
      Name?: string;
      AdapterCompatibility?: string;
      AdapterRAM?: number;
    }>;
  }>(stdout);
}

async function detectMacHardware() {
  const [hardwareResult, gpuResult, physicalCpuResult] = await Promise.allSettled([
    runFile("system_profiler", ["SPHardwareDataType", "-json"]),
    runFile("system_profiler", ["SPDisplaysDataType", "-json"]),
    runFile("sysctl", ["-n", "hw.physicalcpu"]),
  ]);

  const hardware =
    hardwareResult.status === "fulfilled"
      ? safeJsonParse<{ SPHardwareDataType?: Array<{ chip_type?: string; machine_model?: string }> }>(hardwareResult.value.stdout)
      : null;
  const displays =
    gpuResult.status === "fulfilled"
      ? safeJsonParse<{
          SPDisplaysDataType?: Array<{ _name?: string; sppci_model?: string; spdisplays_vram?: string; spdisplays_vendor?: string }>;
        }>(gpuResult.value.stdout)
      : null;
  const physicalCores =
    physicalCpuResult.status === "fulfilled" ? Number.parseInt(physicalCpuResult.value.stdout, 10) || null : null;

  const gpus = normalizeArray(displays?.SPDisplaysDataType).map((gpu) =>
    toGpuDevice(gpu.sppci_model ?? gpu._name ?? "Unknown GPU", gpu.spdisplays_vendor ?? "Apple", null),
  );

  return {
    cpuModel: normalizeArray(hardware?.SPHardwareDataType)[0]?.chip_type ?? os.cpus()[0]?.model ?? null,
    physicalCores,
    gpus,
  };
}

async function detectLinuxHardware() {
  const [nvidiaResult, lspciResult] = await Promise.allSettled([
    runFile("nvidia-smi", ["--query-gpu=name,memory.total", "--format=csv,noheader,nounits"]),
    runFile("sh", ["-lc", "lspci | grep -iE 'vga|3d|display'"]),
  ]);

  const gpus: GpuDevice[] = [];

  if (nvidiaResult.status === "fulfilled" && nvidiaResult.value.stdout) {
    for (const line of nvidiaResult.value.stdout.split(/\r?\n/)) {
      const [name, memoryMb] = line.split(",").map((part) => part.trim());
      if (!name) {
        continue;
      }

      const memoryBytes = memoryMb ? Number.parseFloat(memoryMb) * 1024 * 1024 : null;
      gpus.push(toGpuDevice(name, "NVIDIA", Number.isFinite(memoryBytes ?? NaN) ? memoryBytes : null));
    }
  }

  if (lspciResult.status === "fulfilled" && lspciResult.value.stdout) {
    for (const line of lspciResult.value.stdout.split(/\r?\n/)) {
      const name = line.split(": ").at(-1)?.trim();
      if (!name) {
        continue;
      }

      gpus.push(toGpuDevice(name));
    }
  }

  return {
    cpuModel: os.cpus()[0]?.model ?? null,
    physicalCores: null,
    gpus,
  };
}

export async function detectMachineProfile(): Promise<MachineProfile> {
  const baseProfile: MachineProfile = {
    detectedAt: new Date().toISOString(),
    platform: process.platform,
    platformLabel: platformLabel(process.platform),
    osVersion: `${os.release()} (${os.version?.() ?? "unknown"})`,
    architecture: os.arch(),
    cpuModel: os.cpus()[0]?.model ?? null,
    physicalCores: null,
    logicalCores: os.cpus().length || 1,
    memoryGb: roundMemoryGb(os.totalmem()),
    gpus: [],
  };

  try {
    if (process.platform === "win32") {
      const hardware = await detectWindowsHardware();
      return {
        ...baseProfile,
        cpuModel: hardware?.cpu?.Name?.trim() || baseProfile.cpuModel,
        physicalCores:
          typeof hardware?.cpu?.NumberOfCores === "number" && hardware.cpu.NumberOfCores > 0
            ? hardware.cpu.NumberOfCores
            : null,
        logicalCores:
          typeof hardware?.cpu?.NumberOfLogicalProcessors === "number" && hardware.cpu.NumberOfLogicalProcessors > 0
            ? hardware.cpu.NumberOfLogicalProcessors
            : baseProfile.logicalCores,
        gpus: dedupeGpus(
          normalizeArray(hardware?.gpus)
            .map((gpu) => {
              if (!gpu?.Name) {
                return null;
              }

              return toGpuDevice(
                gpu.Name,
                typeof gpu.AdapterCompatibility === "string" ? gpu.AdapterCompatibility : "",
                typeof gpu.AdapterRAM === "number" ? gpu.AdapterRAM : null,
              );
            })
            .filter((gpu): gpu is GpuDevice => gpu !== null),
        ),
      };
    }

    if (process.platform === "darwin") {
      const hardware = await detectMacHardware();
      return {
        ...baseProfile,
        cpuModel: hardware.cpuModel,
        physicalCores: hardware.physicalCores,
        gpus: dedupeGpus(hardware.gpus),
      };
    }

    const hardware = await detectLinuxHardware();
    return {
      ...baseProfile,
      cpuModel: hardware.cpuModel,
      physicalCores: hardware.physicalCores,
      gpus: dedupeGpus(hardware.gpus),
    };
  } catch {
    return baseProfile;
  }
}

function recommendOllamaModel(profile: MachineProfile) {
  const discreteGpu = profile.gpus.find((gpu) => !gpu.integrated);
  const discreteGpuMemoryGb = discreteGpu?.memoryGb ?? 0;

  if (discreteGpuMemoryGb >= 16 && profile.memoryGb >= 32) {
    return {
      modelId: "qwen2.5:14b",
      summary: "Best local quality tier that still fits on stronger prosumer hardware.",
      rationale: "Use a 14B instruct model when the machine has both headroom in system RAM and at least ~16 GB of discrete VRAM.",
      installCommand: "ollama pull qwen2.5:14b",
    };
  }

  if (discreteGpuMemoryGb >= 8 || profile.memoryGb >= 24) {
    return {
      modelId: "qwen2.5:7b",
      summary: "Balanced default for most developer workstations with a real discrete GPU or ample RAM.",
      rationale: "A 7B instruct model is the safest quality/performance midpoint for general chat and code assistance.",
      installCommand: "ollama pull qwen2.5:7b",
    };
  }

  return {
    modelId: "llama3.2:3b",
    summary: "Small fallback for integrated graphics or CPU-heavy laptops.",
    rationale: "A 3B model keeps latency and memory pressure under control when the machine is weaker or running without a strong discrete GPU.",
    installCommand: "ollama pull llama3.2:3b",
  };
}

function recommendVllmModel(profile: MachineProfile) {
  const discreteGpu = profile.gpus.find((gpu) => !gpu.integrated);
  const discreteGpuMemoryGb = discreteGpu?.memoryGb ?? 0;

  if (discreteGpuMemoryGb >= 16 && profile.memoryGb >= 32) {
    return {
      modelId: "Qwen/Qwen2.5-14B-Instruct",
      summary: "Good advanced vLLM target when the GPU is comfortably above the entry tier.",
      rationale: "vLLM is most useful when you can keep a stronger instruct model resident on a real discrete GPU.",
      installCommand:
        "python -m vllm.entrypoints.openai.api_server --model Qwen/Qwen2.5-14B-Instruct --host 127.0.0.1 --port 8000",
    };
  }

  return {
    modelId: "meta-llama/Llama-3.1-8B-Instruct",
    summary: "Safer vLLM baseline for a single-GPU workstation.",
    rationale: "An 8B instruct model is the lowest-friction vLLM baseline that still feels useful for local OpenAI-compatible chat.",
    installCommand:
      "python -m vllm.entrypoints.openai.api_server --model meta-llama/Llama-3.1-8B-Instruct --host 127.0.0.1 --port 8000",
  };
}

function buildLocalRuntimeOption(
  runtime: LocalRuntime,
  recommended: boolean,
  summary: string,
  reasons: string[],
  profile: MachineProfile,
): LocalRuntimeOption {
  return {
    runtime,
    recommended,
    summary,
    reasons,
    apiBaseUrl: runtime === "vllm" ? DEFAULT_LOCAL_VLLM_BASE_URL : DEFAULT_LOCAL_OLLAMA_BASE_URL,
    modelRecommendation: runtime === "vllm" ? recommendVllmModel(profile) : recommendOllamaModel(profile),
  };
}

export function analyzeLocalRuntime(profile: MachineProfile): LocalRuntimeAdvice {
  const discreteGpus = profile.gpus.filter((gpu) => !gpu.integrated);
  const strongestDiscreteGpu = [...discreteGpus].sort((left, right) => (right.memoryGb ?? 0) - (left.memoryGb ?? 0))[0];
  const discreteGpuMemoryGb = strongestDiscreteGpu?.memoryGb ?? 0;
  const hasDiscreteGpu = discreteGpus.length > 0;
  const isWindows = profile.platform === "win32";

  const commonReasons = [
    `System memory detected: ${profile.memoryGb.toFixed(1)} GB.`,
    hasDiscreteGpu
      ? `Discrete GPU detected: ${strongestDiscreteGpu?.name ?? "yes"}${discreteGpuMemoryGb > 0 ? ` (${discreteGpuMemoryGb.toFixed(1)} GB reported VRAM)` : ""}.`
      : "No discrete GPU was detected.",
  ];

  if (!hasDiscreteGpu && profile.memoryGb < 16) {
    return {
      verdict: "not_recommended",
      summary: "Local LLMs are possible here, but for a good first experience cloud free tiers are the smarter choice.",
      reasons: [
        ...commonReasons,
        "CPU-only local inference on less than 16 GB RAM will be slow and memory-constrained for a desktop assistant.",
      ],
      recommendedRuntime: null,
      cloudFallbackProvider: "gemini",
      options: [
        buildLocalRuntimeOption(
          "ollama",
          false,
          "Workable only for tiny models and patience-heavy testing.",
          [
            "Use this only if you specifically need offline smoke tests.",
            "Expect noticeably slower replies on CPU-only hardware.",
          ],
          profile,
        ),
        buildLocalRuntimeOption(
          "vllm",
          false,
          "Not recommended on this hardware tier.",
          [
            "vLLM is optimized for stronger GPU-backed serving, not low-memory CPU-first setups.",
            isWindows ? "Windows also makes the vLLM path harder than Ollama." : "The hardware headroom is the main blocker.",
          ],
          profile,
        ),
      ],
    };
  }

  if (!hasDiscreteGpu) {
    return {
      verdict: "workable",
      summary: "Local LLM use is viable, but stay on small Ollama models and treat vLLM as unnecessary complexity.",
      reasons: [
        ...commonReasons,
        "The machine has enough RAM for small quantized models, but no discrete GPU means latency will still be moderate to slow.",
      ],
      recommendedRuntime: "ollama",
      cloudFallbackProvider: "gemini",
      options: [
        buildLocalRuntimeOption(
          "ollama",
          true,
          "Recommended local path for CPU-only or integrated-GPU machines.",
          [
            "Ollama is much easier to install, update, and troubleshoot locally.",
            "Stay with 3B-class models first, then move up only if latency remains acceptable.",
          ],
          profile,
        ),
        buildLocalRuntimeOption(
          "vllm",
          false,
          "Advanced path without a matching hardware benefit.",
          [
            "vLLM adds setup cost without giving you much upside on integrated graphics.",
            isWindows ? "On Windows, Ollama is the significantly lower-friction choice." : "On this machine tier, Ollama is the better tradeoff.",
          ],
          profile,
        ),
      ],
    };
  }

  if (discreteGpuMemoryGb >= 12 && profile.memoryGb >= 24) {
    const vllmPreferred = !isWindows && discreteGpuMemoryGb >= 16 && profile.memoryGb >= 32;
    return {
      verdict: "recommended",
      summary: vllmPreferred
        ? "This machine is strong enough for serious local LLM work. Ollama is easy; vLLM is also worth considering."
        : "This machine is a good fit for local LLM work, with Ollama as the safest default.",
      reasons: [
        ...commonReasons,
        "There is enough headroom for practical local chat and coding models without immediately falling into toy-only territory.",
      ],
      recommendedRuntime: vllmPreferred ? "vllm" : "ollama",
      cloudFallbackProvider: "gemini",
      options: [
        buildLocalRuntimeOption(
          "ollama",
          !vllmPreferred,
          "Best default for a fast local setup with strong odds of working on the first try.",
          [
            "Ollama is easier to operate day-to-day and integrates cleanly with Klava's OpenAI-compatible local path.",
            "Start with the recommended model and only scale up after checking actual latency.",
          ],
          profile,
        ),
        buildLocalRuntimeOption(
          "vllm",
          vllmPreferred,
          vllmPreferred
            ? "Recommended advanced path if you want a dedicated local OpenAI-compatible serving stack."
            : "Viable, but not the first thing to choose on this OS/hardware mix.",
          [
            isWindows
              ? "vLLM is more operationally awkward on Windows, so Ollama remains the default recommendation."
              : "vLLM becomes attractive when you want a dedicated inference server rather than a simple desktop runner.",
            "Only choose vLLM if you are comfortable running and maintaining a local model server.",
          ],
          profile,
        ),
      ],
    };
  }

  return {
    verdict: "workable",
    summary: "Local LLM use should work, but stay conservative on model size and prefer Ollama over vLLM.",
    reasons: [
      ...commonReasons,
      "This machine has enough headroom for practical small-to-mid local models, but not enough margin for an aggressive setup.",
    ],
    recommendedRuntime: "ollama",
    cloudFallbackProvider: "gemini",
    options: [
      buildLocalRuntimeOption(
        "ollama",
        true,
        "Recommended local path for this machine tier.",
        [
          "Start with the suggested 7B or 3B model and only move upward after measuring latency.",
          "Ollama is the fastest route to a stable local connection for Klava.",
        ],
        profile,
      ),
      buildLocalRuntimeOption(
        "vllm",
        false,
        "Possible, but usually not worth the extra setup on this hardware tier.",
        [
          isWindows ? "Windows makes vLLM harder to operate than Ollama." : "The hardware headroom is better suited to Ollama first.",
          "Use vLLM only if you explicitly want a dedicated OpenAI-compatible inference server.",
        ],
        profile,
      ),
    ],
  };
}
