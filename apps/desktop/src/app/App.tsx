import { startTransition, useEffect, useMemo, useState } from "react";
import type {
  OnboardingValidateRequest,
  OpenClawBridgeState,
  SurfaceMode,
  SupportBundle,
  WorkspaceSnapshot,
} from "@klava/contracts";
import { Button, PanelCard } from "@klava/ui";
import { DiagnosticsPanel } from "../features/diagnostics/DiagnosticsPanel";
import { OnboardingSheet } from "../features/onboarding/OnboardingSheet";
import { OpenClawSurface } from "../features/openclaw/OpenClawSurface";
import { ProviderModelDock } from "../features/providers/ProviderModelDock";
import { getProviderLabel, isProviderReady } from "../features/providers/providerMeta";
import { useAppI18n } from "../i18n/AppI18n";
import { LanguageSelector } from "../i18n/LanguageSelector";
import { ContextPane } from "../shell/ContextPane";
import { MainSurface } from "../shell/MainSurface";
import { TaskRail } from "../shell/TaskRail";
import { requestJson } from "./requestJson";

function formatTaskCount(count: number, language: "en" | "ru") {
  if (language === "ru") {
    const mod10 = count % 10;
    const mod100 = count % 100;
    const noun =
      mod10 === 1 && mod100 !== 11 ? "задача" : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? "задачи" : "задач";
    return `${count} ${noun}`;
  }

  return `${count} ${count === 1 ? "task" : "tasks"}`;
}

function openClawStatusLabel(
  status: OpenClawBridgeState["gatewayStatus"] | undefined,
  t: (english: string, russian: string) => string,
) {
  switch (status) {
    case "starting":
      return t("starting", "Р·Р°РїСѓСЃРєР°РµС‚СЃСЏ");
    case "running":
      return t("running", "запущен");
    case "degraded":
      return t("degraded", "частично доступен");
    case "stopped":
      return t("stopped", "остановлен");
    case "unreachable":
      return t("unreachable", "недоступен");
    case "not_installed":
      return t("not installed", "не установлен");
    case "unknown":
    default:
      return t("unknown", "неизвестно");
  }
}

function openClawBadgeClass(status: OpenClawBridgeState["gatewayStatus"] | undefined) {
  switch (status) {
    case "starting":
      return "app-badge app-badge--accent";
    case "running":
      return "app-badge app-badge--success";
    case "degraded":
      return "app-badge app-badge--accent";
    case "stopped":
    case "unreachable":
      return "app-badge app-badge--danger";
    case "not_installed":
    case "unknown":
    default:
      return "app-badge";
  }
}

