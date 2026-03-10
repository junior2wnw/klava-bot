"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// electron/main.ts
var import_node_path2 = __toESM(require("path"));
var import_electron2 = require("electron");

// electron/openclaw.ts
var import_promises = require("fs/promises");
var import_node_path = __toESM(require("path"));
var import_electron = require("electron");
var import_runtime = require("@klava/runtime");

// electron/config.ts
var DESKTOP_RUNTIME_PORT = 4120;
var DESKTOP_RUNTIME_URL = `http://127.0.0.1:${DESKTOP_RUNTIME_PORT}/api`;

// electron/openclaw.ts
var runtimeController = null;
function getDesktopLogPath() {
  return import_node_path.default.join(import_electron.app.getPath("userData"), "logs", "desktop.log");
}
async function appendDesktopLog(message) {
  const logPath = getDesktopLogPath();
  await (0, import_promises.mkdir)(import_node_path.default.dirname(logPath), { recursive: true });
  const line = `[${(/* @__PURE__ */ new Date()).toISOString()}] ${message}
`;
  await (0, import_promises.appendFile)(logPath, line, "utf8");
}
async function runtimeIsHealthy() {
  try {
    const response = await fetch(`${DESKTOP_RUNTIME_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}
async function ensureRuntime() {
  if (await runtimeIsHealthy()) {
    await appendDesktopLog("Reusing existing local runtime.");
    return;
  }
  await appendDesktopLog("Starting embedded local runtime.");
  runtimeController = await (0, import_runtime.createKlavaRuntime)();
  await runtimeController.start();
  await appendDesktopLog("Embedded local runtime started.");
}
async function stopRuntime() {
  if (!runtimeController) {
    return;
  }
  await appendDesktopLog("Stopping embedded local runtime.");
  await runtimeController.stop();
  runtimeController = null;
}

// electron/main.ts
function registerProcessDiagnostics() {
  process.on("uncaughtException", (error) => {
    void appendDesktopLog(`uncaughtException: ${error.stack ?? error.message}`);
    import_electron2.dialog.showErrorBox(
      "Klava startup failed",
      `A main-process error occurred.

${error.message}

Desktop log: ${getDesktopLogPath()}`
    );
  });
  process.on("unhandledRejection", (reason) => {
    const message = reason instanceof Error ? reason.stack ?? reason.message : String(reason);
    void appendDesktopLog(`unhandledRejection: ${message}`);
  });
}
async function createMainWindow() {
  await ensureRuntime();
  const appRoot = import_electron2.app.getAppPath();
  await appendDesktopLog(`Creating main window from ${appRoot}.`);
  const win = new import_electron2.BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: "#0a0a0f",
    webPreferences: {
      preload: import_node_path2.default.join(appRoot, "dist-electron", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedUrl) => {
    void appendDesktopLog(
      `renderer did-fail-load: code=${errorCode} description=${errorDescription} url=${validatedUrl}`
    );
  });
  win.webContents.on("did-finish-load", () => {
    void appendDesktopLog(`renderer did-finish-load: ${win.webContents.getURL()}`);
  });
  win.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    void appendDesktopLog(`renderer console[${level}] ${sourceId}:${line} ${message}`);
  });
  win.webContents.on("render-process-gone", (_event, details) => {
    void appendDesktopLog(`renderer process gone: reason=${details.reason} exitCode=${details.exitCode}`);
  });
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    await appendDesktopLog(`Loading renderer from dev server ${devServerUrl}.`);
    await win.loadURL(devServerUrl);
    win.webContents.openDevTools({ mode: "detach" });
    return;
  }
  await appendDesktopLog("Loading packaged renderer from dist/index.html.");
  await win.loadFile(import_node_path2.default.join(appRoot, "dist", "index.html"));
}
registerProcessDiagnostics();
import_electron2.app.whenReady().then(async () => {
  await appendDesktopLog("Electron app ready.");
  await createMainWindow();
});
import_electron2.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    import_electron2.app.quit();
  }
});
import_electron2.app.on("activate", () => {
  if (import_electron2.BrowserWindow.getAllWindows().length === 0) {
    void createMainWindow();
  }
});
import_electron2.app.on("before-quit", async () => {
  await stopRuntime();
});
