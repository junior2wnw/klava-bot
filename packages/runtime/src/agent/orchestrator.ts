import type {
  AgentPlanItem,
  AgentRun,
  AgentRunStatus,
  AgentToolCall,
  ApprovalRequest,
  ProviderId,
  TaskDetail,
  TaskMessage,
  TaskStatus,
  TerminalEntry,
} from "@klava/contracts";
import { buildKlavaAgentPrompt } from "../assistant-prompt";
import type { ComputerOperator } from "../computer-operator";
import type { RuntimeLogger } from "../logging";
import { buildBlockedObjectiveMessage, assessAgentObjective } from "./safety";
import { parseAgentDecision } from "./parser";
import { readTextFileSnippet, searchWorkspaceText } from "./tools";
import type { AgentDecision, AgentDecisionPlanItem } from "./types";

export type AgentExecutionBinding = {
  agentRunId: string;
  agentToolCallId: string;
  agentToolKind: string;
};

export type AgentTerminalExecutionResult =
  | {
      kind: "blocked";
      terminalEntry: TerminalEntry;
    }
  | {
      kind: "awaiting_approval";
      terminalEntry: TerminalEntry;
      approval: ApprovalRequest;
    }
  | {
      kind: "completed";
      terminalEntry: TerminalEntry;
      succeeded: boolean;
    };

export type AgentOrchestratorBindings = {
  taskId: string;
  providerId: ProviderId;
  model: string | null;
  cwd: string;
  guardMode: TaskDetail["guardMode"];
  machineSummary: string;
  complete: (messages: TaskMessage[]) => Promise<string>;
  getTask: () => TaskDetail | null;
  getRun: () => AgentRun | null;
  updateRun: (
    update: (run: AgentRun) => void,
    status?: TaskStatus | ((run: AgentRun) => TaskStatus),
  ) => Promise<AgentRun | null>;
  addToolMessage: (content: string, meta: TaskMessage["meta"], status?: TaskStatus) => Promise<void>;
  addAssistantMessage: (content: string, meta: TaskMessage["meta"], status?: TaskStatus) => Promise<void>;
  computerOperator: ComputerOperator;
  executeTerminal: (task: TaskDetail, command: string, binding: AgentExecutionBinding) => Promise<AgentTerminalExecutionResult>;
  logger: RuntimeLogger;
};

type AgentLoopOutcome = {
  kind: "completed" | "awaiting_approval" | "needs_input" | "blocked" | "fallback";
};

type ToolObservation = {
  summary: string;
  outputPreview: string;
  status: AgentToolCall["status"];
  terminalEntryId?: string | null;
  approvalId?: string | null;
};

const MAX_AGENT_ITERATIONS_PER_PASS = 8;

type ToolDecision = AgentDecision & {
  kind: "tool";
  tool: NonNullable<AgentDecision["tool"]>;
};

type FinalDecision = Exclude<AgentDecision, ToolDecision>;
type ComputerToolDecision = ToolDecision & {
  tool: Extract<NonNullable<AgentDecision["tool"]>, { name: "computer.inspect" }>;
};
type ShellToolDecision = ToolDecision & {
  tool: Extract<NonNullable<AgentDecision["tool"]>, { name: "shell.command" }>;
};
type FilesystemReadToolDecision = ToolDecision & {
  tool: Extract<NonNullable<AgentDecision["tool"]>, { name: "filesystem.read" }>;
};
type FilesystemSearchToolDecision = ToolDecision & {
  tool: Extract<NonNullable<AgentDecision["tool"]>, { name: "filesystem.search" }>;
};

function nowIso() {
  return new Date().toISOString();
}

function toTaskStatus(status: AgentRunStatus): TaskStatus {
  switch (status) {
    case "awaiting_approval":
      return "awaiting_approval";
    case "running":
      return "running";
    case "succeeded":
      return "succeeded";
    case "failed":
    case "blocked":
      return "failed";
    case "needs_input":
    default:
      return "idle";
  }
}

function summarizeRecentTranscript(task: TaskDetail, runId: string) {
  return task.messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .filter((message) => message.meta.agentRunId !== runId)
    .slice(-6)
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n\n");
}

function summarizePlan(plan: AgentPlanItem[]) {
  if (!plan.length) {
    return "No plan has been committed yet.";
  }

  return plan.map((item, index) => `${index + 1}. ${item.title} [${item.status}]${item.detail ? ` - ${item.detail}` : ""}`).join("\n");
}

