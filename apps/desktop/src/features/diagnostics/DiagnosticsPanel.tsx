import type { HealthResponse, LocalRuntimeAdvice, MachineProfile, ProviderSettings } from "@klava/contracts";
import { Button, PanelCard } from "@klava/ui";
import { useAppI18n } from "../../i18n/AppI18n";
import { getProviderLabel, isProviderReady } from "../providers/providerMeta";

function verdictLabel(
  verdict: LocalRuntimeAdvice["verdict"] | null | undefined,
  t: (english: string, russian: string) => string,
) {
  switch (verdict) {
    case "recommended":
      return t("recommended", "рекомендуется");
    case "workable":
      return t("workable", "рабочий вариант");
    case "not_recommended":
      return t("not recommended", "не рекомендуется");
    default:
      return t("not available", "недоступно");
  }
}

export function DiagnosticsPanel({
  health,
  localRuntimeAdvice,
  machineProfile,
  onExportSupportBundle,
  provider,
}: {
  health: HealthResponse | null;
  localRuntimeAdvice: LocalRuntimeAdvice | null;
  machineProfile: MachineProfile | null;
  onExportSupportBundle: () => void;
  provider: ProviderSettings | null;
}) {
  const { formatDateTime, language, t } = useAppI18n();
  const providerReady = isProviderReady(provider);
  const providerLabel = getProviderLabel(provider, { language });
  const gpuSummary =
    machineProfile?.gpus.length ? machineProfile.gpus.map((gpu) => gpu.name).join(", ") : t("no GPU detected", "GPU не обнаружен");

  return (
    <PanelCard
      title={t("Diagnostics", "Диагностика")}
      subtitle={t("Fast facts for support and debugging.", "Быстрые факты для поддержки и отладки.")}
      actions={
        <Button variant="secondary" onClick={onExportSupportBundle} style={{ height: 34 }}>
          {t("Export bundle", "Экспортировать bundle")}
        </Button>
      }
    >
      <div className="detail-line">
        <span>{t("Connection", "Подключение")}</span>
        <strong className="detail-line__value">
          {providerReady
            ? t("validated and ready", "проверено и готово")
            : provider?.provider === "gonka"
              ? t("paused", "на паузе")
              : t("not configured", "не настроено")}
        </strong>
      </div>
      <div className="detail-line">
        <span>{t("Provider", "Провайдер")}</span>
        <strong className="detail-line__value">{providerLabel}</strong>
      </div>
      <div className="detail-line">
        <span>{t("Model policy", "Политика модели")}</span>
        <strong className="detail-line__value">
          {provider && provider.provider !== "gonka"
            ? provider.selectionMode === "manual"
              ? t(`manual ${providerLabel} selection`, `ручной выбор ${providerLabel}`)
              : t(`auto selected from ${providerLabel}`, `автовыбор из ${providerLabel}`)
            : provider?.provider === "gonka"
              ? t("paused Gonka path", "путь Gonka на паузе")
              : t("not configured", "не настроено")}
        </strong>
      </div>
      <div className="detail-line">
        <span>{t("Current model", "Текущая модель")}</span>
        <strong className="detail-line__value">{provider?.model ?? t("not configured", "не настроено")}</strong>
      </div>
      <div className="detail-line">
        <span>{t("Available models", "Доступные модели")}</span>
        <strong className="detail-line__value">
          {provider?.availableModels?.length ? `${provider.availableModels.length}` : t("unknown", "неизвестно")}
        </strong>
      </div>
      <div className="detail-line">
        <span>{t("Endpoint", "Endpoint")}</span>
        <strong className="detail-line__value">
          {provider?.provider === "gonka" ? t("n/a for GONKA", "н/д для GONKA") : provider?.apiBaseUrl ?? t("not configured", "не настроено")}
        </strong>
      </div>
      <div className="detail-line">
        <span>{t("Local runtime", "Локальный runtime")}</span>
        <strong className="detail-line__value">
          {provider?.provider === "local" ? provider.localRuntime : t("n/a", "н/д")}
        </strong>
      </div>
      <div className="detail-line">
        <span>{t("Requester", "Requester")}</span>
        <strong className="detail-line__value">
          {provider?.provider === "gonka" ? provider.requesterAddress ?? t("not configured", "не настроено") : t("n/a", "н/д")}
        </strong>
      </div>
      <div className="detail-line">
        <span>{t("Balance", "Баланс")}</span>
        <strong className="detail-line__value">
          {provider?.provider === "gonka" && provider.balance
            ? `${provider.balance.displayAmount} ${provider.balance.displayDenom}`
            : t("n/a", "н/д")}
        </strong>
      </div>
      <div className="detail-line">
        <span>{t("Atomic balance", "Атомарный баланс")}</span>
        <strong className="detail-line__value">
          {provider?.provider === "gonka" && provider.balance
            ? `${provider.balance.amount} ${provider.balance.denom}`
            : t("n/a", "н/д")}
        </strong>
      </div>
      <div className="detail-line">
        <span>{t("Last validation", "Последняя проверка")}</span>
        <strong className="detail-line__value">
          {provider?.validatedAt ? formatDateTime(provider.validatedAt) : t("never", "никогда")}
        </strong>
      </div>
      <div className="detail-line">
        <span>{t("Balance checked", "Проверка баланса")}</span>
        <strong className="detail-line__value">
          {provider?.balance?.asOf ? formatDateTime(provider.balance.asOf) : t("never", "никогда")}
        </strong>
      </div>
      <div className="detail-line">
        <span>{t("Last refresh", "Последнее обновление")}</span>
        <strong className="detail-line__value">
          {provider?.modelRefreshedAt ? formatDateTime(provider.modelRefreshedAt) : t("never", "никогда")}
        </strong>
      </div>
      <div className="detail-line">
        <span>{t("Support logs", "Логи поддержки")}</span>
        <strong className="detail-line__value">{t("included in bundle export", "входят в экспорт bundle")}</strong>
      </div>
      <div className="detail-line">
        <span>{t("Machine", "Машина")}</span>
        <strong className="detail-line__value">
          {machineProfile ? `${machineProfile.platformLabel}, ${machineProfile.memoryGb.toFixed(1)} GB RAM` : t("unknown", "неизвестно")}
        </strong>
      </div>
      <div className="detail-line">
        <span>{t("CPU", "CPU")}</span>
        <strong className="detail-line__value">{machineProfile?.cpuModel ?? t("unknown", "неизвестно")}</strong>
      </div>
      <div className="detail-line">
        <span>{t("GPU", "GPU")}</span>
        <strong className="detail-line__value">{gpuSummary}</strong>
      </div>
      <div className="detail-line">
        <span>{t("Local advice", "Локальная рекомендация")}</span>
        <strong className="detail-line__value">{localRuntimeAdvice?.summary ?? t("not available", "недоступно")}</strong>
      </div>
      <div className="detail-line">
        <span>{t("Preferred local", "Предпочтительный локальный вариант")}</span>
        <strong className="detail-line__value">{verdictLabel(localRuntimeAdvice?.verdict, t)}</strong>
      </div>
      <div className="detail-line">
        <span>{t("Uptime", "Uptime")}</span>
        <strong className="detail-line__value">{health ? `${Math.round(health.uptimeMs / 1000)}s` : t("unknown", "неизвестно")}</strong>
      </div>
    </PanelCard>
  );
}