export function App() {
  const { language, t } = useAppI18n();
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(null);
  const [openClawState, setOpenClawState] = useState<OpenClawBridgeState | null>(null);
  const [surfaceMode, setSurfaceMode] = useState<SurfaceMode>("chat");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [openClawBusy, setOpenClawBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openClawError, setOpenClawError] = useState<string | null>(null);
  const [showProviderSetup, setShowProviderSetup] = useState(false);
  const platform = window.klava?.platform ?? import.meta.env.VITE_KLAVA_PLATFORM ?? "browser";
  const desktopBridgeAvailable = Boolean(window.klava?.getOpenClawBridgeState);

  const provider = snapshot?.provider ?? null;
  const selectedTask = snapshot?.selectedTask ?? null;
  const providerReady = isProviderReady(provider);
  const runtimeUnavailable = !loading && !snapshot;
  const showGlobalError = Boolean(error) && providerReady && Boolean(snapshot);
  const providerLabel = provider ? getProviderLabel(provider, { language }) : t("No provider", "Провайдер не выбран");
  const openClawBadgeLabel = openClawState ? `OpenClaw ${openClawStatusLabel(openClawState.gatewayStatus, t)}` : null;

  function withLanguage(init?: RequestInit): RequestInit {
    return {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        "x-klava-ui-language": language,
      },
    };
  }

  function applyOpenClawState(data: OpenClawBridgeState) {
    startTransition(() => {
      setOpenClawState(data);
    });
  }

  async function refresh(taskId?: string | null, options: { silent?: boolean } = {}) {
    if (!options.silent) {
      setLoading(true);
      setError(null);
    }

    try {
      const data = await requestJson<WorkspaceSnapshot>(
        taskId ? `/workspace?taskId=${taskId}` : "/workspace",
        withLanguage(),
      );
      startTransition(() => {
        setSnapshot(data);
      });
    } catch (requestError) {
      if (!options.silent) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : t("Local service unavailable", "Локальная служба недоступна"),
        );
      }
    } finally {
      if (!options.silent) {
        setLoading(false);
      }
    }
  }

  async function refreshOpenClaw(options: { silent?: boolean; force?: boolean } = {}) {
    const bridge = window.klava;
    if (!bridge?.getOpenClawBridgeState) {
      return;
    }

    if (!options.silent) {
      setOpenClawBusy(true);
      setOpenClawError(null);
    }

    try {
      const data = options.force
        ? await bridge.refreshOpenClawBridgeState()
        : await bridge.getOpenClawBridgeState();
      applyOpenClawState(data);
    } catch (requestError) {
      if (!options.silent) {
        setOpenClawError(
          requestError instanceof Error
            ? requestError.message
            : t("OpenClaw bridge is unavailable", "Мост OpenClaw недоступен"),
        );
      }
    } finally {
      if (!options.silent) {
        setOpenClawBusy(false);
      }
    }
  }

  async function runOpenClawMutation(
    mutation: (bridge: NonNullable<typeof window.klava>) => Promise<OpenClawBridgeState>,
  ) {
    const bridge = window.klava;
    if (!bridge) {
      return;
    }

    setOpenClawBusy(true);
    setOpenClawError(null);
    try {
      const data = await mutation(bridge);
      applyOpenClawState(data);
    } catch (requestError) {
      setOpenClawError(
        requestError instanceof Error
          ? requestError.message
          : t("OpenClaw gateway request failed", "Запрос к OpenClaw gateway завершился ошибкой"),
      );
    } finally {
      setOpenClawBusy(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [language]);

  useEffect(() => {
    void refreshOpenClaw();
  }, []);

  useEffect(() => {
    if (!snapshot?.selectedTaskId) {
      return;
    }

    const shouldPoll =
      busy || selectedTask?.status === "running" || selectedTask?.status === "awaiting_approval";
    if (!shouldPoll) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refresh(snapshot.selectedTaskId, { silent: true });
    }, 1200);

    return () => window.clearInterval(intervalId);
  }, [busy, language, selectedTask?.status, snapshot?.selectedTaskId]);

  useEffect(() => {
    if (!desktopBridgeAvailable) {
      return;
    }

    const shouldPollOpenClaw =
      runtimeUnavailable ||
      surfaceMode === "openclaw" ||
      openClawState?.gatewayStatus === "degraded" ||
      openClawState?.gatewayStatus === "starting";
    if (!shouldPollOpenClaw) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshOpenClaw({ silent: true, force: true });
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [desktopBridgeAvailable, openClawState?.gatewayStatus, runtimeUnavailable, surfaceMode]);

  const taskCountLabel = useMemo(
    () => formatTaskCount(snapshot?.tasks.length ?? 0, language),
    [language, snapshot?.tasks.length],
  );

  const platformLabel =
    platform === "win32"
      ? "Windows"
      : platform === "darwin"
        ? "macOS"
        : platform === "linux"
          ? "Linux"
          : t("Browser", "Браузер");

  async function mutate(path: string, body?: unknown, method = "POST") {
    setBusy(true);
    setError(null);
    try {
      const data = await requestJson<WorkspaceSnapshot>(
        path,
        withLanguage({
          method,
          body: body ? JSON.stringify(body) : undefined,
        }),
      );
      startTransition(() => {
        setSnapshot(data);
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t("Request failed", "Не удалось выполнить запрос"));
    } finally {
      setBusy(false);
    }
  }

  async function handleTaskCreate() {
    await mutate("/tasks", {});
  }

  async function handleTaskSelect(taskId: string) {
    await mutate(`/tasks/${taskId}`, undefined, "GET");
  }

  async function handleOnboardingSubmit(payload: OnboardingValidateRequest) {
    setBusy(true);
    setError(null);
    try {
      await requestJson(
        "/onboarding/validate",
        withLanguage({
          method: "POST",
          body: JSON.stringify(payload),
        }),
      );
      await refresh(snapshot?.selectedTaskId ?? undefined);
      setShowProviderSetup(false);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : t("Provider validation failed", "Не удалось проверить провайдера"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleExportSupportBundle() {
    try {
      const bundle = await requestJson<SupportBundle>("/support-bundle", withLanguage());
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `klava-support-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : t("Support bundle export failed", "Не удалось выгрузить пакет диагностики"),
      );
    }
  }

  async function handleRefreshProviderModels() {
    await mutate("/provider/models/refresh", {});
  }

  async function handleAutoSelectProviderModel() {
    await mutate("/provider/model/auto", {});
  }

  async function handleSelectProviderModel(model: string) {
    await mutate("/provider/model", { model });
  }

  async function handleResetProvider() {
    setShowProviderSetup(false);
    await mutate("/provider/reset", {});
  }

  async function handleOpenOpenClawWindow() {
    const bridge = window.klava;
    if (!bridge) {
      return;
    }

    setOpenClawBusy(true);
    setOpenClawError(null);
    try {
      const opened = await bridge.openOpenClawControlWindow();
      if (!opened) {
        setOpenClawError(
          t(
            "OpenClaw Control UI is not configured or reachable yet.",
            "OpenClaw Control UI пока не настроен или недоступен.",
          ),
        );
      }
      const data = await bridge.refreshOpenClawBridgeState();
      applyOpenClawState(data);
    } catch (requestError) {
      setOpenClawError(
        requestError instanceof Error
          ? requestError.message
          : t("Failed to open OpenClaw Control UI", "Не удалось открыть OpenClaw Control UI"),
      );
    } finally {
      setOpenClawBusy(false);
    }
  }

  const surfaceBusy = surfaceMode === "openclaw" ? busy || openClawBusy : busy;

  if (loading && !snapshot) {
    return <div className="app-loading">{t("Booting Klava local service...", "Запускаю локальную службу Klava...")}</div>;
  }

  if (runtimeUnavailable) {
    return (
      <div className={["app-shell", `app-shell--${platform}`].join(" ")}>
        <div className="app-shell__glow" />
        <div className="app-fatal">
          <div className="app-fatal-stack">
            <PanelCard
              title={t("Local service unavailable", "Локальная служба недоступна")}
              subtitle={desktopBridgeAvailable
                ? t(
                    "Klava could not reach the local task runtime yet. You can still recover the embedded service or jump into the upstream OpenClaw control surface if it is available.",
                    "Klava пока не подключилась к локальному task runtime. Вы всё ещё можете восстановить встроенную службу или открыть upstream-поверхность OpenClaw, если она доступна.",
                  )
                : t(
                    "Klava could not reach the local service yet. Retry after the embedded service finishes booting or after the desktop app recovers.",
                    "Klava пока не может подключиться к локальной службе. Повторите попытку после запуска встроенной службы или восстановления приложения.",
                  )}
              style={{
                width: "min(1120px, calc(100vw - 32px))",
                borderRadius: 16,
                background: "rgba(18, 15, 13, 0.78)",
                border: "1px solid rgba(255, 245, 235, 0.08)",
              }}
            >
              <div className="onboarding-status">
                <span className="status-chip">{t("Embedded service", "Встроенная служба")}</span>
                <span className="status-chip">{t("Local HTTP bridge", "Локальный HTTP bridge")}</span>
                <span className="status-chip">{t("App recovery", "Восстановление приложения")}</span>
                {openClawState ? (
                  <span className="status-chip status-chip--accent">
                    {`OpenClaw ${openClawStatusLabel(openClawState.gatewayStatus, t)}`}
                  </span>
                ) : null}
              </div>
              {error ? (
                <div className="app-banner">
                  <strong>{t("Error:", "Ошибка:")}</strong> {error}
                </div>
              ) : null}
              {openClawState?.summary ? <p className="openclaw-summary">{openClawState.summary}</p> : null}
              <div className="composer__actions">
                <LanguageSelector compact />
                {desktopBridgeAvailable ? (
                  <Button
                    variant="secondary"
                    onClick={() => void handleOpenOpenClawWindow()}
                    disabled={openClawBusy || !openClawState?.controlUiUrl}
                    style={{ height: 34 }}
                  >
                    {t("Open OpenClaw", "Открыть OpenClaw")}
                  </Button>
                ) : null}
                <Button onClick={() => void refresh()} disabled={loading} style={{ height: 34 }}>
                  {loading ? t("Retrying...", "Повторяю...") : t("Retry service", "Повторить запуск службы")}
                </Button>
              </div>
            </PanelCard>

            {desktopBridgeAvailable ? (
              <>
                {openClawError ? (
                  <div className="app-banner">
                    <strong>{t("OpenClaw:", "OpenClaw:")}</strong> {openClawError}
                  </div>
                ) : null}
                <OpenClawSurface
                  busy={openClawBusy}
                  state={openClawState}
                  onRefresh={() => refreshOpenClaw({ force: true })}
                  onOpenControlUi={handleOpenOpenClawWindow}
                  onStartGateway={() => runOpenClawMutation((bridge) => bridge.startOpenClawGateway())}
                  onStopGateway={() => runOpenClawMutation((bridge) => bridge.stopOpenClawGateway())}
                />
              </>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={["app-shell", `app-shell--${platform}`].join(" ")}>
      <div className="app-shell__glow" />
      <header className="app-header">
        <div className="app-header__brand">
          <div className="app-header__mark" aria-hidden="true">
            <span>K</span>
          </div>
          <div className="app-header__copy">
            <span className="eyebrow">{t("Local Desktop Agent", "Локальный desktop-агент")}</span>
            <h1>Klava Bot</h1>
            <p className="app-header__subtitle">
              {t(
                "Tasks, approvals, terminal control, and local service health in one surface.",
                "Задачи, подтверждения, терминал и состояние локальной службы в одном интерфейсе.",
              )}
            </p>
          </div>
        </div>
        <div className="app-header__side">
          <div className="app-header__focus">
            <span className="app-header__label">{t("Active task", "Активная задача")}</span>
            <strong>{selectedTask?.title ?? t("No task selected", "Задача не выбрана")}</strong>
            <p>
              {selectedTask?.lastMessagePreview ??
                t(
                  "Create a task or pick one from the rail to start working.",
                  "Создайте задачу или выберите её слева, чтобы начать работу.",
                )}
            </p>
          </div>
          <div className="app-header__actions no-drag">
            <LanguageSelector compact />
            <span className="app-badge">{taskCountLabel}</span>
            <span className={snapshot?.health.ok ? "app-badge app-badge--success" : "app-badge app-badge--danger"}>
              {snapshot?.health.ok ? t("Service healthy", "Служба работает") : t("Service unavailable", "Служба недоступна")}
            </span>
            {openClawBadgeLabel ? (
              <span className={openClawBadgeClass(openClawState?.gatewayStatus)}>{openClawBadgeLabel}</span>
            ) : null}
            <span className="app-badge">{providerLabel}</span>
            <span className={providerReady ? "app-badge app-badge--accent" : "app-badge"}>
              {providerReady
                ? t("Connected", "Подключён")
                : provider?.provider === "gonka"
                  ? t("Paused", "На паузе")
                  : t("Setup required", "Нужна настройка")}
            </span>
            <span className="app-badge">{platformLabel}</span>
            <Button
              variant="secondary"
              onClick={() => void refresh(snapshot?.selectedTaskId)}
              disabled={busy || loading}
              style={{ height: 32 }}
            >
              {t("Refresh", "Обновить")}
            </Button>
          </div>
        </div>
      </header>

      {showGlobalError ? (
        <div className="app-banner">
          <strong>{t("Error:", "Ошибка:")}</strong> {error}
        </div>
      ) : null}
      {openClawError ? (
        <div className="app-banner">
          <strong>{t("OpenClaw:", "OpenClaw:")}</strong> {openClawError}
        </div>
      ) : null}

      <main className="app-grid">
        <TaskRail
          busy={busy}
          selectedTaskId={snapshot?.selectedTaskId ?? null}
          tasks={snapshot?.tasks ?? []}
          onCreateTask={() => void handleTaskCreate()}
          onSelectTask={(taskId) => void handleTaskSelect(taskId)}
        />

        <MainSurface
          busy={surfaceBusy}
          onApprove={(approvalId) => mutate(`/approvals/${approvalId}/approve`, {})}
          surfaceMode={surfaceMode}
          task={selectedTask}
          onChangeSurface={setSurfaceMode}
          onReject={(approvalId) => mutate(`/approvals/${approvalId}/reject`, {})}
          onSendMessage={(content) =>
            selectedTask ? mutate(`/tasks/${selectedTask.id}/messages`, { content }) : Promise.resolve()
          }
          onRunTerminal={(command) =>
            selectedTask ? mutate(`/tasks/${selectedTask.id}/terminal`, { command }) : Promise.resolve()
          }
          onSetGuardMode={(mode) =>
            selectedTask ? mutate(`/tasks/${selectedTask.id}/guard`, { mode }) : Promise.resolve()
          }
          onCreateOperation={(payload) =>
            selectedTask ? mutate(`/tasks/${selectedTask.id}/operations`, payload) : Promise.resolve()
          }
          onAdvanceOperation={(operationId) =>
            selectedTask ? mutate(`/tasks/${selectedTask.id}/operations/${operationId}/advance`) : Promise.resolve()
          }
          onContinueAgent={(agentRunId) =>
            selectedTask ? mutate(`/tasks/${selectedTask.id}/agent-runs/${agentRunId}/continue`, {}) : Promise.resolve()
          }
          openClawState={openClawState}
          onRefreshOpenClaw={() => refreshOpenClaw({ force: true })}
          onOpenOpenClawWindow={handleOpenOpenClawWindow}
          onStartOpenClawGateway={() => runOpenClawMutation((bridge) => bridge.startOpenClawGateway())}
          onStopOpenClawGateway={() => runOpenClawMutation((bridge) => bridge.stopOpenClawGateway())}
        />

        <ContextPane
          health={snapshot?.health ?? null}
          task={selectedTask}
          onApprove={(approvalId) => void mutate(`/approvals/${approvalId}/approve`, {})}
          onReject={(approvalId) => void mutate(`/approvals/${approvalId}/reject`, {})}
        >
          <DiagnosticsPanel
            health={snapshot?.health ?? null}
            localRuntimeAdvice={snapshot?.localRuntimeAdvice ?? null}
            machineProfile={snapshot?.machineProfile ?? null}
            provider={snapshot?.provider ?? null}
            openClawState={openClawState}
            onExportSupportBundle={() => void handleExportSupportBundle()}
          />
        </ContextPane>
      </main>

      <ProviderModelDock
        busy={busy}
        provider={provider}
        onOpenProviderSetup={() => setShowProviderSetup(true)}
        onAutoSelectModel={() => handleAutoSelectProviderModel()}
        onRefreshModels={() => handleRefreshProviderModels()}
        onResetProvider={() => handleResetProvider()}
        onSelectModel={(model) => handleSelectProviderModel(model)}
      />

      {snapshot && (!providerReady || showProviderSetup) ? (
        <OnboardingSheet
          busy={busy}
          currentProvider={provider}
          error={error}
          localRuntimeAdvice={snapshot.localRuntimeAdvice ?? null}
          machineProfile={snapshot.machineProfile ?? null}
          onDismiss={providerReady ? () => setShowProviderSetup(false) : null}
          onSubmit={(payload) => void handleOnboardingSubmit(payload)}
        />
      ) : null}
    </div>
  );
}
