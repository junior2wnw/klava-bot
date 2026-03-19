import path from "node:path";
import { app, BrowserWindow, dialog } from "electron";
import { registerDesktopIpcHandlers } from "./ipc";
import { appendDesktopLog, ensureRuntime, getDesktopLogPath, stopRuntime } from "./openclaw";

let mainWindow: BrowserWindow | null = null;
let mainWindowCreationPromise: Promise<BrowserWindow> | null = null;
let shutdownPromise: Promise<void> | null = null;
let allowQuitAfterShutdown = false;

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
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (!mainWindow.isVisible()) {
      mainWindow.show();
    }
    mainWindow.focus();
    return mainWindow;
  }

  if (mainWindowCreationPromise) {
    return mainWindowCreationPromise;
  }

  mainWindowCreationPromise = (async () => {
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
  mainWindow = win;

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

  win.on("closed", () => {
    if (mainWindow === win) {
      mainWindow = null;
    }
  });

  win.webContents.on("render-process-gone", (_event, details) => {
    void appendDesktopLog(`renderer process gone: reason=${details.reason} exitCode=${details.exitCode}`);
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    await appendDesktopLog(`Loading renderer from dev server ${devServerUrl}.`);
    await win.loadURL(devServerUrl);
    win.webContents.openDevTools({ mode: "detach" });
    return win;
  }

  await appendDesktopLog("Loading packaged renderer from dist/index.html.");
  await win.loadFile(path.join(appRoot, "dist", "index.html"));
  return win;
  })()
    .finally(() => {
      mainWindowCreationPromise = null;
    });

  return mainWindowCreationPromise;
}

function beginGracefulShutdown() {
  if (shutdownPromise) {
    return shutdownPromise;
  }

  shutdownPromise = (async () => {
    await appendDesktopLog("Desktop shutdown requested; stopping managed services before exit.");
    try {
      await stopRuntime();
      await appendDesktopLog("Managed services stopped cleanly.");
    } catch (error) {
      await appendDesktopLog(`Managed shutdown failed: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
      throw error;
    }
  })()
    .finally(() => {
      shutdownPromise = null;
    });

  return shutdownPromise;
}

registerProcessDiagnostics();
registerDesktopIpcHandlers();

app.whenReady().then(async () => {
  await appendDesktopLog("Electron app ready.");
  try {
    await createMainWindow();
  } catch (error) {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    await appendDesktopLog(`createMainWindow failed: ${message}`);
    dialog.showErrorBox("Klava startup failed", `${message}\n\nDesktop log: ${getDesktopLogPath()}`);
    app.exit(1);
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (!mainWindow.isVisible()) {
      mainWindow.show();
    }
    mainWindow.focus();
    return;
  }

  if (BrowserWindow.getAllWindows().length === 0) {
    void createMainWindow();
  }
});

app.on("before-quit", (event) => {
  if (allowQuitAfterShutdown) {
    return;
  }

  event.preventDefault();
  void beginGracefulShutdown()
    .catch(() => {
      // Shutdown failures are already logged; still allow the process to exit.
    })
    .finally(() => {
      allowQuitAfterShutdown = true;
      app.quit();
    });
});
