import type { LocalRuntime, TaskMessage } from "@klava/contracts";
import { defaultModelForProvider, providerLabel } from "./provider-catalog";
import { OpenAICompatibleService, isLikelyTextModel } from "./openai-compatible-service";

type LocalServiceConfig = {
  secret?: string | null;
  apiBaseUrl: string;
  localRuntime: LocalRuntime;
  preferredModels?: string[];
};

function localModelScore(model: string) {
  const lowered = model.toLowerCase();
  let score = 0;

  if (lowered.includes("qwen2.5:7b") || lowered.includes("qwen2.5-7b")) {
    score += 140;
  }

  if (lowered.includes("llama3.1:8b") || lowered.includes("llama-3.1-8b")) {
    score += 130;
  }

  if (lowered.includes("llama3.2:3b") || lowered.includes("llama-3.2-3b")) {
    score += 120;
  }

  if (lowered.includes("gemma3:4b") || lowered.includes("gemma-3-4b")) {
    score += 110;
  }

  if (lowered.includes("instruct")) {
    score += 20;
  }

  if (lowered.includes("coder")) {
    score += 6;
  }

  if (lowered.includes("vision")) {
    score -= 8;
  }

  return score;
}

function compareLocalModels(left: string, right: string) {
  const scoreDifference = localModelScore(right) - localModelScore(left);
  if (scoreDifference !== 0) {
    return scoreDifference;
  }

  return left.localeCompare(right);
}

export class LocalAiService {
  private readonly service = new OpenAICompatibleService();

  private options(config: LocalServiceConfig) {
    return {
      providerLabel: providerLabel("local", config.localRuntime),
      apiBaseUrl: config.apiBaseUrl,
      defaultModel: defaultModelForProvider("local", config.localRuntime),
      secret: config.secret ?? null,
      secretRequired: false,
      preferredModels: uniqueLocalModels([
        ...(config.preferredModels ?? []),
        defaultModelForProvider("local", config.localRuntime),
      ]),
      modelFilter: isLikelyTextModel,
      compareModels: compareLocalModels,
      unreachableMessage:
        config.localRuntime === "vllm"
          ? `Klava could not reach the local vLLM server at ${config.apiBaseUrl}. Start vLLM first and try again.`
          : `Klava could not reach Ollama at ${config.apiBaseUrl}. Start Ollama first and try again.`,
    };
  }

  async listModels(config: LocalServiceConfig) {
    return this.service.listModels(this.options(config));
  }

  async validate(config: LocalServiceConfig) {
    return this.service.validate(this.options(config));
  }

  async validateModel(config: LocalServiceConfig, model: string) {
    return this.service.validateModel(this.options(config), model);
  }

  async complete({
    secret,
    model,
    messages,
    apiBaseUrl,
    localRuntime,
  }: LocalServiceConfig & {
    model: string;
    messages: TaskMessage[];
  }) {
    return this.service.complete({
      ...this.options({
        secret,
        apiBaseUrl,
        localRuntime,
      }),
      model,
      messages,
    });
  }

  shouldRetryModelSelection(error: unknown) {
    return this.service.shouldRetryModelSelection(error);
  }
}

function uniqueLocalModels(models: string[]) {
  return [...new Set(models.map((model) => model.trim()).filter((model) => model.length > 0))];
}
