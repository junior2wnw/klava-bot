export type ComputerSkill =
  | "computer_capabilities"
  | "driver_inspection"
  | "software_version"
  | "installed_software"
  | "system_summary"
  | "disk_usage"
  | "network_summary"
  | "process_lookup"
  | "service_lookup"
  | "storage_devices"
  | "local_runtime_advice"
  | "package_management";

export type PackageAction = "install" | "upgrade" | "uninstall";

export type DeviceCategory =
  | "mouse"
  | "keyboard"
  | "gpu"
  | "network"
  | "audio"
  | "bluetooth"
  | "storage"
  | "camera"
  | "printer";

export type VersionCheck = {
  command: string;
  args: string[];
  label?: string;
};

export type SoftwareCatalogEntry = {
  key: string;
  displayName: string;
  aliases: string[];
  registryPatterns: string[];
  processNames: string[];
  serviceNames: string[];
  versionChecks: VersionCheck[];
  wingetId: string | null;
};

type BaseComputerIntent<K extends string, S extends ComputerSkill> = {
  kind: K;
  skill: S;
};

export type ComputerIntent =
  | (BaseComputerIntent<"computer_capabilities", "computer_capabilities"> & {})
  | (BaseComputerIntent<"inspect_driver", "driver_inspection"> & {
      deviceCategory: DeviceCategory;
      queryLatest: boolean;
    })
  | (BaseComputerIntent<"driver_overview", "driver_inspection"> & {
      queryLatest: boolean;
    })
  | (BaseComputerIntent<"software_version", "software_version"> & {
      software: SoftwareCatalogEntry;
      queryLatest: boolean;
    })
  | (BaseComputerIntent<"installed_software", "installed_software"> & {
      software: SoftwareCatalogEntry | null;
    })
  | (BaseComputerIntent<"system_summary", "system_summary"> & {})
  | (BaseComputerIntent<"disk_usage", "disk_usage"> & {})
  | (BaseComputerIntent<"network_summary", "network_summary"> & {})
  | (BaseComputerIntent<"process_lookup", "process_lookup"> & {
      software: SoftwareCatalogEntry;
    })
  | (BaseComputerIntent<"service_lookup", "service_lookup"> & {
      software: SoftwareCatalogEntry | null;
      query: string | null;
    })
  | (BaseComputerIntent<"storage_devices", "storage_devices"> & {})
  | (BaseComputerIntent<"local_runtime_advice", "local_runtime_advice"> & {})
  | (BaseComputerIntent<"package_action", "package_management"> & {
      action: PackageAction;
      software: SoftwareCatalogEntry;
    });

const installKeywords = [
  "install",
  "setup",
  "add",
  "set up",
  "установи",
  "установить",
  "поставь",
  "поставить",
  "инсталлируй",
];

const upgradeKeywords = ["update", "upgrade", "refresh", "обнови", "обновить", "апдейтни"];

const uninstallKeywords = ["uninstall", "remove", "delete", "удали", "удалить", "снеси", "деинсталлируй"];

const driverKeywords = ["driver", "drivers", "драйвер", "драйвера", "драйверы"];
const latestKeywords = ["latest", "newest", "current latest", "последн", "свеж", "актуальн", "самый новый"];
const updateAdviceKeywords = [
  "should i update",
  "should update",
  "need to update",
  "do i need to update",
  "worth updating",
  "worth an update",
  "надо обнов",
  "нужно обнов",
  "стоит обнов",
];
const driverOverviewKeywords = [
  "какие драйвера",
  "какие драйверы",
  "какой драйвер",
  "what drivers",
  "which drivers",
  "problem driver",
  "driver problem",
  "ошибк",
  "проблем",
  "неисправ",
  "стоит обнов",
  "нужно обнов",
  "надо обнов",
];
const versionKeywords = [
  "version",
  "build",
  "какая версия",
  "версия",
  "обновлен",
  "обновлён",
  "установлен",
  "установлена",
  "установлено",
];
const installedSoftwareKeywords = [
  "installed software",
  "installed apps",
  "installed programs",
  "what is installed",
  "show installed",
  "программы",
  "приложения",
  "что установлено",
  "что стоит",
];
const processKeywords = [
  "process",
  "running",
  "running now",
  "процесс",
  "запущен",
  "запущена",
  "запущены",
  "работает ли",
];
const serviceKeywords = ["service", "services", "служба", "службы", "сервис"];

