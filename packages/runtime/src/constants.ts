export const KLAVA_VERSION = "0.1.0";
export const DEFAULT_RUNTIME_PORT = 4120;
export const DEFAULT_RUNTIME_HOST = "127.0.0.1";
export const DEFAULT_GONKA_MODEL = "Qwen/Qwen3-235B-A22B-Instruct-2507-FP8";
export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
export const DEFAULT_GROQ_MODEL = "llama-3.1-8b-instant";
export const DEFAULT_OPENROUTER_MODEL = "openrouter/free";
export const DEFAULT_LOCAL_OLLAMA_MODEL = "llama3.2:3b";
export const DEFAULT_LOCAL_VLLM_MODEL = "meta-llama/Llama-3.1-8B-Instruct";
export const DEFAULT_MODEL = DEFAULT_GONKA_MODEL;
export const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
export const DEFAULT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
export const DEFAULT_GROQ_BASE_URL = "https://api.groq.com/openai/v1";
export const DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
export const DEFAULT_LOCAL_OLLAMA_BASE_URL = "http://127.0.0.1:11434/v1";
export const DEFAULT_LOCAL_VLLM_BASE_URL = "http://127.0.0.1:8000/v1";
export const MODEL_REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;
export const GONKA_NETWORK_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
export const GONKA_BALANCE_REFRESH_INTERVAL_MS = 60 * 1000;
export const GONKA_MOCK_API_KEY = "gonka-mainnet";
export const GONKA_MNEMONIC_HD_PATH = "m/44'/118'/0'/0/0";
export const GONKA_PROVIDER_PAUSED_MESSAGE =
  "GONKA onboarding in Klava is prepared, but this path is paused until the provider-side Gonka issues tracked on GitHub are resolved. Use OpenAI to work in the app right now.";
export const GONKA_DISCOVERY_URLS = [
  "http://node2.gonka.ai:8000",
  "http://node1.gonka.ai:8000",
  "https://node3.gonka.ai",
];