function summarizeToolCalls(toolCalls: AgentToolCall[]) {
  if (!toolCalls.length) {
    return "No prior tool calls.";
  }

  return toolCalls
    .slice(0, 8)
    .reverse()
    .map((call, index) => {
      const input = call.input ? `input=${call.input}` : "input=(none)";
      const output = call.outputPreview ? `output=${call.outputPreview}` : "output=(none)";
      return `${index + 1}. ${call.kind} [${call.status}] ${call.summary}; ${input}; ${output}`;
    })
    .join("\n");
}

function buildAgentMessages(
  task: TaskDetail,
  run: AgentRun,
  bindings: Pick<AgentOrchestratorBindings, "cwd" | "guardMode" | "machineSummary" | "providerId" | "model">,
  resumeReason: string | null,
): TaskMessage[] {
  const recentTranscript = summarizeRecentTranscript(task, run.id);
  const planSummary = summarizePlan(run.plan);
  const toolSummary = summarizeToolCalls(run.toolCalls);
  const runtimeContext = [
    `Workspace root: ${bindings.cwd}`,
    `Guard mode: ${bindings.guardMode}`,
    `Provider: ${bindings.providerId}${bindings.model ? ` (${bindings.model})` : ""}`,
    `Machine summary: ${bindings.machineSummary}`,
    `Task title: ${task.title}`,
    `Task status: ${task.status}`,
  ].join("\n");

  const userPrompt = [
    `Goal: ${run.goal}`,
    run.summary ? `Current summary: ${run.summary}` : "Current summary: none yet.",
    `Current plan:\n${planSummary}`,
    `Previous tool calls:\n${toolSummary}`,
    resumeReason ? `Resume trigger: ${resumeReason}` : "Resume trigger: initial request.",
    "Keep working until the goal is solved, blocked by policy, blocked by missing information, or paused on approval.",
  ].join("\n\n");

  const messages: TaskMessage[] = [
    {
      id: crypto.randomUUID(),
      taskId: run.taskId,
      role: "system",
      content: buildKlavaAgentPrompt(),
      createdAt: nowIso(),
      meta: {},
    },
    {
      id: crypto.randomUUID(),
      taskId: run.taskId,
      role: "system",
      content: `Runtime context:\n${runtimeContext}`,
      createdAt: nowIso(),
      meta: {},
    },
  ];

  if (recentTranscript) {
    messages.push({
      id: crypto.randomUUID(),
      taskId: run.taskId,
      role: "system",
      content: `Recent task transcript:\n${recentTranscript}`,
      createdAt: nowIso(),
      meta: {},
    });
  }

  messages.push({
    id: crypto.randomUUID(),
    taskId: run.taskId,
    role: "user",
    content: userPrompt,
    createdAt: nowIso(),
    meta: {},
  });

  return messages;
}

function normalizePlan(plan: AgentDecisionPlanItem[]): AgentPlanItem[] {
  return plan.map((item) => ({
    id: crypto.randomUUID(),
    title: item.title.trim(),
    detail: item.detail?.trim() || null,
    status:
      item.status === "completed"
        ? "completed"
        : item.status === "running"
          ? "running"
          : item.status === "failed"
            ? "failed"
            : item.status === "blocked"
              ? "blocked"
              : "pending",
  }));
}

function truncatePreview(value: string | null | undefined, maxChars = 2_000) {
  if (!value?.trim()) {
    return null;
  }

  return value.length > maxChars ? `${value.slice(0, maxChars)}\n\n[output truncated]` : value;
}

async function parseDecisionWithRepair(bindings: AgentOrchestratorBindings, messages: TaskMessage[]) {
  let raw = await bindings.complete(messages);

  try {
    return parseAgentDecision(raw);
  } catch (error) {
    await bindings.logger.log(
      `Agent JSON parse failed on the first attempt for task ${bindings.taskId}. ${error instanceof Error ? error.message : String(error)}`,
    );

    const repairPrompt: TaskMessage[] = [
      ...messages,
      {
        id: crypto.randomUUID(),
        taskId: bindings.taskId,
        role: "user",
        content: [
          "Your previous response was invalid for Klava Agent mode.",
          `Parser error: ${error instanceof Error ? error.message : String(error)}`,
          "Return one valid JSON object only and keep the same intent.",
          `Invalid response:\n${raw}`,
        ].join("\n\n"),
        createdAt: nowIso(),
        meta: {},
      },
    ];

    raw = await bindings.complete(repairPrompt);
    return parseAgentDecision(raw);
  }
}

