import type { LocalRuntime, ProviderId } from "@klava/contracts";
import {
  DEFAULT_GEMINI_BASE_URL,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GONKA_MODEL,
  DEFAULT_GROQ_BASE_URL,
  DEFAULT_GROQ_MODEL,
  DEFAULT_LOCAL_OLLAMA_BASE_URL,
  DEFAULT_LOCAL_OLLAMA_MODEL,
  DEFAULT_LOCAL_VLLM_BASE_URL,
  DEFAULT_LOCAL_VLLM_MODEL,
  DEFAULT_OPENAI_BASE_URL,
  DEFAULT_OPENAI_MODEL,
  DEFAULT_OPENROUTER_BASE_URL,
  DEFAULT_OPENROUTER_MODEL,
} from "./constants";

export function providerLabel(provider: ProviderId, localRuntime: LocalRuntime = "ollama") {
  switch (provider) {
    case "openai":
      return "OpenAI";
    case "gemini":
      return "Google Gemini";
    case "groq":
      return "Groq";
    case "openrouter":
      return "OpenRouter";
    case "local":
      return localRuntime === "vllm" ? "Local vLLM" : "Local Ollama";
    case "gonka":
    default:
      return "GONKA";
  }
}

export function providerSecretName(provider: ProviderId) {
  switch (provider) {
    case "openai":
      return "openai_api_key";
    case "gemini":
      return "gemini_api_key";
    case "groq":
      return "groq_api_key";
    case "openrouter":
      return "openrouter_api_key";
    case "local":
      return "local_provider_api_key";
    case "gonka":
    default:
      return "gonka_secret";
  }
}

export function defaultModelForProvider(provider: ProviderId, localRuntime: LocalRuntime = "ollama") {
  switch (provider) {
    case "openai":
      return DEFAULT_OPENAI_MODEL;
    case "gemini":
      return DEFAULT_GEMINI_MODEL;
    case "groq":
      return DEFAULT_GROQ_MODEL;
    case "openrouter":
      return DEFAULT_OPENROUTER_MODEL;
    case "local":
      return localRuntime === "vllm" ? DEFAULT_LOCAL_VLLM_MODEL : DEFAULT_LOCAL_OLLAMA_MODEL;
    case "gonka":
    default:
      return DEFAULT_GONKA_MODEL;
  }
}

export function defaultApiBaseUrlForProvider(provider: ProviderId, localRuntime: LocalRuntime = "ollama") {
  switch (provider) {
    case "openai":
      return DEFAULT_OPENAI_BASE_URL;
    case "gemini":
      return DEFAULT_GEMINI_BASE_URL;
    case "groq":
      return DEFAULT_GROQ_BASE_URL;
    case "openrouter":
      return DEFAULT_OPENROUTER_BASE_URL;
    case "local":
      return localRuntime === "vllm" ? DEFAULT_LOCAL_VLLM_BASE_URL : DEFAULT_LOCAL_OLLAMA_BASE_URL;
    case "gonka":
    default:
      return null;
  }
}

export function providerSupportsChat(provider: ProviderId) {
  return provider !== "gonka";
}
