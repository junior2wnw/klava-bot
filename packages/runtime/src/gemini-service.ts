import type { TaskMessage } from "@klava/contracts";
import { KLAVA_BASE_ASSISTANT_PROMPT } from "./assistant-prompt";
import { DEFAULT_GEMINI_BASE_URL, DEFAULT_GEMINI_MODEL } from "./constants";

const PROBE_PROMPT = "Reply with exactly OK.";
const COMPLETION_SYSTEM_PROMPT = KLAVA_BASE_ASSISTANT_PROMPT;
const REQUEST_TIMEOUT_MS = 20_000;

type GeminiValidationResult = {
  model: string;
  models: string[];
};

type GeminiModelRecord = {
  name?: string;
  supportedGenerationMethods?: string[];
};

class GeminiHttpError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
  }
}

function uniqueModels(models: string[]) {
  return [...new Set(models.map((model) => model.trim()).filter((model) => model.length > 0))];
}

function trimModelName(name: string) {
  return name.startsWith("models/") ? name.slice("models/".length) : name;
}

function geminiModelScore(model: string) {
  const lowered = model.toLowerCase();
  let score = 0;

  if (lowered.startsWith("gemini-2.5-flash")) {
    score += 200;
  } else if (lowered.startsWith("gemini-2.0-flash")) {
    score += 180;
  } else if (lowered.startsWith("gemini-2.5-pro")) {
    score += 170;
  } else if (lowered.startsWith("gemini-1.5-flash")) {
    score += 150;
  } else if (lowered.startsWith("gemini-pro")) {
    score += 120;
  }

  if (lowered.includes("lite")) {
    score -= 8;
  }

  if (lowered.includes("preview")) {
    score -= 4;
  }

  return score;
}

function compareGeminiModels(left: string, right: string) {
  const scoreDifference = geminiModelScore(right) - geminiModelScore(left);
  if (scoreDifference !== 0) {
    return scoreDifference;
  }

  return left.localeCompare(right);
}

function isLikelyGeminiChatModel(model: string) {
  const lowered = model.toLowerCase();

  return lowered.startsWith("gemini") && !["embedding", "aqa", "tts", "image"].some((token) => lowered.includes(token));
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function getErrorStatus(error: unknown) {
  return error instanceof GeminiHttpError ? error.status : null;
}

function isTransientGeminiError(error: unknown) {
  const status = getErrorStatus(error);
  const message = getErrorMessage(error).toLowerCase();

  return (
    status === 408 ||
    status === 429 ||
    (status !== null && status >= 500) ||
    ["timeout", "network", "fetch", "econnreset", "econnrefused", "socket", "enotfound"].some((token) =>
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
      if (attempt === 1 || !isTransientGeminiError(error)) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
    }
  }

  throw lastError ?? new Error("Gemini request failed.");
}

function normalizeGeminiModels(records: GeminiModelRecord[]) {
  const models = uniqueModels(
    records
      .filter((record) => record.supportedGenerationMethods?.includes("generateContent"))
      .map((record) => (typeof record.name === "string" ? trimModelName(record.name) : ""))
      .filter(isLikelyGeminiChatModel),
  ).sort(compareGeminiModels);

  return models.length ? models : [DEFAULT_GEMINI_MODEL];
}

function validationCandidates(models: string[]) {
  return uniqueModels([DEFAULT_GEMINI_MODEL, ...models]).slice(0, 12);
}

function buildHeaders(secret: string) {
  const trimmedSecret = secret.trim();
  if (!trimmedSecret) {
    throw new Error("Enter a Google Gemini API key.");
  }

  return {
    "content-type": "application/json",
    "x-goog-api-key": trimmedSecret,
  };
}

function buildRequestUrl(path: string) {
  return `${DEFAULT_GEMINI_BASE_URL}${path}`;
}

async function requestJson<T>(path: string, secret: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(buildRequestUrl(path), {
      ...init,
      headers: {
        ...buildHeaders(secret),
        ...(init.headers ?? {}),
      },
      signal: controller.signal,
    });

    const raw = await response.text();
    const data = raw.length ? (JSON.parse(raw) as T | { error?: { message?: string } }) : ({} as T);

    if (!response.ok) {
      const message =
        typeof data === "object" &&
        data !== null &&
        "error" in data &&
        typeof data.error === "object" &&
        data.error !== null &&
        "message" in data.error &&
        typeof data.error.message === "string"
          ? data.error.message
          : `Gemini returned ${response.status}`;
      throw new GeminiHttpError(message, response.status);
    }

    return data as T;
  } catch (error) {
    if (error instanceof GeminiHttpError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new GeminiHttpError("Gemini request timed out.", 408);
    }

    throw new GeminiHttpError(error instanceof Error ? error.message : "Gemini request failed.", null);
  } finally {
    clearTimeout(timeout);
  }
}

function toGeminiContents(messages: TaskMessage[]) {
  return messages
    .slice(-10)
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    }));
}