async function recordToolCall(
  bindings: AgentOrchestratorBindings,
  toolCall: AgentToolCall,
  status: AgentRunStatus = "running",
) {
  await bindings.updateRun(
    (run) => {
      run.toolCalls.unshift(toolCall);
      run.status = status;
      run.pendingApprovalId = toolCall.approvalId ?? null;
      run.finishedAt = status === "succeeded" || status === "failed" || status === "blocked" ? nowIso() : run.finishedAt;
    },
    toTaskStatus(status),
  );
}

async function finalizeRun(
  bindings: AgentOrchestratorBindings,
  decision: FinalDecision,
) {
  const nextStatus: AgentRunStatus =
    decision.kind === "final" ? "succeeded" : decision.kind === "blocked" ? "blocked" : "needs_input";

  await bindings.updateRun(
    (run) => {
      run.status = nextStatus;
      run.summary = decision.summary;
      run.lastAssistantMessage = decision.message;
      run.plan = normalizePlan(decision.plan);
      run.pendingApprovalId = null;
      run.finishedAt = nextStatus === "needs_input" ? null : nowIso();
    },
    toTaskStatus(nextStatus),
  );

  await bindings.addAssistantMessage(decision.message, { agentRunId: bindings.getRun()?.id ?? null }, toTaskStatus(nextStatus));
}

async function handleComputerTool(
  decision: ComputerToolDecision,
  run: AgentRun,
  bindings: AgentOrchestratorBindings,
): Promise<ToolObservation> {
  const toolCallId = crypto.randomUUID();
  const result = await bindings.computerOperator.handle(decision.tool.instruction);
  const toolMeta = {
    agentRunId: run.id,
    agentToolCallId: toolCallId,
    agentToolKind: decision.tool.name,
  } satisfies TaskMessage["meta"];

  if (result.kind === "not_handled") {
    const outputPreview = "The local computer intent layer could not map that instruction to a deterministic local action.";
    await bindings.addToolMessage(outputPreview, toolMeta, "running");
    await recordToolCall(bindings, {
      id: toolCallId,
      kind: "computer.inspect",
      status: "failed",
      summary: decision.summary,
      input: decision.tool.instruction,
      command: null,
      outputPreview,
      terminalEntryId: null,
      approvalId: null,
      startedAt: nowIso(),
      finishedAt: nowIso(),
    });
    return {
      summary: "computer.inspect could not resolve the request.",
      outputPreview,
      status: "failed",
    };
  }

  if (result.kind === "answer") {
    await bindings.addToolMessage(result.assistantMessage, toolMeta, "running");
    await recordToolCall(bindings, {
      id: toolCallId,
      kind: "computer.inspect",
      status: result.status === "failed" ? "failed" : "completed",
      summary: decision.summary,
      input: decision.tool.instruction,
      command: null,
      outputPreview: truncatePreview(result.assistantMessage),
      terminalEntryId: null,
      approvalId: null,
      startedAt: nowIso(),
      finishedAt: nowIso(),
    });
    return {
      summary: result.toolMessage,
      outputPreview: result.assistantMessage,
      status: result.status === "failed" ? "failed" : "completed",
    };
  }

  const task = bindings.getTask();
  if (!task) {
    throw new Error("Task disappeared before the agent could execute a computer-generated shell command.");
  }

  const shellResult = await bindings.executeTerminal(task, result.command, {
    agentRunId: run.id,
    agentToolCallId: toolCallId,
    agentToolKind: decision.tool.name,
  });

  if (shellResult.kind === "awaiting_approval") {
    await recordToolCall(
      bindings,
      {
        id: toolCallId,
        kind: "computer.inspect",
        status: "awaiting_approval",
        summary: decision.summary,
        input: decision.tool.instruction,
        command: result.command,
        outputPreview: "Awaiting approval before the derived shell command can run.",
        terminalEntryId: shellResult.terminalEntry.id,
        approvalId: shellResult.approval.id,
        startedAt: nowIso(),
        finishedAt: null,
      },
      "awaiting_approval",
    );
    return {
      summary: "computer.inspect derived a guarded command and paused on approval.",
      outputPreview: "Awaiting approval before the derived shell command can run.",
      status: "awaiting_approval",
      terminalEntryId: shellResult.terminalEntry.id,
      approvalId: shellResult.approval.id,
    };
  }

  const commandOutput = shellResult.terminalEntry.output;
  const toolStatus = shellResult.kind === "blocked" ? "blocked" : shellResult.succeeded ? "completed" : "failed";
  await recordToolCall(bindings, {
    id: toolCallId,
    kind: "computer.inspect",
    status: toolStatus,
    summary: decision.summary,
    input: decision.tool.instruction,
    command: result.command,
    outputPreview: truncatePreview(commandOutput),
    terminalEntryId: shellResult.terminalEntry.id,
    approvalId: null,
    startedAt: nowIso(),
    finishedAt: nowIso(),
  });
  return {
    summary: result.toolMessage,
    outputPreview: commandOutput,
    status: toolStatus,
    terminalEntryId: shellResult.terminalEntry.id,
  };
}

