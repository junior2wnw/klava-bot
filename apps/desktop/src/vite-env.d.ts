/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RUNTIME_URL?: string;
  readonly VITE_KLAVA_PLATFORM?: string;
}

declare global {
  interface Window {
    klava?: {
      runtimeUrl: string;
      platform: string;
    };
  }
}

export {};
