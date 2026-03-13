import { useMemo, useState } from "react";
import type { AgentRun, CreateOperationRequest, OperationRun, TaskDetail } from "@klava/contracts";
import { Button, PanelCard, Stack, StatusPill, TextField } from "@klava/ui";

const operationTemplates: CreateOperationRequest[] = [
  {
    title: "Repo audit runbook",
    goal: "Inspect the current repo state and verify the local engineering surface.",
    summary: "A safe multi-step operation for proving that Klava can execute and track a real local workflow.",
    steps: [
      {
        title: "Document operator intent",
        detail: "Capture why this audit is being run and what will be verified before any changes.",
        command: null,
      },
      {
        title: "Capture git state",
        detail: "Check whether the workspace is clean before deeper work begins.",
        command: "git status",
      },
      {
        title: "Capture runtime versions",
        detail: "Verify the local Node runtime is available before build or migration work.",
        command: "node -v",
      },
      {
        title: "Run repository checks",
        detail: "Execute the main repo verification path and keep the output attached to the task.",
        command: "npm run check",
      },
    ],
  },
  {
    title: "Long-task proof runbook",
    goal: "Show that Klava can hold a multi-step machine task as an explicit operation instead of a one-shot reply.",
    summary: "Focuses on durable progress, operator notes, and terminal execution in one task transcript.",
    steps: [
      {
        title: "Record the target outcome",
        detail: "Describe the end state before touching the machine so the operation stays reviewable.",
        command: null,
      },
      {
        title: "Inventory the repo surface",
        detail: "Gather the top-level file map that will inform the next step.",
        command: "git ls-files",
      },
      {
        title: "Capture package manifest",
        detail: "Keep the package-level reality in the same task before making deeper changes.",
        command: "node -e \"console.log(require('./package.json').name)\"",
      },
      {
        title: "Run the main build",
        detail: "Demonstrate that the operation can keep going across multiple concrete steps.",
        command: "npm run build",
      },
    ],
  },
];

function operationTone(status: OperationRun["status"]) {
  return status === "succeeded"
    ? "success"
    : status === "failed"
      ? "danger"
      : status === "awaiting_approval"
        ? "warning"
        : status === "running"
          ? "accent"
          : "neutral";
}

function stepTone(status: OperationRun["steps"][number]["status"]) {
  return status === "succeeded"
    ? "success"
    : status === "failed" || status === "blocked"
      ? "danger"
      : status === "awaiting_approval"
        ? "warning"
        : status === "running"
          ? "accent"
      : "neutral";
}

function agentTone(status: AgentRun["status"]) {
  return status === "succeeded"
    ? "success"
    : status === "failed" || status === "blocked"
      ? "danger"
      : status === "awaiting_approval"
        ? "warning"
        : status === "running"
          ? "accent"
          : "neutral";
}

function parseCustomSteps(raw: string): CreateOperationRequest["steps"] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [rawTitle, rawCommand] = line.split("::");
      const titlePart = rawTitle?.trim() ?? "";
      const commandPart = rawCommand?.trim() ?? "";
      return {
        title: titlePart,
        detail: commandPart ? "Custom terminal step supplied by the operator." : "Operator note step.",
        command: commandPart || null,
      };
    });
}

