import { contextBridge } from "electron";
import { DESKTOP_RUNTIME_PORT } from "./config";

contextBridge.exposeInMainWorld("klava", {
  runtimeUrl: `http://127.0.0.1:${DESKTOP_RUNTIME_PORT}/api`,
  platform: process.platform,
});