const softwareCatalog: SoftwareCatalogEntry[] = [
  {
    key: "git",
    displayName: "Git",
    aliases: ["git", "git for windows"],
    registryPatterns: ["Git", "Git for Windows"],
    processNames: ["git"],
    serviceNames: [],
    versionChecks: [{ command: "git", args: ["--version"] }],
    wingetId: "Git.Git",
  },
  {
    key: "vscode",
    displayName: "Visual Studio Code",
    aliases: ["visual studio code", "vs code", "vscode"],
    registryPatterns: ["Visual Studio Code", "VS Code"],
    processNames: ["Code"],
    serviceNames: [],
    versionChecks: [{ command: "code", args: ["--version"], label: "code" }],
    wingetId: "Microsoft.VisualStudioCode",
  },
  {
    key: "chrome",
    displayName: "Google Chrome",
    aliases: ["google chrome", "chrome", "гугл хром", "хром"],
    registryPatterns: ["Google Chrome"],
    processNames: ["chrome"],
    serviceNames: [],
    versionChecks: [],
    wingetId: "Google.Chrome",
  },
  {
    key: "edge",
    displayName: "Microsoft Edge",
    aliases: ["microsoft edge", "edge", "эдж"],
    registryPatterns: ["Microsoft Edge"],
    processNames: ["msedge"],
    serviceNames: [],
    versionChecks: [],
    wingetId: "Microsoft.Edge",
  },
  {
    key: "firefox",
    displayName: "Mozilla Firefox",
    aliases: ["mozilla firefox", "firefox", "фаерфокс", "файрфокс"],
    registryPatterns: ["Mozilla Firefox", "Firefox"],
    processNames: ["firefox"],
    serviceNames: [],
    versionChecks: [],
    wingetId: "Mozilla.Firefox",
  },
  {
    key: "docker",
    displayName: "Docker Desktop",
    aliases: ["docker desktop", "docker", "докер"],
    registryPatterns: ["Docker Desktop", "Docker"],
    processNames: ["Docker Desktop", "com.docker.backend"],
    serviceNames: ["com.docker.service"],
    versionChecks: [{ command: "docker", args: ["--version"] }],
    wingetId: "Docker.DockerDesktop",
  },
  {
    key: "ollama",
    displayName: "Ollama",
    aliases: ["ollama", "оллама"],
    registryPatterns: ["Ollama"],
    processNames: ["ollama", "ollama app"],
    serviceNames: ["ollama"],
    versionChecks: [{ command: "ollama", args: ["--version"] }],
    wingetId: "Ollama.Ollama",
  },
  {
    key: "nodejs",
    displayName: "Node.js",
    aliases: ["node.js", "nodejs", "node"],
    registryPatterns: ["Node.js"],
    processNames: ["node"],
    serviceNames: [],
    versionChecks: [
      { command: "node", args: ["--version"] },
      { command: "npm", args: ["--version"], label: "npm" },
    ],
    wingetId: "OpenJS.NodeJS.LTS",
  },
  {
    key: "python",
    displayName: "Python",
    aliases: ["python", "python3", "питон"],
    registryPatterns: ["Python", "Python Launcher"],
    processNames: ["python", "py"],
    serviceNames: [],
    versionChecks: [
      { command: "python", args: ["--version"] },
      { command: "py", args: ["-V"], label: "py" },
    ],
    wingetId: null,
  },
  {
    key: "powershell",
    displayName: "PowerShell",
    aliases: ["powershell", "pwsh", "повершелл"],
    registryPatterns: ["PowerShell"],
    processNames: ["powershell", "pwsh"],
    serviceNames: [],
    versionChecks: [
      { command: "pwsh", args: ["--version"] },
      { command: "powershell", args: ["-NoLogo", "-NoProfile", "-Command", "$PSVersionTable.PSVersion.ToString()"] },
    ],
    wingetId: "Microsoft.PowerShell",
  },
  {
    key: "winget",
    displayName: "Windows Package Manager",
    aliases: ["winget", "windows package manager"],
    registryPatterns: ["Windows Package Manager"],
    processNames: ["winget"],
    serviceNames: [],
    versionChecks: [{ command: "winget", args: ["--version"] }],
    wingetId: null,
  },
  {
    key: "7zip",
    displayName: "7-Zip",
    aliases: ["7 zip", "7-zip", "7zip"],
    registryPatterns: ["7-Zip"],
    processNames: ["7zFM", "7zG"],
    serviceNames: [],
    versionChecks: [],
    wingetId: "7zip.7zip",
  },
  {
    key: "notepadpp",
    displayName: "Notepad++",
    aliases: ["notepad++", "notepad plus plus"],
    registryPatterns: ["Notepad++"],
    processNames: ["notepad++"],
    serviceNames: [],
    versionChecks: [],
    wingetId: "Notepad++.Notepad++",
  },
];