export function ProSurface({
  busy,
  task,
  onAdvanceOperation,
  onCreateOperation,
  onContinueAgent,
}: {
  busy: boolean;
  task: TaskDetail;
  onAdvanceOperation: (operationId: string) => Promise<void>;
  onCreateOperation: (payload: CreateOperationRequest) => Promise<void>;
  onContinueAgent: (agentRunId: string) => Promise<void>;
}) {
  const [customTitle, setCustomTitle] = useState("Custom operation");
  const [customGoal, setCustomGoal] = useState("Drive a real local workflow through explicit steps, commands, and approvals.");
  const [customSummary, setCustomSummary] = useState("Each line becomes a step. Use `Title :: command` for terminal steps or just `Title` for note steps.");
  const [customSteps, setCustomSteps] = useState(
    "Document rollback path\nCapture repo state :: git status\nCheck Node runtime :: node -v\nRun verification :: npm run check",
  );
  const [localError, setLocalError] = useState<string | null>(null);

  const activeOperation = useMemo(
    () =>
      task.operations.find(
        (operation) =>
          operation.status === "draft" || operation.status === "running" || operation.status === "awaiting_approval",
      ) ?? null,
    [task.operations],
  );

  const activeAgentRun = useMemo(
    () =>
      task.agentRuns.find(
        (run) => run.status === "running" || run.status === "awaiting_approval" || run.status === "needs_input",
      ) ?? null,
    [task.agentRuns],
  );

  const recentAgentRuns = useMemo(() => task.agentRuns.slice().reverse(), [task.agentRuns]);
  const recentOperations = useMemo(() => task.operations.slice().reverse(), [task.operations]);

  async function handleCreateTemplate(template: CreateOperationRequest) {
    setLocalError(null);
    await onCreateOperation(template);
  }

  async function handleCreateCustom() {
    const steps = parseCustomSteps(customSteps);
    if (!customTitle.trim() || !customGoal.trim()) {
      setLocalError("Title and goal are required.");
      return;
    }
    if (!steps.length) {
      setLocalError("Add at least one step.");
      return;
    }

    setLocalError(null);
    await onCreateOperation({
      title: customTitle.trim(),
      goal: customGoal.trim(),
      summary: customSummary.trim(),
      steps,
    });
  }

  return (
    <div className="surface-stack">
      <PanelCard
        title="Agent Layer"
        subtitle="Persistent provider-agnostic planning with shell, filesystem, computer diagnostics, approvals, and resumable passes."
      >
        <div className="operation-facts">
          <span>{task.agentRuns.length} total agent runs</span>
          <span>{activeAgentRun ? "1 active agent run" : "No active agent run"}</span>
          <span>{task.approvals.filter((approval) => approval.status === "pending").length} pending approvals</span>
        </div>
      </PanelCard>

      {activeAgentRun ? (
        <PanelCard
          title={activeAgentRun.title}
          subtitle={activeAgentRun.summary ?? activeAgentRun.goal}
          actions={<StatusPill tone={agentTone(activeAgentRun.status)} value={activeAgentRun.status.replace("_", " ")} />}
        >
          <div className="operation-summary">
            <div className="detail-line">
              <span>Goal</span>
              <strong>{activeAgentRun.goal}</strong>
            </div>
            <div className="detail-line">
              <span>Iterations</span>
              <strong>
                {activeAgentRun.iteration}/{activeAgentRun.maxIterations}
              </strong>
            </div>
            <div className="detail-line">
              <span>Provider</span>
              <strong>{activeAgentRun.provider ? `${activeAgentRun.provider}${activeAgentRun.model ? ` / ${activeAgentRun.model}` : ""}` : "n/a"}</strong>
            </div>
          </div>

          {activeAgentRun.plan.length ? (
            <Stack gap={10}>
              {activeAgentRun.plan.map((item, index) => (
                <div className="operation-step" key={item.id}>
                  <div className="operation-step__head">
                    <div>
                      <strong>
                        {index + 1}. {item.title}
                      </strong>
                      <p>{item.detail ?? "Agent plan item."}</p>
                    </div>
                    <StatusPill tone={agentTone(item.status === "completed" ? "succeeded" : item.status === "running" ? "running" : item.status === "failed" ? "failed" : item.status === "blocked" ? "blocked" : "needs_input")} value={item.status} />
                  </div>
                </div>
              ))}
            </Stack>
          ) : null}

          {activeAgentRun.toolCalls.length ? (
            <Stack gap={10}>
              {activeAgentRun.toolCalls.slice(0, 4).map((toolCall) => (
                <div className="operation-step" key={toolCall.id}>
                  <div className="operation-step__head">
                    <div>
                      <strong>{toolCall.kind}</strong>
                      <p>{toolCall.summary}</p>
                    </div>
                    <StatusPill tone={agentTone(toolCall.status === "completed" ? "succeeded" : toolCall.status === "failed" ? "failed" : toolCall.status === "blocked" ? "blocked" : "awaiting_approval")} value={toolCall.status.replace("_", " ")} />
                  </div>
                  {toolCall.command ? <code>{toolCall.command}</code> : null}
                </div>
              ))}
            </Stack>
          ) : null}

          <div className="composer__actions">
            {activeAgentRun.status === "awaiting_approval" ? (
              <span className="field-hint">This agent run is paused on a guarded command approval.</span>
            ) : activeAgentRun.status === "needs_input" ? (
              <span className="field-hint">The last pass hit its iteration budget. Continue it to keep working toward the same goal.</span>
            ) : null}
            <Button
              onClick={() => void onContinueAgent(activeAgentRun.id)}
              disabled={busy || activeAgentRun.status === "awaiting_approval" || activeAgentRun.status === "succeeded" || activeAgentRun.status === "failed" || activeAgentRun.status === "blocked"}
              style={{ height: 34 }}
            >
              {busy ? "Working..." : "Continue agent"}
            </Button>
          </div>
        </PanelCard>
      ) : null}

      <PanelCard
        title="Operations Layer"
        subtitle="Durable multi-step local work with explicit progress, commands, and approvals."
      >
        <div className="operation-facts">
          <span>{task.operations.length} total operations</span>
          <span>{activeOperation ? "1 active operation" : "No active operation"}</span>
          <span>{task.approvals.filter((approval) => approval.status === "pending").length} pending approvals</span>
        </div>
      </PanelCard>

      {activeOperation ? (
        <PanelCard
          title={activeOperation.title}
          subtitle={activeOperation.summary ?? activeOperation.goal}
          actions={<StatusPill tone={operationTone(activeOperation.status)} value={activeOperation.status.replace("_", " ")} />}
        >
          <div className="operation-summary">
            <div className="detail-line">
              <span>Goal</span>
              <strong>{activeOperation.goal}</strong>
            </div>
            <div className="detail-line">
              <span>Steps</span>
              <strong>
                {activeOperation.steps.filter((step) => step.status === "succeeded").length}/{activeOperation.steps.length}
              </strong>
            </div>
          </div>

          <Stack gap={10}>
            {activeOperation.steps.map((step, index) => (
              <div className="operation-step" key={step.id}>
                <div className="operation-step__head">
                  <div>
                    <strong>
                      {index + 1}. {step.title}
                    </strong>
                    <p>{step.detail ?? (step.command ? "Terminal step." : "Operator note.")}</p>
                  </div>
                  <StatusPill tone={stepTone(step.status)} value={step.status.replace("_", " ")} />
                </div>
                {step.command ? <code>{step.command}</code> : null}
              </div>
            ))}
          </Stack>

          <div className="composer__actions">
            {activeOperation.status === "awaiting_approval" ? (
              <span className="field-hint">Approval is required in Context Pane before this operation can continue.</span>
            ) : null}
            <Button
              onClick={() => void onAdvanceOperation(activeOperation.id)}
              disabled={
                busy ||
                activeOperation.status === "awaiting_approval" ||
                activeOperation.status === "succeeded" ||
                activeOperation.status === "failed"
              }
              style={{ height: 34 }}
            >
              {busy ? "Working..." : "Continue next step"}
            </Button>
          </div>
        </PanelCard>
      ) : (
        <PanelCard title="Start from a template" subtitle="Use a real operation instead of a vague chat prompt.">
          <div className="operation-template-grid">
            {operationTemplates.map((template) => (
              <button
                key={template.title}
                className="operation-template"
                onClick={() => void handleCreateTemplate(template)}
                type="button"
              >
                <strong>{template.title}</strong>
                <p>{template.goal}</p>
                <span>{template.steps.length} steps</span>
              </button>
            ))}
          </div>
        </PanelCard>
      )}

      <PanelCard title="Custom operation" subtitle="One line per step. Use `Title :: command` for terminal steps.">
        <div className="surface-stack">
          <label className="field-block">
            <span>Title</span>
            <TextField value={customTitle} onChange={setCustomTitle} placeholder="Operation title" />
          </label>
          <label className="field-block">
            <span>Goal</span>
            <TextField value={customGoal} onChange={setCustomGoal} placeholder="What is the end state?" />
          </label>
          <label className="field-block">
            <span>Summary</span>
            <TextField value={customSummary} onChange={setCustomSummary} placeholder="Short public description of the runbook" />
          </label>
          <label className="field-block">
            <span>Steps</span>
            <TextField multiline rows={7} value={customSteps} onChange={setCustomSteps} />
            <span className="field-hint">Lines without `::` become reviewable note steps.</span>
          </label>
          {localError ? <div className="field-hint field-hint--danger">{localError}</div> : null}
          <div className="composer__actions">
            <Button variant="secondary" onClick={() => setCustomSteps("")} disabled={busy}>
              Clear
            </Button>
            <Button onClick={() => void handleCreateCustom()} disabled={busy}>
              {busy ? "Creating..." : "Create operation"}
            </Button>
          </div>
        </div>
      </PanelCard>

      {recentAgentRuns.length ? (
        <PanelCard title="Agent history" subtitle="Every autonomous run stays attached to the task with plan and tool history.">
          <Stack gap={10}>
            {recentAgentRuns.map((run) => (
              <div className="operation-history" key={run.id}>
                <div className="operation-step__head">
                  <div>
                    <strong>{run.title}</strong>
                    <p>{run.summary ?? run.goal}</p>
                  </div>
                  <StatusPill tone={agentTone(run.status)} value={run.status.replace("_", " ")} />
                </div>
                <span className="field-hint">
                  {run.toolCalls.length} tool calls, iteration {run.iteration}/{run.maxIterations}
                </span>
              </div>
            ))}
          </Stack>
        </PanelCard>
      ) : null}

      {recentOperations.length ? (
        <PanelCard title="Operation history" subtitle="Every run stays attached to the task.">
          <Stack gap={10}>
            {recentOperations.map((operation) => (
              <div className="operation-history" key={operation.id}>
                <div className="operation-step__head">
                  <div>
                    <strong>{operation.title}</strong>
                    <p>{operation.summary ?? operation.goal}</p>
                  </div>
                  <StatusPill tone={operationTone(operation.status)} value={operation.status.replace("_", " ")} />
                </div>
                <span className="field-hint">
                  {operation.steps.filter((step) => step.status === "succeeded").length}/{operation.steps.length} steps completed
                </span>
              </div>
            ))}
          </Stack>
        </PanelCard>
      ) : null}
    </div>
  );
}
