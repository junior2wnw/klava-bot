import { contextBridge, ipcRenderer } from "electron";
import { DESKTOP_RUNTIME_PORT } from "./config";
import { getDesktopIpcChannels } from "./ipc";

const channels = getDesktopIpcChannels();

contextBridge.exposeInMainWorld("klava", {
  runtimeUrl: `http://127.0.0.1:${DESKTOP_RUNTIME_PORT}/api`,
  platform: process.platform,
  getOpenClawBridgeState: () => ipcRenderer.invoke(channels.getOpenClawBridgeState),
  refreshOpenClawBridgeState: () => ipcRenderer.invoke(channels.refreshOpenClawBridgeState),
  startOpenClawGateway: () => ipcRenderer.invoke(channels.startOpenClawGateway),
  stopOpenClawGateway: () => ipcRenderer.invoke(channels.stopOpenClawGateway),
  openOpenClawControlWindow: () => ipcRenderer.invoke(channels.openOpenClawControlWindow),
});
