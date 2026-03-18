import type { TaskMessage } from "@klava/contracts";

export type SupportedLanguage = "ru" | "en";

export type TranslationIntent = {
  targetLanguage: SupportedLanguage;
  sourceText: string | null;
};

export type ModelCommandIntent =
  | { kind: "list" }
  | { kind: "refresh" }
  | { kind: "auto" }
  | { kind: "pin"; model: string };

const cyrillicPattern = /[А-Яа-яЁё]/g;
const latinPattern = /[A-Za-z]/g;

function countMatches(pattern: RegExp, value: string) {
  return value.match(pattern)?.length ?? 0;
}

function normalizeLanguageLabel(language: SupportedLanguage) {
  return language === "ru" ? "Russian" : "English";
}

export function normalizeLanguageName(language: SupportedLanguage) {
  return language === "ru" ? "русский" : "английский";
}

export function detectTextLanguage(text: string): SupportedLanguage | null {
  const cyrillicCount = countMatches(cyrillicPattern, text);
  const latinCount = countMatches(latinPattern, text);

  if (cyrillicCount === 0 && latinCount === 0) {
    return null;
  }

  if (cyrillicCount >= latinCount * 1.15) {
    return "ru";
  }

  if (latinCount >= cyrillicCount * 1.15) {
    return "en";
  }

  return null;
}

export function detectPreferredAssistantLanguage(messages: TaskMessage[], currentInput = ""): SupportedLanguage {
  const samples = [currentInput, ...messages.filter((message) => message.role === "user").slice(-6).map((message) => message.content)];
  let russianScore = 0;
  let englishScore = 0;

  for (const sample of samples) {
    const detected = detectTextLanguage(sample);
    if (detected === "ru") {
      russianScore += 1;
    } else if (detected === "en") {
      englishScore += 1;
    }
  }

  return russianScore >= englishScore ? "ru" : "en";
}

function parseTargetLanguage(raw: string, fallback: SupportedLanguage): SupportedLanguage {
  const normalized = raw.toLowerCase();
  if (
    /(на\s+русский|по-русски|русский язык|to\s+russian|in\s+russian|\brussian\b)/i.test(normalized)
  ) {
    return "ru";
  }

  if (
    /(на\s+английский|по-английски|английский язык|to\s+english|in\s+english|\benglish\b)/i.test(normalized)
  ) {
    return "en";
  }

  return fallback;
}

function isTranslationRequest(raw: string) {
  return /(перевед|translate|translation|перевод)/i.test(raw);
}

function latestTranslatableMessage(messages: TaskMessage[]) {
  return [...messages]
    .reverse()
    .find((message) => (message.role === "assistant" || message.role === "tool" || message.role === "user") && message.content.trim().length > 0)
    ?.content ?? null;
}

function extractInlineTranslationSource(raw: string) {
  if (
    /^(?:переведи|переведи это|переведи текст)(?:\s+на\s+\S+|\s+по-\S+)?$/i.test(raw.trim()) ||
    /^(?:translate|translate this|translate the following text)(?:\s+to\s+\w+|\s+in\s+\w+)?$/i.test(raw.trim())
  ) {
    return null;
  }

  const patterns = [
    /^(?:переведи|переведи это|переведи текст)(?:\s+на\s+\S+|\s+по-\S+)?\s*[:\-]?\s*([\s\S]+)$/i,
    /^(?:translate|translate this|translate the following text)(?:\s+to\s+\w+|\s+in\s+\w+)?\s*[:\-]?\s*([\s\S]+)$/i,
    /^([\s\S]+?)\s+(?:это\s+)?переведи(?:\s+на\s+\S+|\s+по-\S+)?$/i,
    /^([\s\S]+?)\s+translate(?:\s+this)?(?:\s+to\s+\w+|\s+in\s+\w+)?$/i,
  ];

  for (const pattern of patterns) {
    const match = raw.match(pattern);
    const candidate = match?.[1]?.trim();
    if (candidate) {
      return candidate;
    }
  }

  const lines = raw.split(/\r?\n/).map((line) => line.trimEnd());
  if (lines.length >= 2) {
    const firstLine = lines[0]?.trim() ?? "";
    const lastLine = lines.at(-1)?.trim() ?? "";

    if (isTranslationRequest(firstLine)) {
      const candidate = lines.slice(1).join("\n").trim();
      if (candidate) {
        return candidate;
      }
    }

    if (isTranslationRequest(lastLine)) {
      const candidate = lines.slice(0, -1).join("\n").trim();
      if (candidate) {
        return candidate;
      }
    }
  }

  return null;
}