const driverTargets: Array<{ category: DeviceCategory; aliases: string[] }> = [
  { category: "mouse", aliases: ["mouse", "мыш", "мышь", "мыши", "touchpad", "тачпад"] },
  { category: "keyboard", aliases: ["keyboard", "клавиатур", "клава"] },
  { category: "gpu", aliases: ["gpu", "video", "display", "graphics", "график", "видеокарт", "nvidia", "radeon"] },
  { category: "network", aliases: ["network", "wifi", "wi-fi", "ethernet", "сет", "lan", "adapter"] },
  { category: "audio", aliases: ["audio", "sound", "speaker", "микрофон", "звук", "наушник"] },
  { category: "bluetooth", aliases: ["bluetooth", "блютуз"] },
  { category: "storage", aliases: ["storage", "disk", "ssd", "nvme", "hdd", "накопител", "диск"] },
  { category: "camera", aliases: ["camera", "webcam", "камера", "вебкам"] },
  { category: "printer", aliases: ["printer", "принтер"] },
];

function normalizeInput(input: string) {
  return input
    .toLowerCase()
    .replace(/[“”"']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsAny(input: string, values: string[]) {
  return values.some((value) => input.includes(value));
}

function matchToken(input: string, token: string) {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, "iu").test(input);
}

function containsWholePhrase(input: string, phrase: string) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, "iu").test(input);
}

function includesAlias(input: string, alias: string) {
  if (/^[a-z0-9.+-]{1,6}$/i.test(alias)) {
    return matchToken(input, alias);
  }

  return input.includes(alias);
}

function pickSoftware(input: string) {
  const ranked = softwareCatalog
    .map((entry) => ({
      entry,
      score: Math.max(...entry.aliases.map((alias) => (includesAlias(input, alias) ? alias.length : -1))),
    }))
    .filter((candidate) => candidate.score >= 0)
    .sort((left, right) => right.score - left.score);

  return ranked[0]?.entry ?? null;
}

function pickDriverCategory(input: string) {
  const match = driverTargets
    .map((target) => ({
      category: target.category,
      score: Math.max(...target.aliases.map((alias) => (input.includes(alias) ? alias.length : -1))),
    }))
    .filter((candidate) => candidate.score >= 0)
    .sort((left, right) => right.score - left.score)[0];

  return match?.category ?? null;
}

function extractServiceQuery(input: string) {
  const match =
    input.match(/(?:service|служб[аы]|сервис)\s+([a-z0-9_.-]{2,40})/iu) ??
    input.match(/(?:status of|статус)\s+([a-z0-9_.-]{2,40})\s+(?:service|служб[аы]|сервис)/iu);
  return match?.[1]?.trim() ?? null;
}

export function listComputerSoftware() {
  return softwareCatalog;
}

