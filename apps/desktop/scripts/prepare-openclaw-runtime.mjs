import { constants as fsConstants } from "node:fs";
import { access, chmod, copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(scriptDir, "..");
const desktopPackagePath = path.join(desktopRoot, "package.json");
const vendorRoot = path.join(desktopRoot, "vendor", "openclaw-runtime");
const vendorManifestPath = path.join(vendorRoot, "package.json");
const vendoredOpenClawPackagePath = path.join(vendorRoot, "node_modules", "openclaw", "package.json");
const vendoredOpenClawEntryPath = path.join(vendorRoot, "node_modules", "openclaw", "openclaw.mjs");
const vendoredBinDir = path.join(vendorRoot, "bin");
const bundledNodeBinaryPath = path.join(vendoredBinDir, process.platform === "win32" ? "node.exe" : "node");
const bundledOpenClawCliPath = path.join(vendoredBinDir, process.platform === "win32" ? "openclaw.cmd" : "openclaw");

async function fileExists(filePath) {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      shell: process.platform === "win32",
      windowsHide: true,
      env: process.env,
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code ?? 1}`));
    });
  });
}

const desktopPackage = JSON.parse(await readFile(desktopPackagePath, "utf8"));
const bundledOpenClawVersion = desktopPackage.klava?.bundledOpenClawVersion;

if (typeof bundledOpenClawVersion !== "string" || !bundledOpenClawVersion.trim()) {
  throw new Error(`apps/desktop/package.json is missing klava.bundledOpenClawVersion`);
}

if ((await fileExists(vendoredOpenClawPackagePath)) && (await fileExists(vendoredOpenClawEntryPath))) {
  try {
    const installedPackage = JSON.parse(await readFile(vendoredOpenClawPackagePath, "utf8"));
    if (
      installedPackage.version === bundledOpenClawVersion &&
      (await fileExists(bundledNodeBinaryPath)) &&
      (await fileExists(bundledOpenClawCliPath))
    ) {
      console.log(`[klava] vendored OpenClaw runtime ${bundledOpenClawVersion} is already prepared.`);
      process.exit(0);
    }
  } catch {
    // If the existing runtime is unreadable, rebuild it cleanly below.
  }
}

await rm(vendorRoot, { recursive: true, force: true });
await mkdir(vendorRoot, { recursive: true });
await writeFile(
  vendorManifestPath,
  `${JSON.stringify(
    {
      name: "@klava/openclaw-runtime",
      private: true,
      description: "Vendored OpenClaw runtime bundled into Klava desktop builds",
      dependencies: {
        openclaw: bundledOpenClawVersion,
      },
    },
    null,
    2,
  )}\n`,
  "utf8",
);

console.log(`[klava] preparing vendored OpenClaw runtime ${bundledOpenClawVersion}...`);
await run(process.platform === "win32" ? "npm.cmd" : "npm", ["install", "--omit=dev", "--no-fund", "--no-audit"], vendorRoot);
await mkdir(vendoredBinDir, { recursive: true });
await copyFile(process.execPath, bundledNodeBinaryPath);
if (process.platform === "win32") {
  await writeFile(
    bundledOpenClawCliPath,
    [
      "@echo off",
      "setlocal",
      "\"%~dp0node.exe\" \"%~dp0..\\node_modules\\openclaw\\openclaw.mjs\" %*",
      "",
    ].join("\r\n"),
    "utf8",
  );
} else {
  await writeFile(
    bundledOpenClawCliPath,
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      "\"$(cd \"$(dirname \"$0\")\" && pwd)/node\" \"$(cd \"$(dirname \"$0\")\" && pwd)/../node_modules/openclaw/openclaw.mjs\" \"$@\"",
      "",
    ].join("\n"),
    "utf8",
  );
  await chmod(bundledOpenClawCliPath, 0o755);
  await chmod(bundledNodeBinaryPath, 0o755);
}

const installedPackage = JSON.parse(await readFile(vendoredOpenClawPackagePath, "utf8"));
if (installedPackage.version !== bundledOpenClawVersion) {
  throw new Error(
    `Vendored OpenClaw runtime version mismatch. Expected ${bundledOpenClawVersion}, got ${installedPackage.version}.`,
  );
}

console.log(`[klava] vendored OpenClaw runtime ${bundledOpenClawVersion} is ready at ${vendorRoot}.`);
