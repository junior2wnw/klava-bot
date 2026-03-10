import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import type { AppPaths } from "./storage";

type StoredSecrets = Record<string, string>;

async function loadJsonMap(filePath: string): Promise<StoredSecrets> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as StoredSecrets;
  } catch {
    return {};
  }
}

function runPowerShell(script: string, inputValue: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const encodedCommand = Buffer.from(script, "utf16le").toString("base64");
    const child = spawn(
      "powershell",
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", encodedCommand],
      {
        env: {
          ...process.env,
          KLAVA_INPUT_BASE64: inputValue,
        },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      },
    );

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }

      reject(new Error(stderr || `PowerShell exited with code ${code}`));
    });
  });
}

async function protectForCurrentUser(inputBase64: string) {
  const script =
    "Add-Type -AssemblyName System.Security; " +
    "$ErrorActionPreference = 'Stop'; " +
    "$InputBase64 = $env:KLAVA_INPUT_BASE64; " +
    "$bytes = [Convert]::FromBase64String($InputBase64); " +
    "$protected = [System.Security.Cryptography.ProtectedData]::Protect($bytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser); " +
    "[Convert]::ToBase64String($protected)";

  return runPowerShell(script, inputBase64);
}

async function unprotectForCurrentUser(inputBase64: string) {
  const script =
    "Add-Type -AssemblyName System.Security; " +
    "$ErrorActionPreference = 'Stop'; " +
    "$InputBase64 = $env:KLAVA_INPUT_BASE64; " +
    "$bytes = [Convert]::FromBase64String($InputBase64); " +
    "$plain = [System.Security.Cryptography.ProtectedData]::Unprotect($bytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser); " +
    "[Convert]::ToBase64String($plain)";

  return runPowerShell(script, inputBase64);
}

export class SecretVault {
  constructor(private readonly paths: AppPaths) {}

  private async createMasterKey() {
    const key = randomBytes(32);
    const base64 = key.toString("base64");
    const wrapped = process.platform === "win32" ? await protectForCurrentUser(base64) : base64;
    await writeFile(this.paths.keyPath, wrapped, "utf8");
    return key;
  }

  private async loadMasterKey() {
    try {
      const wrapped = await readFile(this.paths.keyPath, "utf8");
      const unwrappedBase64 =
        process.platform === "win32" ? await unprotectForCurrentUser(wrapped.trim()) : wrapped.trim();
      return Buffer.from(unwrappedBase64, "base64");
    } catch (error) {
      const code =
        typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
          ? error.code
          : null;

      if (code === "ENOENT") {
        return this.createMasterKey();
      }

      throw new Error(
        "Unable to unlock the local secret vault for this Windows user profile. Reconnect GONKA to create a new vault.",
      );
    }
  }

  private async encrypt(value: string) {
    const key = await this.loadMasterKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString("base64");
  }

  private async decrypt(value: string) {
    const key = await this.loadMasterKey();
    const buffer = Buffer.from(value, "base64");
    const iv = buffer.subarray(0, 12);
    const tag = buffer.subarray(12, 28);
    const payload = buffer.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(payload), decipher.final()]).toString("utf8");
  }

  async setSecret(name: string, value: string) {
    const secrets = await loadJsonMap(this.paths.secretsPath);
    secrets[name] = await this.encrypt(value);
    await writeFile(this.paths.secretsPath, JSON.stringify(secrets, null, 2), "utf8");
  }

  async getSecret(name: string) {
    const secrets = await loadJsonMap(this.paths.secretsPath);
    const stored = secrets[name];
    if (!stored) {
      return null;
    }
    return this.decrypt(stored);
  }
}
