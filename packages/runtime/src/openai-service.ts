import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { Models } from "openai/resources/models";
import type { TaskMessage } from "@klava/contracts";
import { DEFAULT_MODEL } from "./constants";

const EXCLUDED_MODEL_TAGS = [
  "audio",
  "computer",
  "codex",
  "deep-research",
  "embedding",
  "image",
  "mini",
  "moderation",
  "nano",
  "omni",
  "oss",
  "realtime",
  "search",
  "transcribe",
  "tts",
  "vision",
];

export type ResolvedOpenAiModel = {
  model: string;
  candidates: string[];
};

type RankedModel = {
  id: string;
  created: number;
  version: number[];
  familyFlavorScore: number;
  proScore: number;
  stabilityScore: number;
};

function toOpenAiMessages(messages: TaskMessage[]) {
  return messages.slice(-10).map<ChatCompletionMessageParam>((message) => {
    if (message.role === "assistant") {
      return { role: "assistant", content: message.content };
    }

    if (message.role === "user") {
      return { role: "user", content: message.content };
    }

    return { role: "system", content: message.content };
  });
}

function unique(values: string[]) {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function compareVersionParts(left: number[], right: number[]) {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const delta = (right[index] ?? 0) - (left[index] ?? 0);
    if (delta !== 0) {
      return delta;
    }
  }
  return 0;
}

function compareRankedModels(left: RankedModel, right: RankedModel) {
  const versionComparison = compareVersionParts(left.version, right.version);
  if (versionComparison !== 0) {
    return versionComparison;
  }

  const proComparison = right.proScore - left.proScore;
  if (proComparison !== 0) {
    return proComparison;
  }

  const stabilityComparison = right.stabilityScore - left.stabilityScore;
  if (stabilityComparison !== 0) {
    return stabilityComparison;
  }

  const familyComparison = right.familyFlavorScore - left.familyFlavorScore;
  if (familyComparison !== 0) {
    return familyComparison;
  }

  const createdComparison = right.created - left.created;
  if (createdComparison !== 0) {
    return createdComparison;
  }

  return left.id.localeCompare(right.id);
}

function parseRankedModel(model: Models.Model): RankedModel | null {
  const normalizedId = model.id.toLowerCase();
  if (!normalizedId.startsWith("gpt-")) {
    return null;
  }

  if (EXCLUDED_MODEL_TAGS.some((tag) => normalizedId.includes(`-${tag}`))) {
    return null;
  }

  const body = normalizedId.slice(4);
  const suffixIndex = body.indexOf("-");
  const familyToken = suffixIndex === -1 ? body : body.slice(0, suffixIndex);
  const suffix = suffixIndex === -1 ? "" : body.slice(suffixIndex);
  const familyMatch = familyToken.match(/^(\d+)((?:\.\d+)*)?([a-z]+)?$/);

  if (!familyMatch) {
    return null;
  }

  const versionParts = [Number(familyMatch[1]), ...((familyMatch[2] ?? "").split(".").filter(Boolean).map(Number))];
  if (versionParts.some(Number.isNaN)) {
    return null;
  }

  const familyFlavor = familyMatch[3] ?? "";
  const isSnapshot = /-\d{4}-\d{2}-\d{2}$/.test(suffix);
  const isPro = suffix.startsWith("-pro");
  const isPreview = suffix === "-preview" || /^-preview-\d{4}-\d{2}-\d{2}$/.test(suffix);
  const isLatest = suffix === "-latest" || /^-latest-\d{4}-\d{2}-\d{2}$/.test(suffix);
  const isSupportedSuffix =
    suffix === "" ||
    suffix === "-pro" ||
    suffix === "-preview" ||
    suffix === "-latest" ||
    /^-\d{4}-\d{2}-\d{2}$/.test(suffix) ||
    /^-pro-\d{4}-\d{2}-\d{2}$/.test(suffix) ||
    /^-preview-\d{4}-\d{2}-\d{2}$/.test(suffix) ||
    /^-latest-\d{4}-\d{2}-\d{2}$/.test(suffix);

  if (!isSupportedSuffix) {
    return null;
  }

  return {
    id: model.id,
    created: model.created,
    version: versionParts,
    familyFlavorScore: familyFlavor === "" ? 2 : familyFlavor === "o" ? 1 : 0,
    proScore: isPro ? 1 : 0,
    stabilityScore: isSnapshot ? 0 : isPreview || isLatest ? 1 : 2,
  };
}

function rankModelIds(models: Models.Model[]) {
  return unique(
    models
      .map((model) => parseRankedModel(model))
      .filter((model): model is RankedModel => model !== null)
      .sort(compareRankedModels)
      .map((model) => model.id),
  );
}

export class OpenAiService {
  async resolveBestModel(apiKey: string): Promise<ResolvedOpenAiModel> {
    const client = new OpenAI({ apiKey });
    const models = await client.models.list();
    const candidates = rankModelIds(models.data);

    return {
      model: candidates[0] ?? DEFAULT_MODEL,
      candidates: candidates.length ? candidates : [DEFAULT_MODEL],
    };
  }

  async validate(apiKey: string) {
    const client = new OpenAI({ apiKey });
    const selection = await this.resolveBestModel(apiKey);
    await client.models.retrieve(selection.model);
    return selection;
  }

  async complete({
    apiKey,
    model,
    messages,
  }: {
    apiKey: string;
    model: string;
    messages: TaskMessage[];
  }) {
    const client = new OpenAI({ apiKey });
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are Klava, a calm desktop AI operator. Be concise, practical, and explicit when an action needs approval or safer workflow routing.",
        },
        ...toOpenAiMessages(messages),
      ],
    });

    return response.choices[0]?.message?.content?.trim() || "I could not produce a response for that request.";
  }

  shouldRetryModelSelection(error: unknown) {
    const status =
      typeof error === "object" && error !== null && "status" in error && typeof error.status === "number"
        ? error.status
        : null;
    const message = error instanceof Error ? error.message.toLowerCase() : "";

    if (status === 404) {
      return true;
    }

    if ((status === 400 || status === 403) && (message.includes("model") || message.includes("chat completions"))) {
      return true;
    }

    return (
      (message.includes("model") || message.includes("chat completions")) &&
      ["access", "does not exist", "not found", "not support", "permission", "unsupported"].some((token) =>
        message.includes(token),
      )
    );
  }
}
