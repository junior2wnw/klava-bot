import type { TaskMessage } from "@klava/contracts";
import type { SupportedLanguage } from "./language";

export type { SupportedLanguage } from "./language";

export type TranslationIntent = {
  targetLanguage: SupportedLanguage;
  sourceText: string | null;
};

export type ModelCommandIntent =
  | { kind: "list" }
  | { kind: "refresh" }
  | { kind: "auto" }
  | { kind: "pin"; model: string };

export type ConversationalIntent =
  | { kind: "greeting" }
  | { kind: "gratitude" }
  | { kind: "farewell" }
  | { kind: "check_in" };

const cyrillicPattern = /\p{Script=Cyrillic}/gu;
const latinPattern = /[A-Za-z]/g;

const russianLanguagePattern =
  /(?:на\s+русском|по-русски|русский\s+язык|ответ(?:ь|ьте)\s+по-русски|reply\s+in\s+russian|in\s+russian|\brussian\b)/i;
const englishLanguagePattern =
  /(?:на\s+английском|по-английски|английский\s+язык|answer\s+in\s+english|reply\s+in\s+english|in\s+english|\benglish\b)/i;
const translationRequestPattern = /(?:перевед|перевод|translate|translation)/i;
const translateOnlyPattern =
  /^(?:переведи(?:\s+это|\s+текст)?(?:\s+на\s+\S+|\s+по-\S+)?|translate(?:\s+this|\s+the\s+following\s+text)?(?:\s+to\s+\w+|\s+in\s+\w+)?)$/i;

const conversationalActionCuePattern =
  /(?:\b(?:check|inspect|fix|write|build|create|open|find|install|run|show|explain|debug|translate|help|do|make|review|analyze|search)\b|(?:проверь|провести|проверить|исправ|почини|сделай|создай|открой|найди|установи|запусти|покажи|объясни|переведи|помоги|собери|проанализируй|посмотри))/i;

const greetingPhrases = new Set([
  "hi",
  "hello",
  "hey",
  "yo",
  "good morning",
  "good afternoon",
  "good evening",
  "привет",
  "салют",
  "здравствуй",
  "здравствуйте",
  "доброе утро",
  "добрый день",
  "добрый вечер",
  "хай",
  "ку",
]);

const gratitudePhrases = new Set([
  "thanks",
  "thank you",
  "thx",
  "ty",
  "спасибо",
  "спс",
  "благодарю",
]);

const farewellPhrases = new Set([
  "bye",
  "goodbye",
  "see you",
  "see ya",
  "пока",
  "до связи",
  "до скорого",
  "увидимся",
]);

const checkInPhrases = new Set([
  "how are you",
  "how is it going",
  "how's it going",
  "как дела",
  "как ты",
  "как жизнь",
]);

function countMatches(pattern: RegExp, value: string) {
  return value.match(pattern)?.length ?? 0;
}

function normalizeLanguageLabel(language: SupportedLanguage) {
  return language === "ru" ? "Russian" : "English";
}

export function normalizeLanguageName(language: SupportedLanguage) {
  return language === "ru" ? "русский" : "английский";
}

function detectExplicitLanguagePreference(raw: string): SupportedLanguage | null {
  if (russianLanguagePattern.test(raw)) {
    return "ru";
  }

  if (englishLanguagePattern.test(raw)) {
    return "en";
  }

  return null;
}

export function detectTextLanguage(text: string): SupportedLanguage | null {
  const cyrillicCount = countMatches(cyrillicPattern, text);
  const latinCount = countMatches(latinPattern, text);

  if (cyrillicCount === 0 && latinCount === 0) {
    return null;
  }

  if (cyrillicCount > 0 && latinCount === 0) {
    return "ru";
  }

  if (latinCount > 0 && cyrillicCount === 0) {
    return "en";
  }

  if (cyrillicCount >= 2 && cyrillicCount >= latinCount * 0.6) {
    return "ru";
  }

  if (latinCount >= 3 && latinCount >= cyrillicCount * 1.2) {
    return "en";
  }

  return null;
}

