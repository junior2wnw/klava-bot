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
      return t("workable", "можно использовать");
    case "not_recommended":
      return t("not recommended", "не рекомендуется");
    default:
      return t("not available", "недоступно");
  }
}

function formatUptime(uptimeMs: number | null | undefined, language: "en" | "ru") {
  if (!uptimeMs || uptimeMs < 0) {
    return language === "ru" ? "неизвестно" : "unknown";
  }

  const totalSeconds = Math.round(uptimeMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];

  if (hours > 0) {
    parts.push(language === "ru" ? `${hours} ч` : `${hours} h`);
  }
  if (minutes > 0) {
    parts.push(language === "ru" ? `${minutes} мин` : `${minutes} min`);
  }
  if (seconds > 0 || parts.length === 0) {
    parts.push(language === "ru" ? `${seconds} с` : `${seconds} s`);
  }

  return parts.join(" ");
}

function formatModelPolicy(
  provider: ProviderSettings | null,
  providerLabel: string,
  t: (english: string, russian: string) => string,
) {
  if (!provider) {
    return t("not configured", "не настроено");
  }

  if (provider.provider === "gonka") {
    return t("paused Gonka path", "маршрут GONKA на паузе");
  }

  if (provider.selectionMode === "manual") {
    return t(`model pinned manually in ${providerLabel}`, `Модель выбрана вручную в ${providerLabel}`);
  }

  return t(`${providerLabel} selects the model automatically`, `${providerLabel} подбирает модель автоматически`);
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
      subtitle={t("Fast facts for support and debugging.", "Ключевые данные для поддержки и отладки.")}
      actions={
        <Button variant="secondary" onClick={onExportSupportBundle} style={{ height: 34 }}>
          {t("Export bundle", "Скачать пакет диагностики")}
        </Button>
      }
    >
      <div className="detail-line">
        <span>{t("Connection", "Подключение")}</span>
        <strong className="detail-line__value">
          {providerReady
            ? t("validated and ready", "проверено, можно работать")
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
        <span>{t("Model policy", "Выбор модели")}</span>
        <strong className="detail-line__value">{formatModelPolicy(provider, providerLabel, t)}</strong>
      </div>
      <div className="detail-line">
        <span>{t("Current model", "Активная модель")}</span>
        <strong className="detail-line__value">{provider?.model ?? t("not configured", "не настроено")}</strong>
      </div>
      <div className="detail-line">
        <span>{t("Available models", "Доступные модели")}</span>
        <strong className="detail-line__value">
          {provider?.availableModels?.length ? `${provider.availableModels.length}` : t("unknown", "неизвестно")}
        </strong>
      </div>
      <div className="detail-line">
        <span>{t("Endpoint", "API-адрес")}</span>
        <strong className="detail-line__value">
          {provider?.provider === "gonka" ? t("n/a for GONKA", "н/д для GONKA") : provider?.apiBaseUrl ?? t("not configured", "не настроено")}
        </strong>
      </div>
      <div className="detail-line">
        <span>{t("Local runtime", "Локальная ИИ-служба")}</span>
        <strong className="detail-line__value">
          {provider?.provider === "local" ? getProviderLabel("local", { localRuntime: provider.localRuntime, language }) : t("n/a", "н/д")}
        </strong>
      </div>
      <div className="detail-line">
        <span>{t("Requester", "Адрес requester-сервиса")}</span>
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
        <span>{t("Atomic balance", "Баланс в базовых единицах")}</span>
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
        <strong className="detail-line__value">{t("included in bundle export", "включены в пакет диагностики")}</strong>
      </div>
      <div className="detail-line">
        <span>{t("Machine", "Машина")}</span>
        <strong className="detail-line__value">
          {machineProfile ? `${machineProfile.platformLabel}, ${machineProfile.memoryGb.toFixed(1)} ${language === "ru" ? "ГБ ОЗУ" : "GB RAM"}` : t("unknown", "неизвестно")}
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
        <span>{t("Local advice", "Рекомендация по локальному запуску")}</span>
        <strong className="detail-line__value">{localRuntimeAdvice?.summary ?? t("not available", "недоступно")}</strong>
      </div>
      <div className="detail-line">
        <span>{t("Preferred local", "Итоговая оценка")}</span>
        <strong className="detail-line__value">{verdictLabel(localRuntimeAdvice?.verdict, t)}</strong>
      </div>
      <div className="detail-line">
        <span>{t("Uptime", "Время работы")}</span>
        <strong className="detail-line__value">{formatUptime(health?.uptimeMs, language)}</strong>
      </div>
    </PanelCard>
  );
}