async function handleShellTool(
  decision: ShellToolDecision,
  run: AgentRun,
  bindings: AgentOrchestratorBindings,
): Promise<ToolObservation> {
  const task = bindings.getTask();
  if (!task) {
    throw new Error("Task disappeared before the agent could execute a shell command.");
  }

  const toolCallId = crypto.randomUUID();
  const shellResult = await bindings.executeTerminal(task, decision.tool.command, {
    agentRunId: run.id,
    agentToolCallId: toolCallId,
    agentToolKind: decision.tool.name,
  });

  if (shellResult.kind === "awaiting_approval") {
    await recordToolCall(
      bindings,
      {
        id: toolCallId,
        kind: "shell.command",
        status: "awaiting_approval",
        summary: decision.summary,
        input: decision.tool.reason?.trim() || null,
        command: decision.tool.command,
        outputPreview: "Awaiting approval before the shell command can run.",
        terminalEntryId: shellResult.terminalEntry.id,
        approvalId: shellResult.approval.id,
        startedAt: nowIso(),
        finishedAt: null,
      },
      "awaiting_approval",
    );
    return {
      summary: "shell.command paused for approval.",
      outputPreview: "Awaiting approval before the shell command can run.",
      status: "awaiting_approval",
      terminalEntryId: shellResult.terminalEntry.id,
      approvalId: shellResult.approval.id,
    };
  }

  const toolStatus = shellResult.kind === "blocked" ? "blocked" : shellResult.succeeded ? "completed" : "failed";
  await recordToolCall(bindings, {
    id: toolCallId,
    kind: "shell.command",
    status: toolStatus,
    summary: decision.summary,
    input: decision.tool.reason?.trim() || null,
    command: decision.tool.command,
    outputPreview: truncatePreview(shellResult.terminalEntry.output),
    terminalEntryId: shellResult.terminalEntry.id,
    approvalId: null,
    startedAt: nowIso(),
    finishedAt: nowIso(),
  });
  return {
    summary: decision.summary,
    outputPreview: shellResult.terminalEntry.output,
    status: toolStatus,
    terminalEntryId: shellResult.terminalEntry.id,
  };
}

async function handleFilesystemReadTool(
  decision: FilesystemReadToolDecision,
  run: AgentRun,
  bindings: AgentOrchestratorBindings,
): Promise<ToolObservation> {
  const toolCallId = crypto.randomUUID();
  const result = await readTextFileSnippet(decision.tool.path, bindings.cwd, decision.tool.maxLines, bindings.logger);
  await bindings.addToolMessage(
    result.outputPreview,
    {
      agentRunId: run.id,
      agentToolCallId: toolCallId,
      agentToolKind: decision.tool.name,
    },
    "running",
  );
  await recordToolCall(bindings, {
    id: toolCallId,
    kind: "filesystem.read",
    status: "completed",
    summary: decision.summary,
    input: result.resolvedPath,
    command: null,
    outputPreview: truncatePreview(result.outputPreview),
    terminalEntryId: null,
    approvalId: null,
    startedAt: nowIso(),
    finishedAt: nowIso(),
  });
  return {
    summary: result.summary,
    outputPreview: result.outputPreview,
    status: "completed",
  };
}

async function handleFilesystemSearchTool(
  decision: FilesystemSearchToolDecision,
  run: AgentRun,
  bindings: AgentOrchestratorBindings,
): Promise<ToolObservation> {
  const toolCallId = crypto.randomUUID();
  const result = await searchWorkspaceText(
    decision.tool.pattern,
    decision.tool.path,
    bindings.cwd,
    decision.tool.maxResults,
    bindings.logger,
  );
  await bindings.addToolMessage(
    result.outputPreview,
    {
      agentRunId: run.id,
      agentToolCallId: toolCallId,
      agentToolKind: decision.tool.name,
    },
    "running",
  );
  await recordToolCall(bindings, {
    id: toolCallId,
    kind: "filesystem.search",
    status: "completed",
    summary: decision.summary,
    input: `${decision.tool.pattern} @ ${result.resolvedPath}`,
    command: null,
    outputPreview: truncatePreview(result.outputPreview),
    terminalEntryId: null,
    approvalId: null,
    startedAt: nowIso(),
    finishedAt: nowIso(),
  });
  return {
    summary: result.summary,
    outputPreview: result.outputPreview,
    status: "completed",
  };
}

