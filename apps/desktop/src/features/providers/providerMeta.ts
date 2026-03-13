import type {
  LocalRuntime,
  LocalRuntimeAdvice,
  MachineProfile,
  ProviderId,
  ProviderSettings,
} from "@klava/contracts";

export const DEFAULT_LOCAL_ENDPOINTS: Record<LocalRuntime, string> = {
  ollama: "http://127.0.0.1:11434/v1",
  vllm: "http://127.0.0.1:8000/v1",
};

export const PROVIDER_CARD_ORDER: ProviderId[] = ["gemini", "openrouter", "groq", "openai", "local", "gonka"];

export type GuideStep = {
  title: string;
  detail: string;
  href?: string;
  code?: string;
};

export type ProviderGuide = {
  title: string;
  summary: string;
  chips: string[];
  actionLabel: string;
  secretLabel?: string;
  secretPlaceholder?: string;
  hint: string;
  steps: GuideStep[];
};

function formatGpuSummary(machineProfile: MachineProfile | null) {
  if (!machineProfile?.gpus.length) {
    return "No GPU detected";
  }

  return machineProfile.gpus
    .map((gpu) => `${gpu.name}${gpu.memoryGb ? ` (${gpu.memoryGb.toFixed(1)} GB)` : ""}`)
    .join(", ");
}

export function getProviderLabel(provider: ProviderSettings | ProviderId | null, localRuntime: LocalRuntime = "ollama") {
  const providerId = typeof provider === "string" ? provider : provider?.provider;
  const runtime =
    typeof provider === "object" && provider?.provider === "local" ? provider.localRuntime : localRuntime;

  switch (providerId) {
    case "openai":
      return "OpenAI";
    case "gemini":
      return "Google Gemini";
    case "groq":
      return "Groq";
    case "openrouter":
      return "OpenRouter";
    case "local":
      return runtime === "vllm" ? "Local vLLM" : "Local Ollama";
    case "gonka":
      return "GONKA";
    default:
      return "Provider";
  }
}

export function isProviderReady(provider: ProviderSettings | null) {
  return Boolean(provider && provider.provider !== "gonka" && provider.secretConfigured);
}

export function getProviderChoiceSummary(providerId: ProviderId) {
  switch (providerId) {
    case "gemini":
      return "Best free start: fast setup through Google AI Studio and live Gemini model discovery.";
    case "openrouter":
      return "Free-model router with an OpenAI-style API and dynamic access to new `:free` models.";
    case "groq":
      return "Very fast smoke-test path for short prompts and latency-sensitive checks.";
    case "openai":
      return "Full paid OpenAI path with live validation and dynamic model loading.";
    case "local":
      return "No external API required. Connect Ollama or a local vLLM OpenAI-compatible server.";
    case "gonka":
    default:
      return "Prepared in Klava, but intentionally paused until the provider-side GitHub issues are resolved.";
  }
}

