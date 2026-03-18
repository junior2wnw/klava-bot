import { useMemo, useState } from "react";
import type { AgentRun, CreateOperationRequest, OperationRun, TaskDetail } from "@klava/contracts";
import { Button, PanelCard, Stack, StatusPill, TextField } from "@klava/ui";
import { useAppI18n } from "../../i18n/AppI18n";
import { getProviderLabel } from "../providers/providerMeta";

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

function operationStatusLabel(status: OperationRun["status"], t: (english: string, russian: string) => string) {
  switch (status) {
    case "draft":
      return t("draft", "черновик");
    case "running":
      return t("running", "в работе");
    case "awaiting_approval":
      return t("awaiting approval", "ждёт подтверждения");
    case "succeeded":
      return t("succeeded", "завершено");
    case "failed":
    default:
      return t("failed", "ошибка");
  }
}

function agentStatusLabel(status: AgentRun["status"], t: (english: string, russian: string) => string) {
  switch (status) {
    case "running":
      return t("running", "в работе");
    case "awaiting_approval":
      return t("awaiting approval", "ждёт подтверждения");
    case "needs_input":
      return t("needs input", "нужен ответ");
    case "succeeded":
      return t("succeeded", "завершено");
    case "blocked":
      return t("blocked", "заблокировано");
    case "failed":
    default:
      return t("failed", "ошибка");
  }
}

function planStatusLabel(
  status: TaskDetail["agentRuns"][number]["plan"][number]["status"],
  t: (english: string, russian: string) => string,
) {
  switch (status) {
    case "pending":
      return t("pending", "ожидает");
    case "running":
      return t("running", "в работе");
    case "completed":
      return t("completed", "выполнено");
    case "failed":
      return t("failed", "ошибка");
    case "blocked":
    default:
      return t("blocked", "заблокировано");
  }
}

function toolCallStatusLabel(
  status: TaskDetail["agentRuns"][number]["toolCalls"][number]["status"],
  t: (english: string, russian: string) => string,
) {
  switch (status) {
    case "completed":
      return t("completed", "выполнено");
    case "awaiting_approval":
      return t("awaiting approval", "ждёт подтверждения");
    case "blocked":
      return t("blocked", "заблокировано");
    case "failed":
    default:
      return t("failed", "ошибка");
  }
}

function toolCallKindLabel(
  kind: TaskDetail["agentRuns"][number]["toolCalls"][number]["kind"],
  t: (english: string, russian: string) => string,
) {
  switch (kind) {
    case "filesystem.read":
      return t("File read", "Чтение файла");
    case "filesystem.search":
      return t("File search", "Поиск по файлам");
    case "computer.inspect":
      return t("Computer inspection", "Проверка компьютера");
    case "shell.command":
    default:
      return t("Shell command", "Команда shell");
  }
}

function buildOperationTemplates(t: (english: string, russian: string) => string): CreateOperationRequest[] {
  return [
    {
      title: t("Repo audit runbook", "Сценарий проверки репозитория"),
      goal: t(
        "Inspect the current repo state and verify the local engineering surface.",
        "Проверить текущее состояние репозитория и убедиться, что локальная рабочая среда готова к дальнейшей работе.",
      ),
      summary: t(
        "A safe multi-step operation for proving that Klava can execute and track a real local workflow.",
        "Безопасный многошаговый сценарий, который показывает, что Klava умеет вести реальную локальную работу шаг за шагом.",
      ),
      steps: [
        {
          title: t("Document operator intent", "Зафиксировать намерение оператора"),
          detail: t(
            "Capture why this audit is being run and what will be verified before any changes.",
            "Зафиксировать, зачем запускается аудит и что именно будет проверено до любых изменений.",
          ),
          command: null,
        },
        {
          title: t("Capture git state", "Зафиксировать состояние git"),
          detail: t(
            "Check whether the workspace is clean before deeper work begins.",
            "Проверить, чисто ли рабочее дерево, прежде чем переходить к более глубокой работе.",
          ),
          command: "git status",
        },
        {
          title: t("Capture runtime versions", "Зафиксировать версии окружения"),
          detail: t(
            "Verify the local Node runtime is available before build or migration work.",
            "Проверить, что локальный Node.js доступен до сборки или миграций.",
          ),
          command: "node -v",
        },
        {
          title: t("Run repository checks", "Запустить проверки репозитория"),
          detail: t(
            "Execute the main repo verification path and keep the output attached to the task.",
            "Выполнить основной путь верификации репозитория и прикрепить результат к задаче.",
          ),
          command: "npm run check",
        },
      ],
    },
    {
      title: t("Long-task proof runbook", "Сценарий длинной операции"),
      goal: t(
        "Show that Klava can hold a multi-step machine task as an explicit operation instead of a one-shot reply.",
        "Показать, что Klava умеет вести многошаговую машинную задачу как явную операцию, а не отвечать одним сообщением.",
      ),
      summary: t(
        "Focuses on durable progress, operator notes, and terminal execution in one task transcript.",
        "Показывает устойчивый прогресс, заметки оператора и выполнение команд внутри одной задачи.",
      ),
      steps: [
        {
          title: t("Record the target outcome", "Зафиксировать целевое состояние"),
        detail: t(
          "Describe the end state before touching the machine so the operation stays reviewable.",
          "Описать конечное состояние до работы с машиной, чтобы ход операции потом было легко проверить.",
        ),
          command: null,
        },
        {
          title: t("Inventory the repo surface", "Собрать карту репозитория"),
          detail: t(
            "Gather the top-level file map that will inform the next step.",
            "Собрать верхнеуровневую карту файлов и папок, чтобы следующий шаг опирался на реальную структуру проекта.",
          ),
          command: "git ls-files",
        },
        {
          title: t("Capture package manifest", "Зафиксировать package.json"),
          detail: t(
            "Keep the package-level reality in the same task before making deeper changes.",
            "Сохранить ключевые данные из package.json в этой же задаче до более глубоких изменений.",
          ),
          command: "node -e \"console.log(require('./package.json').name)\"",
        },
        {
          title: t("Run the main build", "Запустить основную сборку"),
          detail: t(
            "Demonstrate that the operation can keep going across multiple concrete steps.",
            "Показать, что операция умеет последовательно идти через несколько конкретных шагов.",
          ),
          command: "npm run build",
        },
      ],
    },
  ];
}

