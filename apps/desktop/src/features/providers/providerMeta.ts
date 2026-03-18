import type {
  LocalRuntime,
  LocalRuntimeAdvice,
  MachineProfile,
  ProviderId,
  ProviderSelectionMode,
  ProviderSettings,
} from "@klava/contracts";
import type { AppLanguage } from "../../i18n/AppI18n";

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

export type GuideChip = {
  label: string;
  tone?: "accent" | "default";
};

export type ProviderGuide = {
  title: string;
  summary: string;
  chips: GuideChip[];
  actionLabel: string;
  secretLabel?: string;
  secretPlaceholder?: string;
  hint: string;
  steps: GuideStep[];
};

function copy(language: AppLanguage, english: string, russian: string) {
  return language === "ru" ? russian : english;
}

function formatGpuSummary(machineProfile: MachineProfile | null, language: AppLanguage) {
  if (!machineProfile?.gpus.length) {
    return copy(language, "No GPU detected", "GPU не обнаружен");
  }

  return machineProfile.gpus
    .map((gpu) => `${gpu.name}${gpu.memoryGb ? ` (${gpu.memoryGb.toFixed(1)} ${copy(language, "GB", "ГБ")})` : ""}`)
    .join(", ");
}

export function getSelectionModeLabel(
  selectionMode: ProviderSelectionMode | null | undefined,
  language: AppLanguage = "en",
  options: { capitalized?: boolean } = {},
) {
  if (selectionMode === "manual") {
    return copy(
      language,
      options.capitalized ? "Manual selection" : "manual selection",
      options.capitalized ? "Ручной выбор" : "ручной выбор",
    );
  }

  if (selectionMode === "auto") {
    return copy(
      language,
      options.capitalized ? "Automatic selection" : "automatic selection",
      options.capitalized ? "Автовыбор" : "автовыбор",
    );
  }

  return copy(language, "not configured", "не настроено");
}

export function getProviderLabel(
  provider: ProviderSettings | ProviderId | null,
  options: {
    localRuntime?: LocalRuntime;
    language?: AppLanguage;
  } = {},
) {
  const providerId = typeof provider === "string" ? provider : provider?.provider;
  const language = options.language ?? "en";
  const runtime =
    typeof provider === "object" && provider?.provider === "local" ? provider.localRuntime : options.localRuntime ?? "ollama";

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
      return runtime === "vllm"
        ? copy(language, "Local vLLM", "Локальный vLLM")
        : copy(language, "Local Ollama", "Локальный Ollama");
    case "gonka":
      return "GONKA";
    default:
      return copy(language, "Provider", "Провайдер");
  }
}

export function isProviderReady(provider: ProviderSettings | null) {
  return Boolean(provider && provider.provider !== "gonka" && provider.secretConfigured);
}

export function getProviderChoiceSummary(providerId: ProviderId, language: AppLanguage = "en") {
  switch (providerId) {
    case "gemini":
      return copy(
        language,
        "Best free start: fast setup through Google AI Studio and live Gemini model discovery.",
        "Самый удобный бесплатный старт: подключение через Google AI Studio и быстрый доступ к актуальным моделям Gemini.",
      );
    case "openrouter":
      return copy(
        language,
        "Free-model router with an OpenAI-style API and dynamic access to new `:free` models.",
        "Единый маршрут к бесплатным моделям с OpenAI-совместимым API и быстрым доступом к новым моделям `:free`.",
      );
    case "groq":
      return copy(
        language,
        "Very fast smoke-test path for short prompts and latency-sensitive checks.",
        "Подходит для быстрых проверок, коротких запросов и сценариев, где важна минимальная задержка.",
      );
    case "openai":
      return copy(
        language,
        "Full paid OpenAI path with live validation and dynamic model loading.",
        "Прямое платное подключение к OpenAI с проверкой ключа и загрузкой актуального списка моделей.",
      );
    case "local":
      return copy(
        language,
        "No external API required. Connect Ollama or a local vLLM OpenAI-compatible server.",
        "Без внешнего API. Подключите Ollama или локальный OpenAI-совместимый сервер vLLM.",
      );
    case "gonka":
    default:
      return copy(
        language,
        "Prepared in Klava, but intentionally paused until the provider-side GitHub issues are resolved.",
        "Маршрут уже подготовлен в Klava, но сейчас временно недоступен из-за проблемы на стороне провайдера.",
      );
  }
}