function extractTextFromCandidate(payload: unknown) {
  if (typeof payload !== "object" || payload === null || !("candidates" in payload) || !Array.isArray(payload.candidates)) {
    return "";
  }

  const candidate = payload.candidates[0];
  if (typeof candidate !== "object" || candidate === null || !("content" in candidate) || typeof candidate.content !== "object" || candidate.content === null) {
    return "";
  }

  const content = candidate.content as { parts?: Array<{ text?: string }> };
  return (content.parts ?? [])
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("")
    .trim();
}

export class GeminiService {
  private toUserFacingError(error: unknown) {
    const status = getErrorStatus(error);
    const message = getErrorMessage(error).toLowerCase();

    if (status === 401 || status === 403 || message.includes("api key")) {
      return new Error("Google Gemini rejected the API key. Check the key in Google AI Studio and try again.");
    }

    if (status === 404 || (message.includes("model") && message.includes("not found"))) {
      return new Error("The selected Gemini model is unavailable for this API key right now.");
    }

    if (
      status === 400 &&
      (message.includes("model") || message.includes("generatecontent")) &&
      ["unsupported", "not supported", "does not support", "incompatible"].some((token) => message.includes(token))
    ) {
      return new Error("The selected Gemini model does not support Klava's current chat path.");
    }

    if (status === 429) {
      return new Error("Google Gemini is rate-limiting requests right now. Try again in a moment.");
    }

    if (status !== null && status >= 500) {
      return new Error(`Google Gemini returned ${status}. Try again in a moment.`);
    }

    if (["timeout", "network", "fetch", "econnrefused", "connect", "socket", "enotfound"].some((token) => message.includes(token))) {
      return new Error("Klava could not reach Google Gemini right now. Check the network connection and try again.");
    }

    return error instanceof Error ? error : new Error("Unknown Gemini provider error");
  }

  async listModels(secret: string) {
    try {
      const models: GeminiModelRecord[] = [];
      let nextPageToken = "";
      let pageCount = 0;

      do {
        const query = nextPageToken ? `?pageSize=1000&pageToken=${encodeURIComponent(nextPageToken)}` : "?pageSize=1000";
        const response = await withRetry(() =>
          requestJson<{ models?: GeminiModelRecord[]; nextPageToken?: string }>(`/models${query}`, secret),
        );
        models.push(...(response.models ?? []));
        nextPageToken = typeof response.nextPageToken === "string" ? response.nextPageToken : "";
        pageCount += 1;
      } while (nextPageToken && pageCount < 5);

      return normalizeGeminiModels(models);
    } catch (error) {
      throw this.toUserFacingError(error);
    }
  }

  private async probeModel(secret: string, model: string) {
    await requestJson(`/models/${encodeURIComponent(model)}:generateContent`, secret, {
      method: "POST",
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: PROBE_PROMPT }],
          },
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 8,
        },
      }),
    });
  }

  async validate(secret: string): Promise<GeminiValidationResult> {
    const models = await this.listModels(secret);
    let lastModelError: Error | null = null;

    for (const model of validationCandidates(models)) {
      try {
        await withRetry(() => this.probeModel(secret, model));
        return {
          model,
          models,
        };
      } catch (error) {
        if (!this.shouldRetryModelSelection(error)) {
          throw this.toUserFacingError(error);
        }

        lastModelError = this.toUserFacingError(error);
      }
    }

    throw lastModelError ?? new Error("Google Gemini did not expose a usable chat model for this API key.");
  }

  async validateModel(secret: string, model: string) {
    const trimmedModel = model.trim();
    if (!trimmedModel) {
      throw new Error("Select a Gemini model.");
    }

    try {
      await withRetry(() => this.probeModel(secret, trimmedModel));
    } catch (error) {
      throw this.toUserFacingError(error);
    }
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
    const systemMessages = messages
      .filter((message) => message.role === "system")
      .map((message) => message.content.trim())
      .filter((message) => message.length > 0);
    const contents = toGeminiContents(messages);

    try {
      const response = await requestJson(`/models/${encodeURIComponent(model)}:generateContent`, secret, {
        method: "POST",
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: [COMPLETION_SYSTEM_PROMPT, ...systemMessages].join("\n\n") }],
          },
          contents:
            contents.length > 0
              ? contents
              : [
                  {
                    role: "user",
                    parts: [{ text: "Continue." }],
                  },
                ],
        }),
      });

      return extractTextFromCandidate(response) || "I could not produce a response for that request.";
    } catch (error) {
      throw this.toUserFacingError(error);
    }
  }

  shouldRetryModelSelection(error: unknown) {
    const status = getErrorStatus(error);
    const message = getErrorMessage(error).toLowerCase();

    return (
      status === 404 ||
      status === 400 ||
      ((message.includes("model") || message.includes("generatecontent")) &&
        ["not found", "unsupported", "unavailable", "permission", "access", "support"].some((token) =>
          message.includes(token),
        ))
    );
  }
}
