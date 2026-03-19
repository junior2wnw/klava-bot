import { ipcMain } from "electron";
import type { OpenClawBridgeState } from "@klava/contracts";
import {
  getOpenClawBridgeState,
  openOpenClawControlWindow,
  refreshOpenClawBridgeState,
  startOpenClawGateway,
  stopOpenClawGateway,
} from "./openclaw";

const IPC_CHANNELS = {
  getOpenClawBridgeState: "klava:get-openclaw-bridge-state",
  refreshOpenClawBridgeState: "klava:refresh-openclaw-bridge-state",
  startOpenClawGateway: "klava:start-openclaw-gateway",
  stopOpenClawGateway: "klava:stop-openclaw-gateway",
  openOpenClawControlWindow: "klava:open-openclaw-control-window",
} as const;

export type KlavaDesktopBridge = {
  runtimeUrl: string;
  platform: string;
  getOpenClawBridgeState: () => Promise<OpenClawBridgeState>;
  refreshOpenClawBridgeState: () => Promise<OpenClawBridgeState>;
  startOpenClawGateway: () => Promise<OpenClawBridgeState>;
  stopOpenClawGateway: () => Promise<OpenClawBridgeState>;
  openOpenClawControlWindow: () => Promise<boolean>;
};

export function registerDesktopIpcHandlers() {
  ipcMain.handle(IPC_CHANNELS.getOpenClawBridgeState, async () => getOpenClawBridgeState());
  ipcMain.handle(IPC_CHANNELS.refreshOpenClawBridgeState, async () => refreshOpenClawBridgeState());
  ipcMain.handle(IPC_CHANNELS.startOpenClawGateway, async () => startOpenClawGateway());
  ipcMain.handle(IPC_CHANNELS.stopOpenClawGateway, async () => stopOpenClawGateway());
  ipcMain.handle(IPC_CHANNELS.openOpenClawControlWindow, async () => openOpenClawControlWindow());
}

export function getDesktopIpcChannels() {
  return IPC_CHANNELS;
}