function parseCustomSteps(
  raw: string,
  t: (english: string, russian: string) => string,
): CreateOperationRequest["steps"] {
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
        detail: commandPart
          ? t("Custom terminal step supplied by the operator.", "Пользовательский шаг с командой от оператора.")
          : t("Operator note step.", "Шаг-заметка оператора."),
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
  const { language, t } = useAppI18n();
  const [customTitle, setCustomTitle] = useState(() => t("Custom operation", "Пользовательская операция"));
  const [customGoal, setCustomGoal] = useState(() =>
    t(
      "Drive a real local workflow through explicit steps, commands, and approvals.",
      "Провести реальную локальную задачу через явные шаги, команды и подтверждения.",
    ),
  );
  const [customSummary, setCustomSummary] = useState(() =>
    t(
      "Each line becomes a step. Use `Title :: command` for terminal steps or just `Title` for note steps.",
      "Каждая строка превращается в шаг. Используйте `Заголовок :: команда` для шагов с командой или просто `Заголовок` для заметок.",
    ),
  );
  const [customSteps, setCustomSteps] = useState(() =>
    t(
      "Document rollback path\nCapture repo state :: git status\nCheck Node runtime :: node -v\nRun verification :: npm run check",
      "Зафиксировать путь отката\nСнять состояние репозитория :: git status\nПроверить Node.js :: node -v\nЗапустить проверку :: npm run check",
    ),
  );
  const [localError, setLocalError] = useState<string | null>(null);

  const operationTemplates = useMemo(() => buildOperationTemplates(t), [language, t]);
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
    const steps = parseCustomSteps(customSteps, t);
    if (!customTitle.trim() || !customGoal.trim()) {
      setLocalError(t("Title and goal are required.", "Нужно указать название и цель."));
      return;
    }
    if (!steps.length) {
      setLocalError(t("Add at least one step.", "Добавьте хотя бы один шаг."));
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
        title={t("Agent Layer", "Агент")}
        subtitle={t(
          "Persistent provider-agnostic planning with shell, filesystem, computer diagnostics, approvals, and resumable passes.",
          "Агент ведёт план, работает с shell и файлами, просит подтверждения и умеет продолжать ту же задачу позже.",
        )}
      >
        <div className="operation-facts">
          <span>{t(`${task.agentRuns.length} total agent runs`, `Всего запусков агента: ${task.agentRuns.length}`)}</span>
          <span>{activeAgentRun ? t("1 active agent run", "Есть активный запуск") : t("No active agent run", "Активных запусков нет")}</span>
          <span>
            {t(
              `${task.approvals.filter((approval) => approval.status === "pending").length} pending approvals`,
              `Ожидающих подтверждений: ${task.approvals.filter((approval) => approval.status === "pending").length}`,
            )}
          </span>
        </div>
      </PanelCard>

      {activeAgentRun ? (
        <PanelCard
          title={activeAgentRun.title}
          subtitle={activeAgentRun.summary ?? activeAgentRun.goal}
          actions={<StatusPill tone={agentTone(activeAgentRun.status)} value={agentStatusLabel(activeAgentRun.status, t)} />}
        >
          <div className="operation-summary">
            <div className="detail-line">
              <span>{t("Goal", "Цель")}</span>
              <strong>{activeAgentRun.goal}</strong>
            </div>
            <div className="detail-line">
              <span>{t("Iterations", "Итерации")}</span>
              <strong>
                {activeAgentRun.iteration}/{activeAgentRun.maxIterations}
              </strong>
            </div>
            <div className="detail-line">
              <span>{t("Provider", "Провайдер")}</span>
              <strong>
                {activeAgentRun.provider
                  ? `${getProviderLabel(activeAgentRun.provider, { language })}${activeAgentRun.model ? ` / ${activeAgentRun.model}` : ""}`
                  : t("n/a", "н/д")}
              </strong>
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
                      <p>{item.detail ?? t("Agent plan item.", "Шаг плана агента.")}</p>
                    </div>
                    <StatusPill tone={agentTone(item.status === "completed" ? "succeeded" : item.status === "running" ? "running" : item.status === "failed" ? "failed" : item.status === "blocked" ? "blocked" : "needs_input")} value={planStatusLabel(item.status, t)} />
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
                      <strong>{toolCallKindLabel(toolCall.kind, t)}</strong>
                      <p>{toolCall.summary}</p>
                    </div>
                    <StatusPill tone={agentTone(toolCall.status === "completed" ? "succeeded" : toolCall.status === "failed" ? "failed" : toolCall.status === "blocked" ? "blocked" : "awaiting_approval")} value={toolCallStatusLabel(toolCall.status, t)} />
                  </div>
                  {toolCall.command ? <code>{toolCall.command}</code> : null}
                </div>
              ))}
            </Stack>
          ) : null}

          <div className="composer__actions">
            {activeAgentRun.status === "awaiting_approval" ? (
              <span className="field-hint">
                {t(
                  "This agent run is paused on a guarded command approval.",
                  "Этот запуск агента остановлен и ждёт подтверждения защищённой команды.",
                )}
              </span>
            ) : activeAgentRun.status === "needs_input" ? (
              <span className="field-hint">
                {t(
                  "The last pass hit its iteration budget. Continue it to keep working toward the same goal.",
                  "Последний проход упёрся в лимит итераций. Продолжите его, чтобы агент шёл к той же цели дальше.",
                )}
              </span>
            ) : null}
            <Button
              onClick={() => void onContinueAgent(activeAgentRun.id)}
              disabled={
                busy ||
                activeAgentRun.status === "awaiting_approval" ||
                activeAgentRun.status === "succeeded" ||
                activeAgentRun.status === "failed" ||
                activeAgentRun.status === "blocked"
              }
              style={{ height: 34 }}
            >
              {busy ? t("Working...", "Работаю...") : t("Continue agent", "Продолжить запуск")}
            </Button>
          </div>
        </PanelCard>
      ) : null}

      <PanelCard
        title={t("Operations Layer", "Операции")}
        subtitle={t(
          "Durable multi-step local work with explicit progress, commands, and approvals.",
          "Многошаговая локальная работа с явным прогрессом, командами и подтверждениями.",
        )}
      >
        <div className="operation-facts">
          <span>{t(`${task.operations.length} total operations`, `Всего операций: ${task.operations.length}`)}</span>
          <span>{activeOperation ? t("1 active operation", "1 активная операция") : t("No active operation", "Активных операций нет")}</span>
          <span>
            {t(
              `${task.approvals.filter((approval) => approval.status === "pending").length} pending approvals`,
              `Ожидающих подтверждений: ${task.approvals.filter((approval) => approval.status === "pending").length}`,
            )}
          </span>
        </div>
      </PanelCard>

      {activeOperation ? (
        <PanelCard
          title={activeOperation.title}
          subtitle={activeOperation.summary ?? activeOperation.goal}
          actions={<StatusPill tone={operationTone(activeOperation.status)} value={operationStatusLabel(activeOperation.status, t)} />}
        >
          <div className="operation-summary">
            <div className="detail-line">
              <span>{t("Goal", "Цель")}</span>
              <strong>{activeOperation.goal}</strong>
            </div>
            <div className="detail-line">
              <span>{t("Steps", "Шаги")}</span>
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
                    <p>{step.detail ?? (step.command ? t("Terminal step.", "Шаг терминала.") : t("Operator note.", "Заметка оператора."))}</p>
                  </div>
                  <StatusPill tone={stepTone(step.status)} value={operationStatusLabel(step.status === "succeeded" ? "succeeded" : step.status === "awaiting_approval" ? "awaiting_approval" : step.status === "running" ? "running" : step.status === "failed" || step.status === "blocked" ? "failed" : "draft", t)} />
                </div>
                {step.command ? <code>{step.command}</code> : null}
              </div>
            ))}
          </Stack>

          <div className="composer__actions">
            {activeOperation.status === "awaiting_approval" ? (
              <span className="field-hint">
                {t(
                  "Approval is required in Context Pane before this operation can continue.",
                  "Для продолжения этой операции нужно подтверждение в панели контекста.",
                )}
              </span>
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
              {busy ? t("Working...", "Работаю...") : t("Continue next step", "Продолжить следующий шаг")}
            </Button>
          </div>
        </PanelCard>
      ) : (
        <PanelCard
          title={t("Start from a template", "Начать с шаблона")}
          subtitle={t("Use a real operation instead of a vague chat prompt.", "Лучше запускать явную операцию, чем писать расплывчатый запрос в чат.")}
        >
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
                <span>{t(`${template.steps.length} steps`, `Шагов: ${template.steps.length}`)}</span>
              </button>
            ))}
          </div>
        </PanelCard>
      )}

      <PanelCard
        title={t("Custom operation", "Пользовательская операция")}
        subtitle={t("One line per step. Use `Title :: command` for terminal steps.", "Одна строка — один шаг. Используйте `Заголовок :: команда` для шагов с командой.")}
      >
        <div className="surface-stack">
          <label className="field-block">
            <span>{t("Title", "Название")}</span>
            <TextField value={customTitle} onChange={setCustomTitle} placeholder={t("Operation title", "Название операции")} />
          </label>
          <label className="field-block">
            <span>{t("Goal", "Цель")}</span>
            <TextField value={customGoal} onChange={setCustomGoal} placeholder={t("What is the end state?", "Какое должно быть конечное состояние?")} />
          </label>
          <label className="field-block">
            <span>{t("Summary", "Описание")}</span>
            <TextField value={customSummary} onChange={setCustomSummary} placeholder={t("Short public description of the runbook", "Коротко опишите смысл операции")} />
          </label>
          <label className="field-block">
            <span>{t("Steps", "Шаги")}</span>
            <TextField multiline rows={7} value={customSteps} onChange={setCustomSteps} />
            <span className="field-hint">{t("Lines without `::` become reviewable note steps.", "Строки без `::` сохраняются как заметки и не выполняются в терминале.")}</span>
          </label>
          {localError ? <div className="field-hint field-hint--danger">{localError}</div> : null}
          <div className="composer__actions">
            <Button variant="secondary" onClick={() => setCustomSteps("")} disabled={busy}>
              {t("Clear", "Очистить")}
            </Button>
            <Button onClick={() => void handleCreateCustom()} disabled={busy}>
              {busy ? t("Creating...", "Создаю...") : t("Create operation", "Создать операцию")}
            </Button>
          </div>
        </div>
      </PanelCard>

      {recentAgentRuns.length ? (
        <PanelCard
          title={t("Agent history", "История агента")}
          subtitle={t("Every autonomous run stays attached to the task with plan and tool history.", "Каждый автономный запуск сохраняется в задаче вместе с планом и историей вызовов инструментов.")}
        >
          <Stack gap={10}>
            {recentAgentRuns.map((run) => (
              <div className="operation-history" key={run.id}>
                <div className="operation-step__head">
                  <div>
                    <strong>{run.title}</strong>
                    <p>{run.summary ?? run.goal}</p>
                  </div>
                  <StatusPill tone={agentTone(run.status)} value={agentStatusLabel(run.status, t)} />
                </div>
                <span className="field-hint">
                  {t(
                    `${run.toolCalls.length} tool calls, iteration ${run.iteration}/${run.maxIterations}`,
                    `Вызовов инструментов: ${run.toolCalls.length}, итерация ${run.iteration}/${run.maxIterations}`,
                  )}
                </span>
              </div>
            ))}
          </Stack>
        </PanelCard>
      ) : null}

      {recentOperations.length ? (
        <PanelCard title={t("Operation history", "История операций")} subtitle={t("Every run stays attached to the task.", "Каждый запуск сохраняется внутри задачи.")}>
          <Stack gap={10}>
            {recentOperations.map((operation) => (
              <div className="operation-history" key={operation.id}>
                <div className="operation-step__head">
                  <div>
                    <strong>{operation.title}</strong>
                    <p>{operation.summary ?? operation.goal}</p>
                  </div>
                  <StatusPill tone={operationTone(operation.status)} value={operationStatusLabel(operation.status, t)} />
                </div>
                <span className="field-hint">
                  {t(
                    `${operation.steps.filter((step) => step.status === "succeeded").length}/${operation.steps.length} steps completed`,
                    `Выполнено шагов: ${operation.steps.filter((step) => step.status === "succeeded").length}/${operation.steps.length}`,
                  )}
                </span>
              </div>
            ))}
          </Stack>
        </PanelCard>
      ) : null}
    </div>
  );
}