export function getProviderGuide(
  providerId: ProviderId,
  {
    localRuntime,
    localRuntimeAdvice,
    machineProfile,
    language = "en",
  }: {
    localRuntime: LocalRuntime;
    localRuntimeAdvice: LocalRuntimeAdvice | null;
    machineProfile: MachineProfile | null;
    language?: AppLanguage;
  },
): ProviderGuide {
  if (providerId === "gemini") {
    return {
      title: "Google Gemini",
      summary: copy(
        language,
        "Fastest free start for most people. Klava validates the key live and pulls the current Gemini chat model list.",
        "Самый простой бесплатный старт для большинства пользователей. Klava проверит ключ и загрузит актуальный список моделей Gemini.",
      ),
      chips: [
        { label: copy(language, "Free tier", "Бесплатный тариф") },
        { label: copy(language, "AI Studio key", "Ключ AI Studio") },
        { label: copy(language, "Live model list", "Актуальный список моделей") },
      ],
      actionLabel: copy(language, "Connect Gemini", "Подключить Gemini"),
      secretLabel: copy(language, "Gemini API key", "API-ключ Gemini"),
      secretPlaceholder: "AIza...",
      hint: copy(
        language,
        "Open Google AI Studio, create an API key, paste it here, and Klava will load the currently available Gemini chat models.",
        "Откройте Google AI Studio, создайте API-ключ и вставьте его сюда. После проверки Klava сразу загрузит доступные модели Gemini.",
      ),
      steps: [
        {
          title: copy(language, "Open Google AI Studio", "Откройте Google AI Studio"),
          detail: copy(
            language,
            "Go to the API key page while signed in with the Google account you want to use for Gemini API access.",
            "Откройте страницу API-ключей, войдя под Google-аккаунтом, который хотите использовать для Gemini API.",
          ),
          href: "https://aistudio.google.com/app/apikey",
        },
        {
          title: copy(language, "Create a key", "Создайте ключ"),
          detail: copy(
            language,
            "Click Create API key. If Google asks for a project, pick the suggested project or create a new one in the same dialog.",
            "Нажмите Create API key. Если Google попросит выбрать проект, используйте предложенный или создайте новый прямо в том же диалоге.",
          ),
        },
        {
          title: copy(language, "Copy the key into Klava", "Вставьте ключ в Klava"),
          detail: copy(
            language,
            "Paste the key here. Klava will validate it live, fetch the current Gemini models, and open the full app immediately after validation succeeds.",
            "Вставьте ключ сюда. Klava проверит его, получит актуальные модели Gemini и сразу откроет основной интерфейс.",
          ),
        },
      ],
    };
  }

  if (providerId === "groq") {
    return {
      title: "Groq",
      summary: copy(
        language,
        "Useful for fast smoke tests and latency checks. Klava uses Groq's OpenAI-compatible API and live model listing.",
        "Подходит для быстрых прогонов, коротких проверок и оценки задержки. Klava использует OpenAI-совместимый API Groq и получает актуальный список моделей.",
      ),
      chips: [
        { label: copy(language, "Fast responses", "Быстрые ответы") },
        { label: copy(language, "Free-tier start", "Бесплатный старт") },
        { label: copy(language, "OpenAI-compatible", "OpenAI-совместимый") },
      ],
      actionLabel: copy(language, "Connect Groq", "Подключить Groq"),
      secretLabel: copy(language, "Groq API key", "API-ключ Groq"),
      secretPlaceholder: "gsk_...",
      hint: copy(
        language,
        "Create a Groq API key in the console, paste it here, and Klava will validate the key and load the current Groq models.",
        "Создайте API-ключ Groq в консоли, вставьте его сюда, и Klava проверит ключ и загрузит текущие модели Groq.",
      ),
      steps: [
        {
          title: copy(language, "Open Groq console", "Откройте консоль Groq"),
          detail: copy(language, "Sign in to the Groq console and open the keys page.", "Войдите в консоль Groq и откройте страницу ключей."),
          href: "https://console.groq.com/keys",
        },
        {
          title: copy(language, "Generate an API key", "Создайте API-ключ"),
          detail: copy(
            language,
            "Create a new key, give it a label you will recognize later, and copy it immediately because Groq shows the full secret only once.",
            "Создайте новый ключ, дайте ему понятное имя и сразу сохраните его: Groq показывает полный секрет только один раз.",
          ),
        },
        {
          title: copy(language, "Paste the key into Klava", "Вставьте ключ в Klava"),
          detail: copy(
            language,
            "Klava validates the key against the live Groq API, loads the model list, and lets you switch models later from the bottom dock.",
            "Klava сразу проверит ключ через API Groq, загрузит доступные модели и позже позволит переключать их через нижнюю панель.",
          ),
        },
      ],
    };
  }

  if (providerId === "openrouter") {
    return {
      title: "OpenRouter",
      summary: copy(
        language,
        "Best option when you want a single OpenAI-like API with access to many free models and automatic router aliases.",
        "Лучший вариант, если нужен единый API и быстрый доступ к разным бесплатным моделям без смены привычного сценария работы.",
      ),
      chips: [
        { label: copy(language, "Free models", "Бесплатные модели") },
        { label: copy(language, "OpenAI-compatible", "OpenAI-совместимый API") },
        { label: copy(language, "Router aliases", "Автоподбор маршрута") },
      ],
      actionLabel: copy(language, "Connect OpenRouter", "Подключить OpenRouter"),
      secretLabel: copy(language, "OpenRouter API key", "API-ключ OpenRouter"),
      secretPlaceholder: "sk-or-...",
      hint: copy(
        language,
        "OpenRouter works well when you want to test many free models quickly without changing Klava's chat flow.",
        "OpenRouter удобен, когда нужно быстро сравнивать разные бесплатные модели, не меняя привычный сценарий работы в Klava.",
      ),
      steps: [
        {
          title: copy(language, "Open the OpenRouter keys page", "Откройте страницу ключей OpenRouter"),
          detail: copy(language, "Sign in and create an API key from your OpenRouter account.", "Войдите в OpenRouter и создайте API-ключ в своём аккаунте."),
          href: "https://openrouter.ai/keys",
        },
        {
          title: copy(language, "Leave free routing available", "Оставьте свободную маршрутизацию включённой"),
          detail: copy(
            language,
            "Klava can use router aliases such as `openrouter/free` and any live `:free` models returned by the API. You do not need to hardcode a model before connecting.",
            "Klava умеет использовать маршруты вроде `openrouter/free` и любые актуальные модели `:free`, которые вернёт API. Заранее фиксировать модель не нужно.",
          ),
        },
        {
          title: copy(language, "Paste the key into Klava", "Вставьте ключ в Klava"),
          detail: copy(
            language,
            "Klava validates the key, fetches the current OpenRouter models, and makes the free router path available from the model selector.",
            "Klava проверит ключ, загрузит текущие модели OpenRouter и позволит выбирать бесплатные маршруты через селектор моделей.",
          ),
        },
      ],
    };
  }

  if (providerId === "openai") {
    return {
      title: "OpenAI",
      summary: copy(
        language,
        "Paid OpenAI path with live validation and dynamic model listing. Use this when you want the direct OpenAI API.",
        "Прямое платное подключение к OpenAI с проверкой ключа и актуальным списком моделей. Выбирайте этот путь, если нужен именно API OpenAI.",
      ),
      chips: [
        { label: copy(language, "Paid API", "Платный API") },
        { label: copy(language, "Key validation", "Проверка ключа") },
        { label: copy(language, "Current models", "Актуальные модели") },
      ],
      actionLabel: copy(language, "Connect OpenAI", "Подключить OpenAI"),
      secretLabel: copy(language, "OpenAI API key", "API-ключ OpenAI"),
      secretPlaceholder: "sk-...",
      hint: copy(
        language,
        "Paste a working OpenAI API key. Klava validates it live, loads the current chat models, and lets you switch models later.",
        "Вставьте рабочий API-ключ OpenAI. Klava проверит его, загрузит текущие модели и позволит переключать их позже.",
      ),
      steps: [
        {
          title: copy(language, "Open the OpenAI API keys page", "Откройте страницу API-ключей OpenAI"),
          detail: copy(language, "Sign in to the OpenAI platform and create a new secret key.", "Войдите в платформу OpenAI и создайте новый секретный ключ."),
          href: "https://platform.openai.com/api-keys",
        },
        {
          title: copy(language, "Copy the key immediately", "Сразу сохраните ключ"),
          detail: copy(
            language,
            "OpenAI shows the full secret only when it is created. Save it now and paste it into Klava.",
            "OpenAI показывает полный секрет только в момент создания. Сохраните его сразу и вставьте в Klava.",
          ),
        },
        {
          title: copy(language, "Let Klava validate the key", "Дайте Klava проверить ключ"),
          detail: copy(
            language,
            "Klava verifies the key with a live request, loads the currently available OpenAI models, and opens the full app after validation succeeds.",
            "Klava проверит ключ живым запросом, загрузит доступные сейчас модели OpenAI и откроет полный интерфейс после успешной проверки.",
          ),
        },
      ],
    };
  }

  if (providerId === "local") {
    const adviceOption = localRuntimeAdvice?.options.find((option) => option.runtime === localRuntime) ?? null;
    const machineFacts = machineProfile
      ? copy(
          language,
          `${machineProfile.platformLabel}, ${machineProfile.memoryGb.toFixed(1)} GB RAM, CPU: ${machineProfile.cpuModel ?? "unknown"}, GPU: ${formatGpuSummary(machineProfile, language)}.`,
          `${machineProfile.platformLabel}, ${machineProfile.memoryGb.toFixed(1)} ГБ ОЗУ, CPU: ${machineProfile.cpuModel ?? "неизвестно"}, GPU: ${formatGpuSummary(machineProfile, language)}.`,
        )
      : copy(
          language,
          "Klava could not read the local hardware profile yet, so the recommendation is best-effort.",
          "Klava пока не смогла определить параметры локальной машины, поэтому рекомендация пока ориентировочная.",
        );

    if (localRuntime === "ollama") {
      return {
        title: copy(language, "Local Ollama", "Локальный Ollama"),
        summary: copy(
          language,
          "Best default local path. Ollama is easier to install and usually the right first choice on Windows.",
          "Лучший локальный вариант по умолчанию. Ollama проще всего поднять на Windows, и для большинства это самый безболезненный старт.",
        ),
        chips: [
          { label: copy(language, "No external API", "Без внешнего API") },
          { label: copy(language, "OpenAI-compatible", "OpenAI-совместимый") },
          {
            label: adviceOption?.recommended
              ? copy(language, "Recommended here", "Рекомендуется для этой машины")
              : copy(language, "Works locally", "Работает локально"),
            tone: adviceOption?.recommended ? "accent" : "default",
          },
        ],
        actionLabel: copy(language, "Connect Ollama", "Подключить Ollama"),
        secretLabel: copy(language, "Optional local API key", "Необязательный локальный API-ключ"),
        secretPlaceholder: copy(
          language,
          "leave blank unless your proxy requires Bearer auth",
          "оставьте поле пустым, если прокси не требует Bearer-аутентификации",
        ),
        hint: copy(
          language,
          `${machineFacts} Klava will connect to the local Ollama OpenAI-compatible endpoint at ${DEFAULT_LOCAL_ENDPOINTS.ollama} by default.`,
          `${machineFacts} По умолчанию Klava подключается к локальному OpenAI-совместимому API Ollama по адресу ${DEFAULT_LOCAL_ENDPOINTS.ollama}.`,
        ),
        steps: [
          {
            title: copy(language, "Install Ollama", "Установите Ollama"),
            detail: copy(language, "Download and install the Ollama desktop build for your OS.", "Скачайте и установите сборку Ollama для вашей ОС."),
            href: "https://ollama.com/download",
          },
          {
            title: copy(language, "Pull the recommended model", "Скачайте рекомендованную модель"),
            detail:
              adviceOption?.modelRecommendation?.summary ??
              copy(
                language,
                "Start with a smaller instruct model if this is your first local setup.",
                "Если вы настраиваете локальную модель впервые, начните с компактной instruct-модели.",
              ),
            code: adviceOption?.modelRecommendation?.installCommand ?? "ollama pull llama3.2:3b",
          },
          {
            title: copy(language, "Make sure the local API is up", "Убедитесь, что локальный API запущен"),
            detail: copy(
              language,
              "If Klava cannot reach Ollama, open a terminal and run `ollama serve`, then reconnect.",
              "Если Klava не может достучаться до Ollama, откройте терминал, выполните `ollama serve` и попробуйте подключиться заново.",
            ),
            code: "ollama serve",
          },
        ],
      };
    }

    return {
      title: copy(language, "Local vLLM", "Локальный vLLM"),
      summary: copy(
        language,
        "Advanced path for a dedicated local OpenAI-compatible inference server. Best on Linux/WSL with a stronger GPU.",
        "Продвинутый путь для выделенного локального сервера инференса с OpenAI-совместимым API. Лучше всего подходит для Linux/WSL и более мощной видеокарты.",
      ),
      chips: [
        { label: copy(language, "Advanced local server", "Продвинутый локальный сервер") },
        { label: copy(language, "OpenAI-compatible", "OpenAI-совместимый") },
        {
          label: adviceOption?.recommended
            ? copy(language, "Recommended here", "Рекомендуется для этой машины")
            : copy(language, "Advanced only", "Только для продвинутой настройки"),
          tone: adviceOption?.recommended ? "accent" : "default",
        },
      ],
      actionLabel: copy(language, "Connect vLLM", "Подключить vLLM"),
      secretLabel: copy(language, "Optional server API key", "Необязательный API-ключ сервера"),
      secretPlaceholder: copy(language, "token-... or leave blank if auth is disabled", "token-... или оставьте поле пустым, если авторизация отключена"),
      hint: copy(
        language,
        `${machineFacts} Klava expects an OpenAI-compatible vLLM server at ${DEFAULT_LOCAL_ENDPOINTS.vllm} by default.`,
        `${machineFacts} По умолчанию Klava ожидает OpenAI-совместимый API-сервер vLLM по адресу ${DEFAULT_LOCAL_ENDPOINTS.vllm}.`,
      ),
      steps: [
        {
          title: copy(language, "Use Linux or WSL if you are on Windows", "Если вы на Windows, используйте Linux или WSL"),
          detail: copy(
            language,
            "vLLM is primarily documented for Linux/CUDA. On Windows, the practical route is usually WSL2 or a Linux machine.",
            "vLLM в первую очередь рассчитан на Linux/CUDA. На Windows практичный путь обычно проходит через WSL2 или отдельную Linux-машину.",
          ),
          href: "https://docs.vllm.ai/en/latest/",
        },
        {
          title: copy(language, "Install vLLM", "Установите vLLM"),
          detail: copy(
            language,
            "Inside that Linux or WSL environment, install vLLM with Python and GPU support that matches your machine.",
            "Внутри Linux или WSL установите vLLM с Python и GPU-поддержкой, подходящей под вашу машину.",
          ),
          code: "pip install vllm",
        },
        {
          title: copy(language, "Start the OpenAI-compatible server", "Запустите OpenAI-совместимый сервер"),
          detail:
            adviceOption?.modelRecommendation?.summary ??
            copy(
              language,
              "Run the server with the model you actually want Klava to use.",
              "Запустите сервер с той моделью, которую Klava действительно должна использовать.",
            ),
          code:
            adviceOption?.modelRecommendation?.installCommand ??
            "python -m vllm.entrypoints.openai.api_server --model meta-llama/Llama-3.1-8B-Instruct --host 127.0.0.1 --port 8000",
        },
      ],
    };
  }

  return {
    title: "GONKA",
    summary: copy(
      language,
      "This provider path is intentionally paused. Klava keeps the UI visible but blocks live onboarding until the provider-side issue is resolved.",
      "Этот маршрут пока поставлен на паузу. Интерфейс остаётся видимым, но подключение временно отключено, пока проблема на стороне провайдера не будет решена.",
    ),
    chips: [
      { label: copy(language, "Paused", "Пауза") },
      { label: copy(language, "Tracked on GitHub", "Отслеживается на GitHub") },
      { label: copy(language, "Not available today", "Сейчас недоступно") },
    ],
    actionLabel: copy(language, "Use another provider", "Выбрать другой провайдер"),
    hint: copy(
      language,
      "Pick Gemini, OpenRouter, Groq, OpenAI, or Local to work in the app right now.",
      "Чтобы пользоваться приложением прямо сейчас, выберите Gemini, OpenRouter, Groq, OpenAI или локальный режим.",
    ),
    steps: [
      {
        title: copy(language, "Current state", "Текущее состояние"),
        detail: copy(
          language,
          "Klava's GONKA onboarding and UI path are prepared, but the live provider route remains paused in this build.",
          "Интерфейс и онбординг для GONKA уже готовы, но в этой сборке само подключение к провайдеру всё ещё стоит на паузе.",
        ),
      },
      {
        title: copy(language, "Use a working provider now", "Используйте рабочий провайдер сейчас"),
        detail: copy(
          language,
          "Switch to one of the live providers above if you need a working app immediately.",
          "Переключитесь на одного из рабочих провайдеров выше, если приложение нужно прямо сейчас.",
        ),
      },
    ],
  };
}
