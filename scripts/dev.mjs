import { spawn } from "node:child_process";

const runner =
  process.env.npm_execpath
    ? {
        command: process.execPath,
        args: [
          process.env.npm_execpath,
          "exec",
          "concurrently",
          "--",
        ],
        shell: false,
      }
    : {
        command: process.platform === "win32" ? "npx.cmd" : "npx",
        args: ["concurrently"],
        shell: process.platform === "win32",
      };

const child = spawn(
  runner.command,
  [
    ...runner.args,
    "--kill-others",
    "--names",
    "renderer,main,electron",
    "--prefix-colors",
    "cyan,magenta,green",
    "npm run dev:renderer --workspace @klava/desktop",
    "npm run dev:main --workspace @klava/desktop",
    "npm run dev:electron --workspace @klava/desktop",
  ],
  {
    stdio: "inherit",
    env: process.env,
    shell: runner.shell,
  },
);

child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
