import { spawn } from "node:child_process";

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

function run(command, args, shell) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
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

const [scriptName, ...workspaces] = process.argv.slice(2);

if (!scriptName || workspaces.length === 0) {
  console.error("Usage: node scripts/run-workspaces.mjs <script> <workspace...>");
  process.exit(1);
}

for (const workspace of workspaces) {
  const invocation = getNpmInvocation(["run", scriptName, "--workspace", workspace]);
  await run(invocation.command, invocation.args, invocation.shell);
}
