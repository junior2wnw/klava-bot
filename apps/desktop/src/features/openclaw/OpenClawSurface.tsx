import type { OpenClawBridgeState } from "@klava/contracts";
import { Button, PanelCard, Stack, StatusPill } from "@klava/ui";
import { useAppI18n } from "../../i18n/AppI18n";

function gatewayTone(status: OpenClawBridgeState["gatewayStatus"]) {
  switch (status) {
    case "starting":
      return "warning" as const;
    case "running":
      return "success" as const;
    case "degraded":
      return "warning" as const;
    case "stopped":
    case "unreachable":
      return "danger" as const;
    case "not_installed":
    case "unknown":
    default:
      return "neutral" as const;
  }
}

function gatewayLabel(
  status: OpenClawBridgeState["gatewayStatus"],
  t: (english: string, russian: string) => string,
) {
  switch (status) {
    case "starting":
      return t("starting", "запускается");
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

export function OpenClawSurface({
  busy,
  onOpenControlUi,
  onRefresh,
  onStartGateway,
  onStopGateway,
  state,
}: {
  busy: boolean;
  onOpenControlUi: () => Promise<void>;
  onRefresh: () => Promise<void>;
  onStartGateway: () => Promise<void>;
  onStopGateway: () => Promise<void>;
  state: OpenClawBridgeState | null;
}) {
  const { formatDateTime, t } = useAppI18n();

  if (!state) {
    return (
      <div className="surface-stack">
        <div className="empty-state">
          {t(
            "OpenClaw bridge state is not available yet. Refresh the desktop bridge and try again.",
            "Состояние моста OpenClaw пока недоступно. Обновите bridge и попробуйте ещё раз.",
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="surface-stack openclaw-surface">
      <PanelCard
        title="OpenClaw"
        subtitle={t(
          "Bundled OpenClaw runtime managed by Klava. The desktop starts it automatically, can attach to a still-running managed gateway after recovery, and exposes the full upstream Control UI.",
          "Встроенный OpenClaw runtime под управлением Klava. Desktop запускает его автоматически, может подхватить ещё живой managed gateway после восстановления и открывает полный upstream Control UI.",
        )}
        actions={
          <div className="surface-tabs">
            <Button variant="secondary" onClick={() => void onRefresh()} disabled={busy} style={{ height: 34 }}>
              {t("Refresh bridge", "Обновить bridge")}
            </Button>
            <Button onClick={() => void onOpenControlUi()} disabled={busy || !state.controlUiUrl} style={{ height: 34 }}>
              {t("Open Control UI", "Открыть Control UI")}
            </Button>
          </div>
        }
      >
        <div className="detail-line">
          <span>{t("Gateway", "Gateway")}</span>
          <StatusPill tone={gatewayTone(state.gatewayStatus)} value={gatewayLabel(state.gatewayStatus, t)} />
        </div>
        <div className="detail-line">
          <span>{t("Bridge mode", "Режим моста")}</span>
          <strong className="detail-line__value">
            {state.bridgeMode === "embedded_plus_openclaw"
              ? t("Klava + OpenClaw", "Klava + OpenClaw")
              : t("Klava only", "Только Klava")}
          </strong>
        </div>
        <div className="detail-line">
          <span>{t("Desktop ownership", "Управление desktop")}</span>
          <strong className="detail-line__value">
            {state.managedByDesktop ? t("desktop-managed", "управляется desktop") : t("external", "внешний")}
          </strong>
        </div>
        <div className="detail-line">
          <span>{t("Gateway process owner", "Владелец gateway-процесса")}</span>
          <strong className="detail-line__value">
            {state.desktopOwnsGatewayProcess
              ? t("owned by this Klava app", "принадлежит этой Klava")
              : t("attached or external", "подключённый или внешний")}
          </strong>
        </div>
        <div className="detail-line">
          <span>{t("Embedded runtime", "Встроенный runtime")}</span>
          <strong className="detail-line__value">
            {state.embeddedRuntimeAvailable
              ? state.embeddedRuntimeVersion ?? t("available", "доступен")
              : t("not available", "недоступен")}
          </strong>
        </div>
        <div className="detail-line">
          <span>{t("CLI", "CLI")}</span>
          <strong className="detail-line__value">
            {state.cliAvailable ? state.cliVersion ?? t("detected", "обнаружен") : t("not detected", "не обнаружен")}
          </strong>
        </div>
        <div className="detail-line">
          <span>{t("Control UI URL", "URL Control UI")}</span>
          <strong className="detail-line__value">{state.controlUiUrl ?? t("not configured", "не настроен")}</strong>
        </div>
        <div className="detail-line">
          <span>{t("Gateway URL", "URL gateway")}</span>
          <strong className="detail-line__value">{state.gatewayUrl ?? t("not configured", "не настроен")}</strong>
        </div>
        <div className="detail-line">
          <span>{t("Control UI probe", "Проверка Control UI")}</span>
          <strong className="detail-line__value">
            {state.controlUiReachable ? t("reachable", "доступен") : t("not confirmed", "не подтверждён")}
          </strong>
        </div>
        <div className="detail-line">
          <span>{t("Browser automation", "Браузерная автоматизация")}</span>
          <strong className="detail-line__value">
            {state.browserAutomationReady ? t("ready", "готова") : t("not ready", "не готова")}
          </strong>
        </div>
        <div className="detail-line">
          <span>{t("Desktop auth probe", "Проверка авторизации desktop")}</span>
          <strong className="detail-line__value">
            {state.authConfigured
              ? t("token/password configured", "token/password настроены")
              : t("no desktop-side auth configured", "desktop-side auth не настроен")}
          </strong>
        </div>
        <p className="openclaw-summary">{state.summary}</p>
        <div className="composer__actions">
          <Button
            onClick={() => void onStartGateway()}
            disabled={busy || !state.cliAvailable || state.gatewayStatus === "running" || state.gatewayStatus === "starting"}
            style={{ height: 34 }}
          >
            {t("Start gateway", "Запустить gateway")}
          </Button>
          <Button
            variant="secondary"
            onClick={() => void onStopGateway()}
            disabled={busy || !state.cliAvailable || !state.desktopOwnsGatewayProcess || state.gatewayStatus === "starting"}
            style={{ height: 34 }}
          >
            {t("Stop gateway", "Остановить gateway")}
          </Button>
        </div>
      </PanelCard>

      <div className="openclaw-grid">
        <PanelCard
          title={t("Upstream capabilities", "Возможности upstream")}
          subtitle={t(
            "These are the OpenClaw-level surfaces that Klava should not replace with weaker local clones.",
            "Это поверхности уровня OpenClaw, которые Klava не должна заменять более слабой локальной копией.",
          )}
        >
          <Stack gap={10}>
            {state.capabilities.map((capability) => (
              <div className="openclaw-capability" key={capability.id}>
                <div className="openclaw-capability__head">
                  <strong>{capability.title}</strong>
                  <StatusPill
                    tone={capability.available ? "success" : "neutral"}
                    value={capability.available ? t("available", "доступно") : t("not ready", "не готово")}
                  />
                </div>
                <p>{capability.description}</p>
              </div>
            ))}
          </Stack>
        </PanelCard>

        <PanelCard
          title={t("Operator notes", "Операторские заметки")}
          subtitle={t(
            "The bridge keeps raw upstream reality visible instead of pretending our local runtime already equals OpenClaw.",
            "Bridge сохраняет видимой реальную картину upstream, а не делает вид, будто локальный runtime уже равен OpenClaw.",
          )}
        >
          <Stack gap={10}>
            <div className="detail-line">
              <span>{t("Observed at", "Проверено в")}</span>
              <strong className="detail-line__value">{formatDateTime(state.detectedAt)}</strong>
            </div>
            {state.notes.length ? (
              <div className="openclaw-notes">
                {state.notes.map((note, index) => (
                  <p key={`${index}-${note}`}>{note}</p>
                ))}
              </div>
            ) : (
              <p className="detail-line__value">{t("No extra notes.", "Дополнительных заметок нет.")}</p>
            )}
          </Stack>
        </PanelCard>
      </div>

      <PanelCard
        title={t("Suggested actions", "Рекомендуемые действия")}
        subtitle={t(
          "These commands and actions close the gap between the thin Klava shell and the full upstream OpenClaw runtime.",
          "Эти команды и действия закрывают разрыв между тонкой оболочкой Klava и полным upstream runtime OpenClaw.",
        )}
      >
        <div className="openclaw-actions">
          {state.suggestedActions.map((action) => (
            <code key={action}>{action}</code>
          ))}
        </div>
      </PanelCard>
    </div>
  );
}
