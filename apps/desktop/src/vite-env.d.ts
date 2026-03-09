/// <reference types="vite/client" />

declare global {
  interface Window {
    klava?: {
      runtimeUrl: string;
      platform: string;
    };
  }
}

export {};
