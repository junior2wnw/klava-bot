import type { TaskMessage } from "@klava/contracts";
import { DEFAULT_OPENROUTER_BASE_URL, DEFAULT_OPENROUTER_MODEL } from "./constants";
import { OpenAICompatibleService, isLikelyTextModel } from "./openai-compatible-service";

const OPENROUTER_HEADERS = {
  "HTTP-Referer": "https://github.com/junior2wnw/klava-bot",
  "X-Title": "Klava Bot",
};

function openRouterModelScore(model: string) {
  const lowered = model.toLowerCase();
  let score = 0;

  if (lowered === "openrouter/free") {
    score += 300;
  } else if (lowered === "openrouter/auto") {
    score += 280;
  }

  if (lowered.endsWith(":free") || lowered.includes("/free")) {
    score += 220;
  }

  if (lowered.includes("gemini")) {
    score += 24;
  }

  if (lowered.includes("gpt")) {
    score += 18;
  }

  if (lowered.includes("llama") || lowered.includes("qwen") || lowered.includes("deepseek")) {
    score += 14;
  }

  if (lowered.includes("preview")) {
    score -= 4;
  }

  return score;
}

function compareOpenRouterModels(left: string, right: string) {
  const scoreDifference = openRouterModelScore(right) - openRouterModelScore(left);
  if (scoreDifference !== 0) {
    return scoreDifference;
  }

  return left.localeCompare(right);
}

export class OpenRouterService {
  private readonly service = new OpenAICompatibleService();

  private options(secret: string) {
    return {
      providerLabel: "OpenRouter",
      apiBaseUrl: DEFAULT_OPENROUTER_BASE_URL,
      defaultModel: DEFAULT_OPENROUTER_MODEL,
      secret,
      secretRequired: true,
      extraHeaders: OPENROUTER_HEADERS,
      preferredModels: ["openrouter/free", "openrouter/auto", DEFAULT_OPENROUTER_MODEL],
      modelFilter: isLikelyTextModel,
      compareModels: compareOpenRouterModels,
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
