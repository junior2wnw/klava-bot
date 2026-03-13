import { startTransition, useEffect, useMemo, useState } from "react";
import type { OnboardingValidateRequest, SurfaceMode, SupportBundle, WorkspaceSnapshot } from "@klava/contracts";
import { Button, PanelCard } from "@klava/ui";
import { OnboardingSheet } from "../features/onboarding/OnboardingSheet";
import { DiagnosticsPanel } from "../features/diagnostics/DiagnosticsPanel";
import { ProviderModelDock } from "../features/providers/ProviderModelDock";
import { getProviderLabel, isProviderReady } from "../features/providers/providerMeta";
import { ContextPane } from "../shell/ContextPane";
import { MainSurface } from "../shell/MainSurface";
import { TaskRail } from "../shell/TaskRail";
import { requestJson } from "./requestJson";

export function App() {
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(null);
  const [surfaceMode, setSurfaceMode] = useState<SurfaceMode>("chat");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showProviderSetup, setShowProviderSetup] = useState(false);
  const platform = window.klava?.platform ?? "browser";

  const provider = snapshot?.provider ?? null;
  const selectedTask = snapshot?.selectedTask ?? null;
  const providerReady = isProviderReady(provider);
  const runtimeUnavailable = !loading && !snapshot;
  const showGlobalError = Boolean(error) && providerReady && Boolean(snapshot);
  const providerLabel = getProviderLabel(provider);

  async function refresh(taskId?: string | null) {
    setLoading(true);
    setError(null);
    try {
      const data = await requestJson<WorkspaceSnapshot>(taskId ? `/workspace?taskId=${taskId}` : "/workspace");
      startTransition(() => {
        setSnapshot(data);
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Runtime unavailable");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const taskCountLabel = useMemo(() => {
    const count = snapshot?.tasks.length ?? 0;
    return `${count} ${count === 1 ? "task" : "tasks"}`;
  }, [snapshot?.tasks.length]);

  const platformLabel =
    platform === "win32"
      ? "Windows"
      : platform === "darwin"
        ? "macOS"
        : platform === "linux"
          ? "Linux"
          : "Browser";

  async function mutate(path: string, body?: unknown, method = "POST") {
    setBusy(true);
    setError(null);
    try {
      const data = await requestJson<WorkspaceSnapshot>(path, {
        method,
        body: body ? JSON.stringify(body) : undefined,
      });
      startTransition(() => {
        setSnapshot(data);
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Request failed");
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
      await requestJson("/onboarding/validate", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      await refresh(snapshot?.selectedTaskId ?? undefined);
      setShowProviderSetup(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Provider validation failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleExportSupportBundle() {
    try {
      const bundle = await requestJson<SupportBundle>("/support-bundle");
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `klava-support-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Support bundle export failed");
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

  if (loading && !snapshot) {
    return <div className="app-loading">Booting Klava runtime...</div>;
  }

  if (runtimeUnavailable) {
    return (
      <div className={["app-shell", `app-shell--${platform}`].join(" ")}>
        <div className="app-shell__glow" />
        <div className="app-fatal">
          <PanelCard
            title="Runtime unavailable"
            subtitle="Klava could not reach the local runtime yet. Retry after the embedded runtime finishes booting or after the desktop process recovers."
            style={{
              width: "min(560px, calc(100vw - 32px))",
              borderRadius: 16,
              background: "rgba(18, 15, 13, 0.78)",
              border: "1px solid rgba(255, 245, 235, 0.08)",
            }}
          >
            <div className="onboarding-status">
              <span className="status-chip">Embedded runtime</span>
              <span className="status-chip">Local HTTP bridge</span>
              <span className="status-chip">Desktop process recovery</span>
            </div>
            {error ? (
              <div className="app-banner">
                <strong>Problem:</strong> {error}
              </div>
            ) : null}
            <div className="composer__actions">
              <Button onClick={() => void refresh()} disabled={loading} style={{ height: 34 }}>
                {loading ? "Retrying..." : "Retry runtime"}
              </Button>
            </div>
          </PanelCard>
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
            <span className="eyebrow">Local Desktop Operator</span>
            <h1>Klava Bot</h1>
            <p className="app-header__subtitle">
              Tasks, approvals, terminal control, and runtime health in one local surface.
            </p>
          </div>
        </div>
        <div className="app-header__side">
          <div className="app-header__focus">
            <span className="app-header__label">Focused task</span>
            <strong>{selectedTask?.title ?? "No active task selected"}</strong>
            <p>{selectedTask?.lastMessagePreview ?? "Create a task or pick one from the rail to start working."}</p>
          </div>
          <div className="app-header__actions no-drag">
            <span className="app-badge">{taskCountLabel}</span>
            <span className={snapshot?.health.ok ? "app-badge app-badge--success" : "app-badge app-badge--danger"}>
              {snapshot?.health.ok ? "Runtime healthy" : "Runtime unavailable"}
            </span>
            <span className={providerReady ? "app-badge app-badge--accent" : "app-badge"}>
              {providerReady ? `${providerLabel} connected` : provider?.provider === "gonka" ? "GONKA paused" : "Needs onboarding"}
            </span>
            <span className="app-badge">{platformLabel}</span>
            <Button
              variant="secondary"
              onClick={() => void refresh(snapshot?.selectedTaskId)}
              disabled={busy || loading}
              style={{ height: 32 }}
            >
              Refresh
            </Button>
          </div>
        </div>
      </header>

      {showGlobalError ? (
        <div className="app-banner">
          <strong>Problem:</strong> {error}
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
          busy={busy}
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
          localRuntimeAdvice={snapshot?.localRuntimeAdvice ?? null}
          machineProfile={snapshot?.machineProfile ?? null}
          onDismiss={providerReady ? () => setShowProviderSetup(false) : null}
          onSubmit={(payload) => void handleOnboardingSubmit(payload)}
        />
      ) : null}
    </div>
  );
}
