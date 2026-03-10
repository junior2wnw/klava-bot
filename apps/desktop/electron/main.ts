import path from "node:path";
import { app, BrowserWindow, dialog } from "electron";
import { appendDesktopLog, ensureRuntime, getDesktopLogPath, stopRuntime } from "./openclaw";

function registerProcessDiagnostics() {
  process.on("uncaughtException", (error) => {
    void appendDesktopLog(`uncaughtException: ${error.stack ?? error.message}`);
    dialog.showErrorBox(
      "Klava startup failed",
      `A main-process error occurred.\n\n${error.message}\n\nDesktop log: ${getDesktopLogPath()}`,
    );
  });

  process.on("unhandledRejection", (reason) => {
    const message = reason instanceof Error ? reason.stack ?? reason.message : String(reason);
    void appendDesktopLog(`unhandledRejection: ${message}`);
  });
}

async function createMainWindow() {
  await ensureRuntime();
  const appRoot = app.getAppPath();
  await appendDesktopLog(`Creating main window from ${appRoot}.`);

  const win = new BrowserWindow({
    show: false,
    width: 1480,
    height: 940,
    minWidth: 1180,
    minHeight: 760,
    autoHideMenuBar: true,
    backgroundColor: "#171311",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : undefined,
    webPreferences: {
      preload: path.join(appRoot, "dist-electron", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.platform !== "darwin") {
    win.removeMenu();
    win.setMenuBarVisibility(false);
  }

  win.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedUrl) => {
    void appendDesktopLog(
      `renderer did-fail-load: code=${errorCode} description=${errorDescription} url=${validatedUrl}`,
    );
  });

  win.webContents.on("did-finish-load", () => {
    void appendDesktopLog(`renderer did-finish-load: ${win.webContents.getURL()}`);
    if (!win.isVisible()) {
      win.show();
    }
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
  await win.loadFile(path.join(appRoot, "dist", "index.html"));
}

registerProcessDiagnostics();

app.whenReady().then(async () => {
  await appendDesktopLog("Electron app ready.");
  await createMainWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createMainWindow();
  }
});

app.on("before-quit", async () => {
  await stopRuntime();
});
