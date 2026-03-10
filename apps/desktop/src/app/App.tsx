import { startTransition, useEffect, useMemo, useState } from "react";
import type { SurfaceMode, SupportBundle, WorkspaceSnapshot } from "@klava/contracts";
import { Button } from "@klava/ui";
import { OnboardingSheet } from "../features/onboarding/OnboardingSheet";
import { DiagnosticsPanel } from "../features/diagnostics/DiagnosticsPanel";
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
  const platform = window.klava?.platform ?? "browser";

  const selectedTask = snapshot?.selectedTask ?? null;
  const providerConfigured = snapshot?.provider.secretConfigured ?? false;
  const showGlobalError = Boolean(error) && providerConfigured;

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

  async function handleOnboardingSubmit(payload: {
    secret: string;
    walletAddress?: string;
    mnemonicPassphrase?: string;
  }) {
    setBusy(true);
    setError(null);
    try {
      await requestJson("/onboarding/validate", {
        method: "POST",
        body: JSON.stringify({
          provider: "gonka",
          secret: payload.secret,
          walletAddress: payload.walletAddress,
          mnemonicPassphrase: payload.mnemonicPassphrase,
        }),
      });
      await refresh(snapshot?.selectedTaskId ?? undefined);
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

  if (loading && !snapshot) {
    return <div className="app-loading">Booting Klava runtime...</div>;
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
            <span className={providerConfigured ? "app-badge app-badge--accent" : "app-badge"}>
              {providerConfigured ? "GONKA connected" : "Needs onboarding"}
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
          surfaceMode={surfaceMode}
          task={selectedTask}
          onChangeSurface={setSurfaceMode}
          onSendMessage={(content) =>
            selectedTask ? mutate(`/tasks/${selectedTask.id}/messages`, { content }) : Promise.resolve()
          }
          onRunTerminal={(command) =>
            selectedTask ? mutate(`/tasks/${selectedTask.id}/terminal`, { command }) : Promise.resolve()
          }
          onSetGuardMode={(mode) =>
            selectedTask ? mutate(`/tasks/${selectedTask.id}/guard`, { mode }) : Promise.resolve()
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
            provider={snapshot?.provider ?? null}
            onExportSupportBundle={() => void handleExportSupportBundle()}
          />
        </ContextPane>
      </main>

      {!providerConfigured ? (
        <OnboardingSheet busy={busy} error={error} onSubmit={(payload) => void handleOnboardingSubmit(payload)} />
      ) : null}
    </div>
  );
}