export function getProviderGuide(
  providerId: ProviderId,
  {
    localRuntime,
    localRuntimeAdvice,
    machineProfile,
  }: {
    localRuntime: LocalRuntime;
    localRuntimeAdvice: LocalRuntimeAdvice | null;
    machineProfile: MachineProfile | null;
  },
): ProviderGuide {
  if (providerId === "gemini") {
    return {
      title: "Google Gemini",
      summary: "Fastest free start for most people. Klava validates the key live and pulls the current Gemini chat model list.",
      chips: ["Free tier", "AI Studio key", "Live model list"],
      actionLabel: "Connect Gemini",
      secretLabel: "Gemini API key",
      secretPlaceholder: "AIza...",
      hint: "Open Google AI Studio, create an API key, paste it here, and Klava will load the currently available Gemini chat models.",
      steps: [
        {
          title: "Open Google AI Studio",
          detail: "Go to the API key page while signed in with the Google account you want to use for Gemini API access.",
          href: "https://aistudio.google.com/app/apikey",
        },
        {
          title: "Create a key",
          detail: "Click Create API key. If Google asks for a project, pick the suggested project or create a new one in the same dialog.",
        },
        {
          title: "Copy the key into Klava",
          detail: "Paste the key here. Klava will validate it live, fetch the current Gemini models, and open the full app immediately after validation succeeds.",
        },
      ],
    };
  }

  if (providerId === "groq") {
    return {
      title: "Groq",
      summary: "Useful for fast smoke tests and latency checks. Klava uses Groq's OpenAI-compatible API and live model listing.",
      chips: ["Fast responses", "Free-tier start", "OpenAI-compatible"],
      actionLabel: "Connect Groq",
      secretLabel: "Groq API key",
      secretPlaceholder: "gsk_...",
      hint: "Create a Groq API key in the console, paste it here, and Klava will validate the key and load the current Groq models.",
      steps: [
        {
          title: "Open Groq console",
          detail: "Sign in to the Groq console and open the keys page.",
          href: "https://console.groq.com/keys",
        },
        {
          title: "Generate an API key",
          detail: "Create a new key, give it a label you will recognize later, and copy it immediately because Groq shows the full secret only once.",
        },
        {
          title: "Paste the key into Klava",
          detail: "Klava validates the key against the live Groq API, loads the model list, and lets you switch models later from the bottom dock.",
        },
      ],
    };
  }

  if (providerId === "openrouter") {
    return {
      title: "OpenRouter",
      summary: "Best option when you want a single OpenAI-like API with access to many free models and automatic router aliases.",
      chips: ["Free models", "OpenAI-compatible", "Router aliases"],
      actionLabel: "Connect OpenRouter",
      secretLabel: "OpenRouter API key",
      secretPlaceholder: "sk-or-...",
      hint: "OpenRouter works well when you want to test many free models quickly without changing Klava's chat flow.",
      steps: [
        {
          title: "Open the OpenRouter keys page",
          detail: "Sign in and create an API key from your OpenRouter account.",
          href: "https://openrouter.ai/keys",
        },
        {
          title: "Leave free routing available",
          detail: "Klava can use router aliases such as `openrouter/free` and any live `:free` models returned by the API. You do not need to hardcode a model before connecting.",
        },
        {
          title: "Paste the key into Klava",
          detail: "Klava validates the key, fetches the current OpenRouter models, and makes the free router path available from the model selector.",
        },
      ],
    };
  }

  if (providerId === "openai") {
    return {
      title: "OpenAI",
      summary: "Paid OpenAI path with live validation and dynamic model listing. Use this when you want the direct OpenAI API.",
      chips: ["Paid API", "Live validation", "Dynamic models"],
      actionLabel: "Connect OpenAI",
      secretLabel: "OpenAI API key",
      secretPlaceholder: "sk-...",
      hint: "Paste a working OpenAI API key. Klava validates it live, loads the current chat models, and lets you switch models later.",
      steps: [
        {
          title: "Open the OpenAI API keys page",
          detail: "Sign in to the OpenAI platform and create a new secret key.",
          href: "https://platform.openai.com/api-keys",
        },
        {
          title: "Copy the key immediately",
          detail: "OpenAI shows the full secret only when it is created. Save it now and paste it into Klava.",
        },
        {
          title: "Let Klava validate the key",
          detail: "Klava verifies the key with a live request, loads the currently available OpenAI models, and opens the full app after validation succeeds.",
        },
      ],
    };
  }

  if (providerId === "local") {
    const adviceOption = localRuntimeAdvice?.options.find((option) => option.runtime === localRuntime) ?? null;
    const machineFacts = machineProfile
      ? `${machineProfile.platformLabel}, ${machineProfile.memoryGb.toFixed(1)} GB RAM, CPU: ${machineProfile.cpuModel ?? "unknown"}, GPU: ${formatGpuSummary(machineProfile)}.`
      : "Klava could not read the local hardware profile yet, so the recommendation is best-effort.";

    if (localRuntime === "ollama") {
      return {
        title: "Local Ollama",
        summary: "Best default local path. Ollama is easier to install and usually the right first choice on Windows.",
        chips: ["No external API", "OpenAI-compatible", adviceOption?.recommended ? "Recommended here" : "Works locally"],
        actionLabel: "Connect Ollama",
        secretLabel: "Optional local API key",
        secretPlaceholder: "leave blank unless your proxy requires Bearer auth",
        hint: `${machineFacts} Klava will connect to the local Ollama OpenAI-compatible endpoint at ${DEFAULT_LOCAL_ENDPOINTS.ollama} by default.`,
        steps: [
          {
            title: "Install Ollama",
            detail: "Download and install the Ollama desktop build for your OS.",
            href: "https://ollama.com/download",
          },
          {
            title: "Pull the recommended model",
            detail:
              adviceOption?.modelRecommendation?.summary ??
              "Start with a smaller instruct model if this is your first local setup.",
            code: adviceOption?.modelRecommendation?.installCommand ?? "ollama pull llama3.2:3b",
          },
          {
            title: "Make sure the local API is up",
            detail: "If Klava cannot reach Ollama, open a terminal and run `ollama serve`, then reconnect.",
            code: "ollama serve",
          },
        ],
      };
    }

    return {
      title: "Local vLLM",
      summary: "Advanced path for a dedicated local OpenAI-compatible inference server. Best on Linux/WSL with a stronger GPU.",
      chips: ["Advanced local server", "OpenAI-compatible", adviceOption?.recommended ? "Recommended here" : "Advanced only"],
      actionLabel: "Connect vLLM",
      secretLabel: "Optional server API key",
      secretPlaceholder: "token-... or leave blank if auth is disabled",
      hint: `${machineFacts} Klava expects an OpenAI-compatible vLLM server at ${DEFAULT_LOCAL_ENDPOINTS.vllm} by default.`,
      steps: [
        {
          title: "Use Linux or WSL if you are on Windows",
          detail: "vLLM is primarily documented for Linux/CUDA. On Windows, the practical route is usually WSL2 or a Linux machine.",
          href: "https://docs.vllm.ai/en/latest/",
        },
        {
          title: "Install vLLM",
          detail: "Inside that Linux or WSL environment, install vLLM with Python and GPU support that matches your machine.",
          code: "pip install vllm",
        },
        {
          title: "Start the OpenAI-compatible server",
          detail:
            adviceOption?.modelRecommendation?.summary ??
            "Run the server with the model you actually want Klava to use.",
          code:
            adviceOption?.modelRecommendation?.installCommand ??
            "python -m vllm.entrypoints.openai.api_server --model meta-llama/Llama-3.1-8B-Instruct --host 127.0.0.1 --port 8000",
        },
      ],
    };
  }

  return {
    title: "GONKA",
    summary: "This provider path is intentionally paused. Klava keeps the UI visible but blocks live onboarding until the provider-side issue is resolved.",
    chips: ["Paused", "Tracked on GitHub", "Not available today"],
    actionLabel: "Use another provider",
    hint: "Pick Gemini, OpenRouter, Groq, OpenAI, or Local to work in the app right now.",
    steps: [
      {
        title: "Current state",
        detail: "Klava's GONKA onboarding and UI path are prepared, but the live provider route remains paused in this build.",
      },
      {
        title: "Use a working provider now",
        detail: "Switch to one of the live providers above if you need a working app immediately.",
      },
    ],
  };
}