export function detectTranslationIntent(raw: string, messages: TaskMessage[]): TranslationIntent | null {
  if (!isTranslationRequest(raw)) {
    return null;
  }

  const fallbackLanguage = detectPreferredAssistantLanguage(messages);
  const targetLanguage = parseTargetLanguage(raw, fallbackLanguage);
  const sourceText = extractInlineTranslationSource(raw) ?? latestTranslatableMessage(messages);

  return {
    targetLanguage,
    sourceText,
  };
}

function normalizeCommandText(raw: string) {
  return raw.trim().replace(/\s+/g, " ");
}

export function detectModelCommandIntent(raw: string): ModelCommandIntent | null {
  const normalized = normalizeCommandText(raw);

  if (/^\/models$/i.test(normalized) || /^(?:list|show)\s+models$/i.test(normalized)) {
    return { kind: "list" };
  }

  if (/^(?:какая модель(?: сейчас)?|какие модели доступны|покажи модели)$/i.test(normalized)) {
    return { kind: "list" };
  }

  if (/^\/refresh-models$/i.test(normalized) || /^(?:refresh|reload)\s+models$/i.test(normalized)) {
    return { kind: "refresh" };
  }

  if (/^(?:обнови|перезагрузи)\s+(?:модели|список моделей)$/i.test(normalized)) {
    return { kind: "refresh" };
  }

  const slashModel = normalized.match(/^\/model(?:\s+(.+))?$/i);
  if (slashModel) {
    const requestedModel = slashModel[1]?.trim();
    if (!requestedModel) {
      return { kind: "list" };
    }

    if (/^auto$/i.test(requestedModel)) {
      return { kind: "auto" };
    }

    return { kind: "pin", model: requestedModel };
  }

  if (
    /^(?:use|enable|turn on)\s+(?:auto(?:matic)?\s+)?model(?:\s+selection)?$/i.test(normalized) ||
    /^(?:включи|верни)\s+автовыбор\s+модели$/i.test(normalized)
  ) {
    return { kind: "auto" };
  }

  const pinMatch =
    normalized.match(/^(?:switch|change|use|set)\s+model\s+(?:to\s+)?(.+)$/i) ??
    normalized.match(/^(?:переключи|смени|используй|поставь)\s+модель\s+(?:на\s+)?(.+)$/i);
  const requestedModel = pinMatch?.[1]?.trim();
  if (requestedModel) {
    return { kind: "pin", model: requestedModel };
  }

  return null;
}

export function buildLanguageInstruction(language: SupportedLanguage) {
  return language === "ru"
    ? "Reply in Russian unless the operator explicitly requests another language."
    : "Reply in English unless the operator explicitly requests another language.";
}

export function buildTranslationInstruction(language: SupportedLanguage) {
  return [
    `Translate the user's source text into ${normalizeLanguageLabel(language)}.`,
    "Reply with the translation only.",
    "Preserve structure, numbering, bullet points, code spans, driver names, model names, versions, dates, paths, URLs, and line breaks.",
    "Do not add explanations, intros, summaries, or notes.",
  ].join(" ");
}

type LocalizedReplacement = {
  pattern: RegExp;
  replace: string | ((...args: string[]) => string);
};

function applyLocalizedReplacements(value: string, replacements: LocalizedReplacement[]) {
  return replacements.reduce((current, item) => current.replace(item.pattern, item.replace as never), value);
}

function translateDeviceLabel(label: string) {
  const lowered = label.trim().toLowerCase();
  if (lowered.includes("mouse")) {
    return "мыши";
  }
  if (lowered.includes("keyboard")) {
    return "клавиатуры";
  }
  if (lowered.includes("gpu") || lowered.includes("display")) {
    return "видеоподсистемы";
  }
  if (lowered.includes("network")) {
    return "сетевого адаптера";
  }
  if (lowered.includes("audio")) {
    return "аудиоустройства";
  }
  if (lowered.includes("bluetooth")) {
    return "Bluetooth-устройства";
  }
  if (lowered.includes("storage")) {
    return "подсистемы хранения";
  }
  if (lowered.includes("camera")) {
    return "камеры";
  }
  if (lowered.includes("printer")) {
    return "принтера";
  }
  return label;
}

