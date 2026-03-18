import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const runtimeModuleUrl = pathToFileURL(path.join(repoRoot, "packages/runtime/src/server.ts")).href;
const { createKlavaRuntime } = (await import(runtimeModuleUrl)) as typeof import("../packages/runtime/src/server.ts");

const runtimePort = Number.parseInt(process.env.KLAVA_PREVIEW_RUNTIME_PORT ?? "4120", 10);
const rootDir = process.env.KLAVA_PREVIEW_ROOT_DIR
  ? path.resolve(process.env.KLAVA_PREVIEW_ROOT_DIR)
  : path.join(repoRoot, ".tmp", "preview-capture", "demo-runtime");
const statePath = path.join(rootDir, "state.json");
const secretsPath = path.join(rootDir, "secrets.json");
const keyPath = path.join(rootDir, "vault.key");

const state = {
  provider: {
    provider: "local",
    selectionMode: "manual",
    model: "qwen2.5-coder:14b",
    availableModels: ["qwen2.5-coder:14b", "llama3.1:8b"],
    secretConfigured: true,
    requesterAddress: null,
    balance: null,
    apiBaseUrl: "http://127.0.0.1:11434/v1",
    localRuntime: "ollama",
    validatedAt: "2026-03-19T08:00:00.000Z",
    modelRefreshedAt: "2026-03-19T08:00:00.000Z",
  },
  selectedTaskId: "task-routing",
  tasks: [
    {
      id: "task-routing",
      title: "Stabilize provider routing and context recovery",
      status: "running",
      guardMode: "balanced",
      updatedAt: "2026-03-19T08:14:20.000Z",
      createdAt: "2026-03-19T07:58:00.000Z",
      lastMessagePreview:
        "I kept the live status compact, wired restart-safe resume, and am validating the desktop flow now.",
      pendingApprovalCount: 0,
      messages: [
        {
          id: "msg-routing-user",
          taskId: "task-routing",
          role: "user",
          content:
            "Tighten the desktop chat UX, keep greetings local, and make restart-safe recovery durable across agent runs.",
          createdAt: "2026-03-19T08:05:12.000Z",
          meta: { presentation: "message" },
        },
        {
          id: "msg-routing-assistant",
          taskId: "task-routing",
          role: "assistant",
          content:
            "I collapsed noisy progress spam into one live status line, kept Enter for send and Shift+Enter for newline, and threaded recovery through the execution journal and semantic retrieval path.",
          createdAt: "2026-03-19T08:09:44.000Z",
          meta: { presentation: "message" },
        },
        {
          id: "msg-routing-status",
          taskId: "task-routing",
          role: "system",
          content: "Running validation suite and rebuilding the desktop release.",
          createdAt: "2026-03-19T08:14:20.000Z",
          meta: { presentation: "status", statusState: "running" },
        },
      ],
      terminalEntries: [
        {
          id: "term-routing-build",
          taskId: "task-routing",
          command: "npm run check && npm test",
          cwd: "d:\\Klavdiya\\klava-bot",
          status: "succeeded",
          createdAt: "2026-03-19T08:10:18.000Z",
          startedAt: "2026-03-19T08:10:19.000Z",
          finishedAt: "2026-03-19T08:12:44.000Z",
          exitCode: 0,
          stdout: "check complete\\n72/72 tests passed",
          stderr: "",
          guardDecision: "allowed",
          guardReason: "Low-risk validation workflow",
        },
      ],
      approvals: [],
      operations: [
        {
          id: "op-routing",
          title: "Harden recovery path",
          goal: "Keep agent execution restart-safe and reviewable.",
          summary: "Context compression, semantic retrieval, and execution journal are wired together.",
          status: "running",
          createdAt: "2026-03-19T08:01:20.000Z",
          updatedAt: "2026-03-19T08:14:20.000Z",
          activeStepId: "op-step-verify",
          steps: [
            {
              id: "op-step-compact",
              title: "Compact status noise",
              detail: "Collapse status spam into one durable live row.",
              kind: "note",
              command: null,
              status: "succeeded",
              startedAt: "2026-03-19T08:01:20.000Z",
              finishedAt: "2026-03-19T08:05:44.000Z",
              terminalEntryId: null,
              approvalId: null,
            },
            {
              id: "op-step-recovery",
              title: "Wire restart-safe resume",
              detail: "Persist journal state and reconnect it to semantic retrieval.",
              kind: "terminal",
              command: "npm test --workspace @klava/runtime",
              status: "succeeded",
              startedAt: "2026-03-19T08:05:46.000Z",
              finishedAt: "2026-03-19T08:11:42.000Z",
              terminalEntryId: "term-routing-build",
              approvalId: null,
            },
            {
              id: "op-step-verify",
              title: "Validate release path",
              detail: "Run the final desktop verification before packaging.",
              kind: "note",
              command: null,
              status: "running",
              startedAt: "2026-03-19T08:12:00.000Z",
              finishedAt: null,
              terminalEntryId: null,
              approvalId: null,
            },
          ],
        },
      ],
      agentRuns: [
        {
          id: "agent-routing",
          taskId: "task-routing",
          title: "Desktop recovery hardening",
          goal: "Keep the operator loop compact, truthful, and restart-safe.",
          status: "running",
          provider: "openai",
          model: "gpt-5.4",
          startedAt: "2026-03-19T08:03:14.000Z",
          updatedAt: "2026-03-19T08:14:20.000Z",
          summary: "Validating the compact live-status flow and release packaging.",
          lastAssistantMessage:
            "The recovery path is wired through the execution journal, retrieval memory, and verifier layer.",
          pendingApprovalId: null,
          failureReason: null,
          requestedInput: null,
        },
      ],
      memory: {
        summary:
          "The task tightened chat UX, added durable retrieval memory, and kept restart-safe recovery attached to the execution journal.",
        updatedAt: "2026-03-19T08:13:55.000Z",
        entries: [
          {
            id: "memory-goal-routing",
            kind: "goal",
            content: "Keep the desktop operator loop compact, reviewable, and durable across restarts.",
            sourceMessageId: "msg-routing-user",
            status: "active",
            updatedAt: "2026-03-19T08:13:12.000Z",
          },
          {
            id: "memory-fact-routing",
            kind: "fact",
            content: "The compact live-status row replaced multi-card progress spam in the chat surface.",
            sourceMessageId: "msg-routing-assistant",
            status: "active",
            updatedAt: "2026-03-19T08:13:20.000Z",
          },
        ],
      },
      journal: {
        updatedAt: "2026-03-19T08:14:20.000Z",
        activeResume: null,
        events: [
          {
            id: "journal-routing-status",
            scope: "agent",
            level: "info",
            createdAt: "2026-03-19T08:14:20.000Z",
            message: "Release validation is in progress after the recovery and retrieval wiring landed.",
          },
        ],
      },
    },
    {
      id: "task-recovery",
      title: "Prepare workstation recovery checklist",
      status: "awaiting_approval",
      guardMode: "strict",
      updatedAt: "2026-03-19T07:48:33.000Z",
      createdAt: "2026-03-19T07:32:00.000Z",
      lastMessagePreview: "A restore-point command is staged and waiting for approval.",
      pendingApprovalCount: 1,
      messages: [
        {
          id: "msg-recovery-user",
          taskId: "task-recovery",
          role: "user",
          content: "Check the recovery path before touching drivers.",
          createdAt: "2026-03-19T07:33:18.000Z",
          meta: { presentation: "message" },
        },
        {
          id: "msg-recovery-assistant",
          taskId: "task-recovery",
          role: "assistant",
          content: "I prepared a guarded restore-point step and paused before the change window.",
          createdAt: "2026-03-19T07:48:33.000Z",
          meta: { presentation: "message" },
        },
      ],
      terminalEntries: [],
      approvals: [
        {
          id: "approval-recovery",
          taskId: "task-recovery",
          action: "Create restore point",
          command: "Checkpoint-Computer -Description 'Klava driver recovery' -RestorePointType MODIFY_SETTINGS",
          riskClass: "guarded",
          impact: "Creates a rollback checkpoint before a driver workflow changes the machine.",
          requiresAdmin: true,
          status: "pending",
          createdAt: "2026-03-19T07:48:30.000Z",
          resolvedAt: null,
          rollbackHint: "Use System Restore if the follow-up change fails.",
          meta: {},
        },
      ],
      operations: [],
      agentRuns: [],
      memory: { summary: null, updatedAt: null, entries: [] },
      journal: { updatedAt: "2026-03-19T07:48:33.000Z", activeResume: null, events: [] },
    },
    {
      id: "task-migration",
      title: "Package a provider migration runbook",
      status: "succeeded",
      guardMode: "balanced",
      updatedAt: "2026-03-19T07:10:05.000Z",
      createdAt: "2026-03-19T06:40:00.000Z",
      lastMessagePreview: "Runbook, rollback notes, and verification steps are attached to the task history.",
      pendingApprovalCount: 0,
      messages: [
        {
          id: "msg-migration-user",
          taskId: "task-migration",
          role: "user",
          content: "Capture the provider migration steps and leave a rollback-ready summary.",
          createdAt: "2026-03-19T06:41:15.000Z",
          meta: { presentation: "message" },
        },
        {
          id: "msg-migration-assistant",
          taskId: "task-migration",
          role: "assistant",
          content: "The task now keeps the migration sequence, smoke checks, and rollback notes in one transcript.",
          createdAt: "2026-03-19T07:10:05.000Z",
          meta: { presentation: "message" },
        },
      ],
      terminalEntries: [],
      approvals: [],
      operations: [],
      agentRuns: [],
      memory: { summary: null, updatedAt: null, entries: [] },
      journal: { updatedAt: "2026-03-19T07:10:05.000Z", activeResume: null, events: [] },
    },
  ],
};

await fs.mkdir(rootDir, { recursive: true });
await fs.writeFile(statePath, JSON.stringify(state, null, 2), "utf8");
await fs.writeFile(secretsPath, "{}", "utf8");

const runtime = await createKlavaRuntime({
  host: "127.0.0.1",
  port: runtimePort,
  paths: { rootDir, statePath, secretsPath, keyPath },
});

await runtime.start();
console.log(`KLAVA_PREVIEW_RUNTIME_READY:${runtimePort}`);

const stop = async () => {
  await runtime.stop();
  process.exit(0);
};

process.on("SIGINT", () => {
  void stop();
});
process.on("SIGTERM", () => {
  void stop();
});

setInterval(() => {}, 1 << 30);