export function detectComputerIntent(input: string): ComputerIntent | null {
  const normalized = normalizeInput(input);
  const software = pickSoftware(normalized);
  const wantsLatest = containsAny(normalized, latestKeywords);
  const wantsUpdateAdvice =
    containsAny(normalized, updateAdviceKeywords) ||
    /(?:should|need|worth)(?:\s+\w+){0,4}\s+update/iu.test(normalized) ||
    /(?:надо|нужно|стоит)(?:\s+\S+){0,4}\s+обнов/iu.test(normalized);
  const packageInstall = installKeywords.some((keyword) => containsWholePhrase(normalized, keyword));
  const packageUpgrade = upgradeKeywords.some((keyword) => containsWholePhrase(normalized, keyword));
  const packageUninstall = uninstallKeywords.some((keyword) => containsWholePhrase(normalized, keyword));

  if (
    containsAny(normalized, ["что умеешь", "what can you do", "computer help", "помощь по компьютеру", "что можешь"]) &&
    containsAny(normalized, ["комп", "computer", "pc", "windows", "систем"])
  ) {
    return {
      kind: "computer_capabilities",
      skill: "computer_capabilities",
    };
  }

  if ((packageInstall || packageUpgrade || packageUninstall) && software?.wingetId) {
    return {
      kind: "package_action",
      skill: "package_management",
      action: packageInstall ? "install" : packageUpgrade ? "upgrade" : "uninstall",
      software,
    };
  }

  if (containsAny(normalized, driverKeywords)) {
    const deviceCategory = pickDriverCategory(normalized);
    if (deviceCategory) {
      return {
        kind: "inspect_driver",
        skill: "driver_inspection",
        deviceCategory,
        queryLatest: wantsLatest || wantsUpdateAdvice,
      };
    }

    if (wantsLatest || wantsUpdateAdvice || containsAny(normalized, driverOverviewKeywords)) {
      return {
        kind: "driver_overview",
        skill: "driver_inspection",
        queryLatest: true,
      };
    }
  }

  if (containsAny(normalized, serviceKeywords)) {
    return {
      kind: "service_lookup",
      skill: "service_lookup",
      software,
      query: extractServiceQuery(normalized),
    };
  }

  if (software && containsAny(normalized, processKeywords)) {
    return {
      kind: "process_lookup",
      skill: "process_lookup",
      software,
    };
  }

  if (software && containsAny(normalized, versionKeywords)) {
    return {
      kind: "software_version",
      skill: "software_version",
      software,
      queryLatest: wantsLatest,
    };
  }

  if (software && containsAny(normalized, installedSoftwareKeywords)) {
    return {
      kind: "installed_software",
      skill: "installed_software",
      software,
    };
  }

  if (containsAny(normalized, installedSoftwareKeywords)) {
    return {
      kind: "installed_software",
      skill: "installed_software",
      software: null,
    };
  }

  if (
    containsAny(normalized, ["ollama", "vllm", "llama", "local model", "local ai", "локальн", "локальная модель"]) &&
    containsAny(normalized, ["стоит", "можно", "use", "run", "запуск", "потянет", "пойдет"])
  ) {
    return {
      kind: "local_runtime_advice",
      skill: "local_runtime_advice",
    };
  }

  if (containsAny(normalized, ["ssd", "nvme", "hdd", "physical disk", "storage device", "какой диск", "какой ssd", "накопител"])) {
    return {
      kind: "storage_devices",
      skill: "storage_devices",
    };
  }

  if (containsAny(normalized, ["free space", "disk usage", "сколько места", "место на диске", "свободно на диске"])) {
    return {
      kind: "disk_usage",
      skill: "disk_usage",
    };
  }

  if (containsAny(normalized, ["network", "wifi", "wi-fi", "ethernet", "ip address", "сет", "интернет", "ip "])) {
    return {
      kind: "network_summary",
      skill: "network_summary",
    };
  }

  if (
    containsAny(normalized, [
      "system info",
      "system summary",
      "hardware summary",
      "что за комп",
      "характеристик",
      "мой компьютер",
      "конфиг компа",
      "specs",
    ])
  ) {
    return {
      kind: "system_summary",
      skill: "system_summary",
    };
  }

  return null;
}
