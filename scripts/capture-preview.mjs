import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const tempDir = path.join(repoRoot, ".tmp", "preview-capture");
const runtimeLogPath = path.join(tempDir, "runtime.log");
const rendererLogPath = path.join(tempDir, "renderer.log");
const runtimePort = Number.parseInt(process.env.KLAVA_PREVIEW_RUNTIME_PORT ?? "4120", 10);
const rendererPort = Number.parseInt(process.env.KLAVA_PREVIEW_RENDERER_PORT ?? "5173", 10);
const desktopShotPath = path.join(repoRoot, "docs", "assets", "klava-desktop-screenshot.png");
const socialShotPath = path.join(repoRoot, "docs", "assets", "klava-social-preview.png");

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function localNodeEntrypoint(relativePath) {
  return path.join(repoRoot, "node_modules", ...relativePath.split("/"));
}

async function pickBrowserPath() {
  const candidates = [
    process.env.KLAVA_CAPTURE_BROWSER,
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  throw new Error(
    "No supported Chromium browser found. Set KLAVA_CAPTURE_BROWSER to the full path of Edge or Chrome.",
  );
}

async function assertPortFree(port, name) {
  await new Promise((resolve, reject) => {
    const tester = net
      .createServer()
      .once("error", (error) => {
        if (error && typeof error === "object" && "code" in error && error.code === "EADDRINUSE") {
          reject(new Error(`${name} port ${port} is already in use. Stop the existing process and retry.`));
          return;
        }
        reject(error);
      })
      .once("listening", () => {
        tester.close((closeError) => {
          if (closeError) {
            reject(closeError);
            return;
          }
          resolve();
        });
      });

    tester.listen(port, "127.0.0.1");
  });
}

async function waitForHttp(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
      lastError = new Error(`${url} responded with ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(750);
  }
  throw lastError ?? new Error(`Timed out waiting for ${url}`);
}

function spawnLogged(command, args, options) {
  return spawn(command, args, {
    ...options,
    windowsHide: true,
  });
}

async function runBrowserCapture(browserPath, outputPath, width, height, profileDir, pageUrl) {
  await fs.rm(profileDir, { recursive: true, force: true });
  const args = [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--run-all-compositor-stages-before-draw",
    "--virtual-time-budget=8000",
    "--lang=en-US",
    `--window-size=${width},${height}`,
    `--user-data-dir=${profileDir}`,
    `--screenshot=${outputPath}`,
    pageUrl,
  ];

  await new Promise((resolve, reject) => {
    const child = spawn(browserPath, args, {
      cwd: repoRoot,
      windowsHide: true,
      stdio: "ignore",
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Browser capture exited with code ${code ?? 1}`));
    });
  });
}

async function buildSocialPreviewFromDesktop() {
  if (process.platform !== "win32") {
    throw new Error("Windows-only social preview crop path is unavailable on this platform.");
  }

  await new Promise((resolve, reject) => {
    const child = spawn(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        path.join(repoRoot, "scripts", "build-social-preview.ps1"),
        "-InputPath",
        desktopShotPath,
        "-OutputPath",
        socialShotPath,
        "-Width",
        "1200",
        "-Height",
        "630",
      ],
      {
        cwd: repoRoot,
        windowsHide: true,
        stdio: "ignore",
      },
    );
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Social preview crop exited with code ${code ?? 1}`));
    });
  });
}

async function main() {
  const browserPath = await pickBrowserPath();
  const rendererUrl = `http://127.0.0.1:${rendererPort}/`;
  const runtimeUrl = `http://127.0.0.1:${runtimePort}/api/health`;
  const tsxEntrypoint = localNodeEntrypoint("tsx/dist/cli.mjs");
  const viteEntrypoint = localNodeEntrypoint("vite/bin/vite.js");

  await assertPortFree(runtimePort, "Preview runtime");
  await assertPortFree(rendererPort, "Preview renderer");
  await fs.mkdir(tempDir, { recursive: true });
  await fs.rm(runtimeLogPath, { force: true });
  await fs.rm(rendererLogPath, { force: true });
  await fs.rm(desktopShotPath, { force: true });
  await fs.rm(socialShotPath, { force: true });

  const runtimeLog = createWriteStream(runtimeLogPath, { flags: "a" });
  const rendererLog = createWriteStream(rendererLogPath, { flags: "a" });

  const runtime = spawnLogged(
    process.execPath,
    [tsxEntrypoint, path.join(repoRoot, "scripts", "preview-demo-runtime.mts")],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        KLAVA_PREVIEW_RUNTIME_PORT: String(runtimePort),
        KLAVA_PREVIEW_ROOT_DIR: path.join(tempDir, "demo-runtime"),
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  runtime.stdout.pipe(runtimeLog);
  runtime.stderr.pipe(runtimeLog);

  let renderer = null;

  try {
    await waitForHttp(runtimeUrl, 60000);

    renderer = spawnLogged(process.execPath, [viteEntrypoint, "--host", "127.0.0.1", "--port", String(rendererPort)], {
      cwd: path.join(repoRoot, "apps", "desktop"),
      env: {
        ...process.env,
        VITE_KLAVA_PLATFORM: "win32",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    renderer.stdout.pipe(rendererLog);
    renderer.stderr.pipe(rendererLog);

    await waitForHttp(rendererUrl, 60000);
    await delay(2500);

    await runBrowserCapture(
      browserPath,
      desktopShotPath,
      1460,
      1040,
      path.join(tempDir, "edge-profile-desktop"),
      rendererUrl,
    );
    if (process.platform === "win32") {
      await buildSocialPreviewFromDesktop();
    } else {
      await runBrowserCapture(
        browserPath,
        socialShotPath,
        1200,
        630,
        path.join(tempDir, "edge-profile-social"),
        rendererUrl,
      );
    }

    const desktopStat = await fs.stat(desktopShotPath);
    const socialStat = await fs.stat(socialShotPath);
    console.log(
      JSON.stringify(
        {
          desktopScreenshot: { path: desktopShotPath, size: desktopStat.size },
          socialScreenshot: { path: socialShotPath, size: socialStat.size },
        },
        null,
        2,
      ),
    );
  } finally {
    if (renderer && renderer.exitCode === null) {
      renderer.kill("SIGTERM");
    }
    if (runtime.exitCode === null) {
      runtime.kill("SIGTERM");
    }

    await delay(1200);

    if (renderer && renderer.exitCode === null) {
      renderer.kill("SIGKILL");
    }
    if (runtime.exitCode === null) {
      runtime.kill("SIGKILL");
    }

    runtimeLog.end();
    rendererLog.end();
  }
}

main().catch(async (error) => {
  const runtimeLog = await fs.readFile(runtimeLogPath, "utf8").catch(() => "<runtime log unavailable>");
  const rendererLog = await fs.readFile(rendererLogPath, "utf8").catch(() => "<renderer log unavailable>");
  console.error(String(error?.stack ?? error));
  console.error("--- runtime log ---");
  console.error(runtimeLog);
  console.error("--- renderer log ---");
  console.error(rendererLog);
  process.exit(1);
});
