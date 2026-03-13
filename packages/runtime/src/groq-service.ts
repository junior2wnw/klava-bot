import type { TaskMessage } from "@klava/contracts";
import { DEFAULT_GROQ_BASE_URL, DEFAULT_GROQ_MODEL } from "./constants";
import { OpenAICompatibleService, isLikelyTextModel } from "./openai-compatible-service";

function groqModelScore(model: string) {
  const lowered = model.toLowerCase();
  let score = 0;

  if (lowered.includes("instant")) {
    score += 130;
  }

  if (lowered.includes("gpt-oss-20b")) {
    score += 120;
  }

  if (lowered.includes("8b")) {
    score += 110;
  } else if (lowered.includes("20b")) {
    score += 100;
  } else if (lowered.includes("32b")) {
    score += 90;
  } else if (lowered.includes("70b")) {
    score += 80;
  }

  if (lowered.includes("qwen")) {
    score += 16;
  }

  if (lowered.includes("llama")) {
    score += 12;
  }

  if (lowered.includes("preview")) {
    score -= 4;
  }

  return score;
}

function compareGroqModels(left: string, right: string) {
  const scoreDifference = groqModelScore(right) - groqModelScore(left);
  if (scoreDifference !== 0) {
    return scoreDifference;
  }

  return left.localeCompare(right);
}

export class GroqService {
  private readonly service = new OpenAICompatibleService();

  private options(secret: string) {
    return {
      providerLabel: "Groq",
      apiBaseUrl: DEFAULT_GROQ_BASE_URL,
      defaultModel: DEFAULT_GROQ_MODEL,
      secret,
      secretRequired: true,
      preferredModels: [DEFAULT_GROQ_MODEL],
      modelFilter: isLikelyTextModel,
      compareModels: compareGroqModels,
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
