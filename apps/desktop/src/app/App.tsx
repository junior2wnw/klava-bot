import { startTransition, useEffect, useMemo, useState } from "react";
import type { SurfaceMode, SupportBundle, WorkspaceSnapshot } from "@klava/contracts";
import { Button, PanelCard, tokens } from "@klava/ui";
import { OnboardingSheet } from "../features/onboarding/OnboardingSheet";
import { DiagnosticsPanel } from "../features/diagnostics/DiagnosticsPanel";
import { ContextPane } from "../shell/ContextPane";
import { MainSurface } from "../shell/MainSurface";
import { TaskRail } from "../shell/TaskRail";

type RuntimeError = {
  message: string;
};

function getRuntimeBaseUrl() {
  return window.klava?.runtimeUrl ?? import.meta.env.VITE_RUNTIME_URL ?? "/api";
}

async function requestJson<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${getRuntimeBaseUrl()}${path}`, {
    headers: {
      "content-type": "application/json",
    },
    ...init,
  });

  const payload = (await response.json()) as T | RuntimeError;
  if (!response.ok) {
    const errorMessage =
      typeof payload === "object" && payload !== null && "message" in payload && typeof payload.message === "string"
        ? payload.message
        : "Request failed";
    throw new Error(errorMessage);
  }
  return payload as T;
}

export function App() {
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(null);
  const [surfaceMode, setSurfaceMode] = useState<SurfaceMode>("chat");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedTask = snapshot?.selectedTask ?? null;
  const providerConfigured = snapshot?.provider.apiKeyConfigured ?? false;

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

  async function handleOnboardingSubmit(payload: { apiKey: string }) {
    setBusy(true);
    setError(null);
    try {
      await requestJson("/onboarding/validate", {
        method: "POST",
        body: JSON.stringify({
          provider: "openai",
          apiKey: payload.apiKey,
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
    <div className="app-shell">
      <div className="app-shell__glow" />
      <header className="app-header">
        <div>
          <span className="eyebrow">Klava Bot</span>
          <h1>Local-first desktop operator</h1>
        </div>
        <div className="app-header__actions">
          <PanelCard
            style={{
              padding: 12,
              minWidth: 180,
            }}
            title={taskCountLabel}
            subtitle={snapshot?.health.ok ? "Runtime healthy" : "Runtime unavailable"}
            actions={
              <Button variant="secondary" onClick={() => void refresh(snapshot?.selectedTaskId)} style={{ height: 34 }}>
                Refresh
              </Button>
            }
          />
        </div>
      </header>

      {error ? (
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