const russianStructuredReplacements: LocalizedReplacement[] = [
  {
    pattern: /^Investigated local (.+?) drivers using Get-PnpDevice, Win32_PnPSignedDriver, pnputil, and Windows Update state\.$/gim,
    replace: (_whole, label) =>
      `Проверен локальный путь драйвера ${translateDeviceLabel(label)} через Get-PnpDevice, Win32_PnPSignedDriver, pnputil и состояние Windows Update.`,
  },
  {
    pattern: /^Investigated local (.+?) drivers through Windows device inventory and driver ranking\.$/gim,
    replace: (_whole, label) =>
      `Проверен локальный путь драйвера ${translateDeviceLabel(label)} через инвентарь устройств Windows и ранжирование драйверов.`,
  },
  {
    pattern: /^I checked the local (.+?) path through Windows device inventory, driver ranking, and local update state\.$/gim,
    replace: (_whole, label) =>
      `Я проверила локальный путь драйвера ${translateDeviceLabel(label)} через инвентарь устройств Windows, ранжирование драйверов и локальное состояние обновлений.`,
  },
  {
    pattern: /^Active devices and installed drivers:$/gim,
    replace: "Активные устройства и установленные драйверы:",
  },
  {
    pattern: /^Other matching driver packages present but not installed:$/gim,
    replace: "Другие подходящие пакеты драйверов присутствуют в системе, но не установлены:",
  },
  {
    pattern: /^Windows Update:$/gim,
    replace: "Windows Update:",
  },
  {
    pattern: /^Conclusion: the active (.+?) driver currently selected by Windows is (.+)\.$/gim,
    replace: (_whole, label, driver) =>
      `Вывод: активный драйвер ${translateDeviceLabel(label)}, который сейчас выбран Windows, это ${driver}.`,
  },
  {
    pattern: /The higher-numbered generic package you may see in raw driver listings is not necessarily the active driver; pnputil marked at least one alternative as outranked\./gi,
    replace:
      "Более новый по номеру общий пакет, который виден в сырых списках драйверов, не обязательно является активным; `pnputil` показал как минимум один альтернативный пакет как уступающий установленному драйверу по рангу.",
  },
  {
    pattern: /present, but outranked by the installed driver/gi,
    replace: "присутствует в системе, но уступает установленному драйверу по рангу",
  },
  {
    pattern: /by Microsoft/gi,
    replace: "от Microsoft",
  },
  {
    pattern: /HID-compliant mouse/gi,
    replace: "HID-совместимая мышь",
  },
  {
    pattern: /date (\d{4}-\d{2}-\d{2})/gi,
    replace: "дата $1",
  },
  {
    pattern: /status started/gi,
    replace: "статус: запущено",
  },
  {
    pattern: /Windows Update does not currently report any pending driver updates\./gi,
    replace: "Windows Update сейчас не показывает ожидающих установки обновлений драйверов.",
  },
  {
    pattern: /From the Windows-managed path, I do not see a newer driver being offered right now\./gi,
    replace: "По пути, который управляется Windows, я сейчас не вижу более нового предлагаемого драйвера.",
  },
  {
    pattern: /This still does not prove that the hardware vendor site has no newer OEM-specific driver outside Windows Update\./gi,
    replace: "Это всё ещё не доказывает, что на сайте производителя оборудования нет более нового OEM-драйвера вне Windows Update.",
  },
  {
    pattern: /^System summary for this machine:$/gim,
    replace: "Сводка по этой системе:",
  },
  {
    pattern: /^I audited the local driver state using Windows device health, signed-driver inventory, key graphics-driver versions, and Windows Update\.$/gim,
    replace:
      "Я провела локальный аудит состояния драйверов через здоровье устройств Windows, инвентарь подписанных драйверов, версии ключевых графических драйверов и Windows Update.",
  },
  {
    pattern: /^Devices that currently need attention:$/gim,
    replace: "Устройства, которым сейчас нужно внимание:",
  },
  {
    pattern: /^Key graphics drivers currently installed:$/gim,
    replace: "Ключевые графические драйверы, которые сейчас установлены:",
  },
  {
    pattern: /^Priority recommendation:$/gim,
    replace: "Приоритетная рекомендация:",
  },
  {
    pattern: /I do not currently see Plug and Play devices with a non-zero ConfigManagerErrorCode\./gi,
    replace: "Сейчас я не вижу устройств Plug and Play с ненулевым ConfigManagerErrorCode.",
  },
  {
    pattern: /Update or reinstall the driver for (.+?) first, because it is currently reporting a device problem in Windows\./gi,
    replace: "Сначала обнови или переустанови драйвер для $1, потому что это устройство сейчас сообщает о проблеме в Windows.",
  },
  {
    pattern: /For a USB controller problem, prefer the motherboard or OEM chipset\/USB package before generic driver packs\./gi,
    replace: "Для проблемы с USB-контроллером лучше сначала взять пакет chipset/USB с сайта производителя платы или OEM, а не общий набор драйверов.",
  },
  {
    pattern: /I do not currently see a local failure signal on the active graphics drivers, so they are lower priority than the broken device above\./gi,
    replace: "Сейчас я не вижу локального сигнала сбоя на активных графических драйверах, поэтому их приоритет ниже, чем у проблемного устройства выше.",
  },
  {
    pattern: /I do not currently see a broken Plug and Play device or a pending Windows Update driver item that clearly demands attention\./gi,
    replace: "Сейчас я не вижу ни сломанного устройства Plug and Play, ни ожидающего драйверного обновления в Windows Update, которое явно требует внимания.",
  },
  {
    pattern: /If you want a stricter check, the next step is a vendor-specific pass for GPU, chipset, Wi-Fi, audio, and motherboard drivers\./gi,
    replace: "Если нужна более строгая проверка, следующий шаг — vendor-specific проход по GPU, chipset, Wi-Fi, audio и драйверам материнской платы.",
  },
  {
    pattern: /error code (\d+)/gi,
    replace: "код ошибки $1",
  },
  {
    pattern: /status error/gi,
    replace: "статус: ошибка",
  },
  {
    pattern: /status unknown/gi,
    replace: "статус: неизвестно",
  },
  {
    pattern: /class ([A-Za-z0-9_-]+)/gi,
    replace: "класс $1",
  },
  {
    pattern: /provider ([^,\n]+)/gi,
    replace: "поставщик $1",
  },
  {
    pattern: /service ([^,\n]+)/gi,
    replace: "служба $1",
  },
  {
    pattern: /^Local AI verdict: (.+?)\.$/gim,
    replace: "Вердикт по локальному ИИ: $1.",
  },
  {
    pattern: /^Fixed-disk usage:$/gim,
    replace: "Использование локальных дисков:",
  },
  {
    pattern: /^Active network adapters:$/gim,
    replace: "Активные сетевые адаптеры:",
  },
  {
    pattern: /^Physical storage devices:$/gim,
    replace: "Физические накопители:",
  },
  {
    pattern: /^Service status:$/gim,
    replace: "Состояние служб:",
  },
  {
    pattern: /^Running process list for /gim,
    replace: "Список запущенных процессов для ",
  },
  {
    pattern: /^Installed applications \(first 25 entries\):$/gim,
    replace: "Установленные приложения (первые 25 записей):",
  },
  {
    pattern: /^I checked the installed local version only; I did not compare it to the vendor's latest online release\.$/gim,
    replace: "Я проверила только локально установленную версию; с последним релизом производителя в интернете я её не сравнивала.",
  },
  {
    pattern: /^Computer capability overview requested\.$/gim,
    replace: "Запрошен обзор компьютерных возможностей.",
  },
  {
    pattern: /^Matched a package-management request for (.+?)\.$/gim,
    replace: "Распознан запрос на управление пакетом для $1.",
  },
  {
    pattern:
      /I matched this to a local Windows package action for (.+?)\. The exact command is ready and will go through guard approval if your task is not in off mode\./gi,
    replace:
      "Я распознала это как локальное действие управления пакетом Windows для $1. Точная команда уже подготовлена и пройдёт через подтверждение, если у задачи не выключен режим защиты.",
  },
  {
    pattern: /^Collected local version signals for (.+?)\.$/gim,
    replace: "Собраны локальные сигналы версии для $1.",
  },
  {
    pattern: /^Queried the installed application inventory\.$/gim,
    replace: "Запрошен список установленных приложений.",
  },
  {
    pattern: /^Collected Windows service status\.$/gim,
    replace: "Собрано состояние служб Windows.",
  },
  {
    pattern: /^Collected active network configuration\.$/gim,
    replace: "Собрана активная сетевая конфигурация.",
  },
  {
    pattern: /^Collected fixed-disk usage from Windows\.$/gim,
    replace: "Собрано использование дисков Windows.",
  },
  {
    pattern: /^Collected physical storage device details\.$/gim,
    replace: "Собраны сведения о физических накопителях.",
  },
];

export function localizeStructuredComputerText(value: string, language: SupportedLanguage) {
  if (language === "en") {
    return value;
  }

  return applyLocalizedReplacements(value, russianStructuredReplacements);
}