async function executeTool(
  decision: ToolDecision,
  run: AgentRun,
  bindings: AgentOrchestratorBindings,
) {
  if (decision.tool.name === "computer.inspect") {
    return handleComputerTool(decision as ComputerToolDecision, run, bindings);
  }

  if (decision.tool.name === "filesystem.read") {
    return handleFilesystemReadTool(decision as FilesystemReadToolDecision, run, bindings);
  }

  if (decision.tool.name === "filesystem.search") {
    return handleFilesystemSearchTool(decision as FilesystemSearchToolDecision, run, bindings);
  }

  return handleShellTool(decision as ShellToolDecision, run, bindings);
}

export async function runAgentLoop(bindings: AgentOrchestratorBindings, resumeReason: string | null): Promise<AgentLoopOutcome> {
  let run = bindings.getRun();
  if (!run) {
    throw new Error("Agent run was not found.");
  }

  const safetyDecision = assessAgentObjective(run.goal);
  if (safetyDecision.kind === "blocked") {
    const message = buildBlockedObjectiveMessage(safetyDecision);
    await bindings.updateRun(
      (currentRun) => {
        currentRun.status = "blocked";
        currentRun.summary = safetyDecision.reason;
        currentRun.lastAssistantMessage = message;
        currentRun.finishedAt = nowIso();
      },
      "failed",
    );
    await bindings.addAssistantMessage(message, { agentRunId: run.id }, "failed");
    return { kind: "blocked" };
  }

  for (let pass = 0; pass < MAX_AGENT_ITERATIONS_PER_PASS; pass += 1) {
    const task = bindings.getTask();
    run = bindings.getRun();
    if (!task || !run) {
      throw new Error("Agent loop lost its task or run state.");
    }

    await bindings.updateRun(
      (currentRun) => {
        currentRun.status = "running";
        currentRun.pendingApprovalId = null;
        currentRun.iteration += 1;
      },
      "running",
    );

    const messages = buildAgentMessages(task, run, bindings, pass === 0 ? resumeReason : "continue after the previous tool result");
    let decision: AgentDecision;
    try {
      decision = await parseDecisionWithRepair(bindings, messages);
    } catch (error) {
      await bindings.logger.log(
        `Agent loop fell back to plain chat for task ${task.id}. ${error instanceof Error ? error.message : String(error)}`,
      );
      await bindings.updateRun(
        (currentRun) => {
          currentRun.status = "failed";
          currentRun.summary = "The active provider returned invalid agent protocol output.";
          currentRun.lastAssistantMessage = null;
          currentRun.finishedAt = nowIso();
        },
        "running",
      );
      return { kind: "fallback" };
    }

    await bindings.updateRun(
      (currentRun) => {
        currentRun.summary = decision.summary;
        currentRun.lastAssistantMessage = decision.message;
        currentRun.plan = normalizePlan(decision.plan);
        currentRun.finishedAt = null;
      },
      "running",
    );

    if (decision.kind !== "tool") {
      await finalizeRun(bindings, decision as FinalDecision);
      return { kind: decision.kind === "final" ? "completed" : decision.kind === "blocked" ? "blocked" : "needs_input" };
    }

    const observation = await executeTool(decision as ToolDecision, run, bindings);
    if (observation.status === "awaiting_approval") {
      return { kind: "awaiting_approval" };
    }
  }

  run = bindings.getRun();
  if (!run) {
    throw new Error("Agent run disappeared after max iterations.");
  }

  const message =
    "I made progress, but I reached the current iteration budget for one pass. Continue the agent run to keep working toward the same goal.";
  await bindings.updateRun(
    (currentRun) => {
      currentRun.status = "needs_input";
      currentRun.summary = currentRun.summary ?? "Iteration budget reached.";
      currentRun.lastAssistantMessage = message;
      currentRun.finishedAt = null;
      currentRun.pendingApprovalId = null;
    },
    "idle",
  );
  await bindings.addAssistantMessage(message, { agentRunId: run.id }, "idle");
  return { kind: "needs_input" };
}
