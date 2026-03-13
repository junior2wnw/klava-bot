import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { TaskMessage } from "@klava/contracts";
import { KLAVA_BASE_ASSISTANT_PROMPT } from "./assistant-prompt";

const PROBE_PROMPT = "Reply with exactly OK.";
const MAX_VALIDATION_PROBE_MODELS = 12;
const COMPLETION_SYSTEM_PROMPT = KLAVA_BASE_ASSISTANT_PROMPT;

export type OpenAICompatibleRequestConfig = {
  providerLabel: string;
  apiBaseUrl: string;
  defaultModel: string;
  secret: string | null;
  secretRequired?: boolean;
  extraHeaders?: Record<string, string>;
  preferredModels?: string[];
  modelFilter?: (model: string) => boolean;
  compareModels?: (left: string, right: string) => number;
  unavailableModelMessage?: string;
  unreachableMessage?: string;
};

function uniqueModels(models: string[]) {
  return [...new Set(models.map((model) => model.trim()).filter((model) => model.length > 0))];
}

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

function normalizeContent(content: unknown) {
  if (typeof content === "string") {
    return content.trim();
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((part) => {
      if (typeof part === "string") {
        return part;
      }

      if (typeof part === "object" && part !== null && "text" in part && typeof part.text === "string") {
        return part.text;
      }

      return "";
    })
    .join("")
    .trim();
}

function defaultModelScore(model: string) {
  const lowered = model.toLowerCase();
  let score = 0;

  if (lowered.includes("instruct")) {
    score += 12;
  }

  if (lowered.includes("chat")) {
    score += 10;
  }

  if (lowered.includes("preview")) {
    score -= 4;
  }

  if (lowered.includes("audio") || lowered.includes("speech")) {
    score -= 30;
  }

  const sizeMatch = lowered.match(/(\d+)\s*b/);
  if (sizeMatch?.[1]) {
    score += Number(sizeMatch[1]) / 4;
  }

  return score;
}

function defaultCompareModels(left: string, right: string) {
  const scoreDifference = defaultModelScore(right) - defaultModelScore(left);
  if (scoreDifference !== 0) {
    return scoreDifference;
  }

  return left.localeCompare(right);
}

function preferredModelScore(model: string, preferredModels: string[]) {
  const index = preferredModels.findIndex((candidate) => candidate.toLowerCase() === model.toLowerCase());
  return index >= 0 ? 1000 - index : 0;
}

function normalizeAvailableModels(rawModels: string[], options: OpenAICompatibleRequestConfig) {
  const preferredModels = uniqueModels(options.preferredModels ?? []);
  const models = uniqueModels([...preferredModels, ...rawModels]);
  const filtered = options.modelFilter ? models.filter(options.modelFilter) : models;
  const compareModels = options.compareModels ?? defaultCompareModels;

  const sorted = [...(filtered.length ? filtered : models)].sort((left, right) => {
    const preferenceDifference = preferredModelScore(right, preferredModels) - preferredModelScore(left, preferredModels);
    if (preferenceDifference !== 0) {
      return preferenceDifference;
    }

    return compareModels(left, right);
  });

  return sorted.length ? sorted : [options.defaultModel];
}

function validationCandidates(models: string[], options: OpenAICompatibleRequestConfig) {
  return uniqueModels([...(options.preferredModels ?? []), options.defaultModel, ...models]).slice(
    0,
    MAX_VALIDATION_PROBE_MODELS,
  );
}

function getErrorStatus(error: unknown) {
  return typeof error === "object" && error !== null && "status" in error && typeof error.status === "number"
    ? error.status
    : null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isTransientProviderError(error: unknown) {
  const status = getErrorStatus(error);
  const message = getErrorMessage(error).toLowerCase();

  return (
    status === 429 ||
    status === 408 ||
    (status !== null && status >= 500) ||
    ["timeout", "network", "fetch", "econnreset", "econnrefused", "socket hang up", "enotfound"].some((token) =>
      message.includes(token),
    )
  );
}

async function withRetry<T>(task: () => Promise<T>) {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt === 1 || !isTransientProviderError(error)) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
    }
  }

  throw lastError ?? new Error("Provider request failed.");
}

export function isLikelyTextModel(model: string) {
  const lowered = model.toLowerCase();

  return ![
    "audio",
    "whisper",
    "transcribe",
    "tts",
    "embedding",
    "image",
    "dall-e",
    "moderation",
    "rerank",
    "speech",
  ].some((token) => lowered.includes(token));
}

export class OpenAICompatibleService {
  private createClient(options: OpenAICompatibleRequestConfig) {
    const trimmedSecret = options.secret?.trim() ?? "";
    if (!trimmedSecret && options.secretRequired !== false) {
      throw new Error(`Enter a ${options.providerLabel} API key.`);
    }

    return new OpenAI({
      apiKey: trimmedSecret || "klava-local",
      baseURL: options.apiBaseUrl,
      defaultHeaders: options.extraHeaders,
      timeout: 20_000,
    });
  }

