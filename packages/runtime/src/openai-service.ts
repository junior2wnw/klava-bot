import type { TaskMessage } from "@klava/contracts";
import { DEFAULT_OPENAI_BASE_URL, DEFAULT_OPENAI_MODEL } from "./constants";
import { OpenAICompatibleService, isLikelyTextModel } from "./openai-compatible-service";

function openAiModelScore(model: string) {
  const lowered = model.toLowerCase();
  let score = 0;

  if (lowered.startsWith("gpt-5")) {
    score += 120;
  } else if (lowered.startsWith("gpt-4.1")) {
    score += 100;
  } else if (lowered.startsWith("gpt-4o")) {
    score += 90;
  } else if (lowered.startsWith("chatgpt")) {
    score += 80;
  } else if (/^o\d/.test(lowered)) {
    score += 70;
  } else if (lowered.startsWith("gpt-4")) {
    score += 60;
  } else if (lowered.startsWith("gpt-3.5")) {
    score += 40;
  }

  if (lowered.includes("mini")) {
    score -= 8;
  }

  if (lowered.includes("nano")) {
    score -= 14;
  }

  if (lowered.includes("preview")) {
    score -= 4;
  }

  const releaseMatch = lowered.match(/(\d{4})(?:[-._]\d{2}[-._]\d{2})?/);
  if (releaseMatch?.[1]) {
    score += Number(releaseMatch[1]) / 100;
  }

  return score;
}

function compareOpenAiModels(left: string, right: string) {
  const scoreDifference = openAiModelScore(right) - openAiModelScore(left);
  if (scoreDifference !== 0) {
    return scoreDifference;
  }

  return left.localeCompare(right);
}

function isLikelyOpenAiChatModel(model: string) {
  const lowered = model.toLowerCase();

  if (!/^(gpt|chatgpt|o\d)/.test(lowered)) {
    return false;
  }

  return isLikelyTextModel(model);
}

export class OpenAIService {
  private readonly service = new OpenAICompatibleService();

  private options(secret: string) {
    return {
      providerLabel: "OpenAI",
      apiBaseUrl: DEFAULT_OPENAI_BASE_URL,
      defaultModel: DEFAULT_OPENAI_MODEL,
      secret,
      secretRequired: true,
      preferredModels: [DEFAULT_OPENAI_MODEL],
      modelFilter: isLikelyOpenAiChatModel,
      compareModels: compareOpenAiModels,
      unavailableModelMessage: "The selected OpenAI model is unavailable for this API key right now.",
    };
  }

  async listModels(secret: string) {
    return this.service.listModels(this.options(secret));
  }

  async validate(secret: string) {
    return this.service.validate(this.options(secret));
  }

  async validateModel(secret: string, model: string) {
    return this.service.validateModel(this.options(secret), model);
  }

  async complete({
    secret,
    model,
    messages,
  }: {
    secret: string;
    model: string;
    messages: TaskMessage[];
  }) {
    return this.service.complete({
      ...this.options(secret),
      model,
      messages,
    });
  }

  shouldRetryModelSelection(error: unknown) {
    return this.service.shouldRetryModelSelection(error);
  }
}
