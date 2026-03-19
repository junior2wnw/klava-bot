/// <reference types="vite/client" />

import type { OpenClawBridgeState } from "@klava/contracts";

interface ImportMetaEnv {
  readonly VITE_RUNTIME_URL?: string;
  readonly VITE_KLAVA_PLATFORM?: string;
}

declare global {
  interface Window {
    klava?: {
      runtimeUrl: string;
      platform: string;
      getOpenClawBridgeState: () => Promise<OpenClawBridgeState>;
      refreshOpenClawBridgeState: () => Promise<OpenClawBridgeState>;
      startOpenClawGateway: () => Promise<OpenClawBridgeState>;
      stopOpenClawGateway: () => Promise<OpenClawBridgeState>;
      openOpenClawControlWindow: () => Promise<boolean>;
    };
  }
}

export {};