  private toUserFacingError(error: unknown, options: OpenAICompatibleRequestConfig) {
    const status = getErrorStatus(error);
    const message = getErrorMessage(error).toLowerCase();
    const providerLabel = options.providerLabel;

    if (status === 401 || message.includes("invalid api key") || message.includes("unauthorized")) {
      if (options.secretRequired === false) {
        return new Error(
          `${providerLabel} rejected the optional API key for ${options.apiBaseUrl}. Remove it or check the local server auth settings.`,
        );
      }

      return new Error(`${providerLabel} rejected the API key. Check the key and try again.`);
    }

    if (status === 403) {
      return new Error(`${providerLabel} blocked this request for the current API key or account.`);
    }

    if (status === 404 || (message.includes("model") && message.includes("not found"))) {
      return new Error(
        options.unavailableModelMessage ??
          `The selected ${providerLabel} model is unavailable from ${options.apiBaseUrl} right now.`,
      );
    }

    if (
      status === 400 &&
      (message.includes("model") || message.includes("chat") || message.includes("completion")) &&
      ["unsupported", "not supported", "incompatible", "does not support", "chat.completions"].some((token) =>
        message.includes(token),
      )
    ) {
      return new Error(
        options.unavailableModelMessage ??
          `The selected ${providerLabel} model does not support Klava's current chat path.`,
      );
    }

    if (status === 429) {
      return new Error(`${providerLabel} is rate-limiting requests right now. Try again in a moment.`);
    }

    if (status !== null && status >= 500) {
      return new Error(`${providerLabel} returned ${status}. Try again in a moment.`);
    }

    if (
      ["network", "fetch", "econnrefused", "enotfound", "timeout", "socket", "connect"].some((token) =>
        message.includes(token),
      )
    ) {
      return new Error(
        options.unreachableMessage ??
          `${providerLabel} could not be reached at ${options.apiBaseUrl}. Verify the endpoint and try again.`,
      );
    }

    return error instanceof Error ? error : new Error(`Unknown ${providerLabel} provider error`);
  }

  private async probeModel(client: OpenAI, model: string) {
    await client.chat.completions.create({
      model,
      max_tokens: 8,
      temperature: 0,
      messages: [{ role: "user", content: PROBE_PROMPT }],
    });
  }

  async listModels(options: OpenAICompatibleRequestConfig) {
    try {
      const client = this.createClient(options);
      const page = await withRetry(() => client.models.list());
      const modelIds = page.data
        .map((model) => model.id)
        .filter((modelId): modelId is string => typeof modelId === "string");
      return normalizeAvailableModels(modelIds, options);
    } catch (error) {
      throw this.toUserFacingError(error, options);
    }
  }

  async validate(options: OpenAICompatibleRequestConfig) {
    const client = this.createClient(options);
    const models = await this.listModels(options);
    let lastModelError: Error | null = null;

    for (const model of validationCandidates(models, options)) {
      try {
        await withRetry(() => this.probeModel(client, model));
        return {
          model,
          models,
        };
      } catch (error) {
        if (!this.shouldRetryModelSelection(error)) {
          throw this.toUserFacingError(error, options);
        }

        lastModelError = this.toUserFacingError(error, options);
      }
    }

    throw lastModelError ?? new Error(`${options.providerLabel} did not expose a usable chat model.`);
  }

  async validateModel(options: OpenAICompatibleRequestConfig, model: string) {
    const trimmedModel = model.trim();
    if (!trimmedModel) {
      throw new Error(`Select a ${options.providerLabel} model.`);
    }

    try {
      const client = this.createClient(options);
      await withRetry(() => this.probeModel(client, trimmedModel));
    } catch (error) {
      throw this.toUserFacingError(error, options);
    }
  }

  async complete(options: OpenAICompatibleRequestConfig & { model: string; messages: TaskMessage[] }) {
    try {
      const client = this.createClient(options);
      const response = await client.chat.completions.create({
        model: options.model,
        messages: [
          {
            role: "system",
            content: COMPLETION_SYSTEM_PROMPT,
          },
          ...toOpenAiMessages(options.messages),
        ],
      });

      const content = normalizeContent(response.choices[0]?.message?.content);
      return content || "I could not produce a response for that request.";
    } catch (error) {
      throw this.toUserFacingError(error, options);
    }
  }

  shouldRetryModelSelection(error: unknown) {
    const status = getErrorStatus(error);
    const message = getErrorMessage(error).toLowerCase();

    return (
      status === 404 ||
      status === 400 ||
      ((message.includes("model") || message.includes("chat")) &&
        ["not found", "unavailable", "unsupported", "permission", "access", "exist", "incompatible", "support"].some((token) =>
          message.includes(token),
        ))
    );
  }
}