export function detectPreferredAssistantLanguage(messages: TaskMessage[], currentInput = ""): SupportedLanguage {
  const explicitLanguage = detectExplicitLanguagePreference(currentInput);
  if (explicitLanguage) {
    return explicitLanguage;
  }

  const recentUserSamples = messages
    .filter((message) => message.role === "user")
    .slice(-6)
    .map((message) => message.content);

  for (const sample of [...recentUserSamples].reverse()) {
    const explicitSampleLanguage = detectExplicitLanguagePreference(sample);
    if (explicitSampleLanguage) {
      return explicitSampleLanguage;
    }
  }

  const currentInputLanguage = detectTextLanguage(currentInput);
  if (currentInputLanguage) {
    return currentInputLanguage;
  }

  let russianScore = 0;
  let englishScore = 0;

  for (const sample of recentUserSamples) {
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
  if (russianLanguagePattern.test(raw)) {
    return "ru";
  }

  if (englishLanguagePattern.test(raw)) {
    return "en";
  }

  return fallback;
}

function isTranslationRequest(raw: string) {
  return translationRequestPattern.test(raw);
}

function latestTranslatableMessage(messages: TaskMessage[]) {
  return [...messages]
    .reverse()
    .find((message) => (message.role === "assistant" || message.role === "tool" || message.role === "user") && message.content.trim().length > 0)
    ?.content ?? null;
}

function extractInlineTranslationSource(raw: string) {
  if (translateOnlyPattern.test(raw.trim())) {
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

function normalizeConversationalText(raw: string) {
  return raw
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectConversationalIntent(raw: string): ConversationalIntent | null {
  const normalized = normalizeConversationalText(raw);
  if (!normalized) {
    return null;
  }

  const wordCount = normalized.split(" ").filter(Boolean).length;
  if (wordCount > 8 || conversationalActionCuePattern.test(normalized)) {
    return null;
  }

  if (greetingPhrases.has(normalized)) {
    return { kind: "greeting" };
  }

  if (gratitudePhrases.has(normalized)) {
    return { kind: "gratitude" };
  }

  if (farewellPhrases.has(normalized)) {
    return { kind: "farewell" };
  }

  if (checkInPhrases.has(normalized)) {
    return { kind: "check_in" };
  }

  return null;
}

export function detectModelCommandIntent(raw: string): ModelCommandIntent | null {
  const normalized = normalizeCommandText(raw);

  if (/^\/models$/i.test(normalized) || /^(?:list|show)\s+models$/i.test(normalized)) {
    return { kind: "list" };
  }

  if (/^(?:какая\s+модель(?:\s+сейчас)?|какие\s+модели\s+доступны|покажи\s+модели)$/i.test(normalized)) {
    return { kind: "list" };
  }

  if (/^\/refresh-models$/i.test(normalized) || /^(?:refresh|reload)\s+models$/i.test(normalized)) {
    return { kind: "refresh" };
  }

  if (/^(?:обнови|перезагрузи)\s+(?:модели|список\s+моделей)$/i.test(normalized)) {
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

export function buildConversationalReply(intent: ConversationalIntent, language: SupportedLanguage) {
  if (language === "ru") {
    switch (intent.kind) {
      case "greeting":
        return "Привет! Я на связи. Напиши, что нужно сделать, и я сразу подключусь.";
      case "gratitude":
        return "Пожалуйста. Если хочешь, можем сразу перейти к следующей задаче.";
      case "farewell":
        return "Хорошо. Я рядом, если захочешь продолжить позже.";
      case "check_in":
        return "Всё в порядке и я готова работать. Что сделаем?";
      default:
        return "Я на связи.";
    }
  }

  switch (intent.kind) {
    case "greeting":
      return "Hi! I'm here and ready to help. Tell me what you want to do, and I'll jump in.";
    case "gratitude":
      return "You're welcome. If you want, we can move straight to the next task.";
    case "farewell":
      return "Sounds good. I'll be here when you want to continue.";
    case "check_in":
      return "I'm doing well and ready to work. What should we tackle?";
    default:
      return "I'm here and ready to help.";
  }
}

export function buildTranslationInstruction(language: SupportedLanguage) {
  return [
    `Translate the user's source text into ${normalizeLanguageLabel(language)}.`,
    "Reply with the translation only.",
    "Preserve structure, numbering, bullet points, code spans, driver names, model names, versions, dates, paths, URLs, and line breaks.",
    "Do not add explanations, intros, summaries, or notes.",
  ].join(" ");
}
