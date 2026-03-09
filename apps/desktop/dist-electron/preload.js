"use strict";

// electron/preload.ts
var import_electron = require("electron");

// electron/config.ts
var DESKTOP_RUNTIME_PORT = 4120;
var DESKTOP_RUNTIME_URL = `http://127.0.0.1:${DESKTOP_RUNTIME_PORT}/api`;

// electron/preload.ts
import_electron.contextBridge.exposeInMainWorld("klava", {
  runtimeUrl: `http://127.0.0.1:${DESKTOP_RUNTIME_PORT}/api`,
  platform: process.platform
});
