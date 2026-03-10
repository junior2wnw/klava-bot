import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const target = process.argv[2];

if (target !== "win" && target !== "mac") {
  console.error("Usage: node scripts/release.mjs <win|mac>");
  process.exit(1);
}

if (target === "win" && process.platform !== "win32") {
  console.error("dist:win must be run on Windows.");
  process.exit(1);
}

if (target === "mac" && process.platform !== "darwin") {
  console.error("dist:mac must be run on macOS.");
  process.exit(1);
}

function getNpmInvocation(args) {
  if (process.env.npm_execpath) {
    return {
      command: process.execPath,
      args: [process.env.npm_execpath, ...args],
      shell: false,
    };
  }

  return {
    command: process.platform === "win32" ? "npm.cmd" : "npm",
    args,
    shell: process.platform === "win32",
  };
}

function run(command, args, cwd, shell) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      env: process.env,
      shell,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} exited with code ${code ?? 1}`));
    });
  });
}

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const releaseDir = path.join(rootDir, "apps", "desktop", "release");
const workspaceScript = target === "win" ? "dist:win" : "dist:mac";

await rm(releaseDir, { recursive: true, force: true });
const buildInvocation = getNpmInvocation(["run", "build"]);
await run(buildInvocation.command, buildInvocation.args, rootDir, buildInvocation.shell);

const releaseInvocation = getNpmInvocation(["run", workspaceScript, "--workspace", "@klava/desktop"]);
await run(releaseInvocation.command, releaseInvocation.args, rootDir, releaseInvocation.shell);
