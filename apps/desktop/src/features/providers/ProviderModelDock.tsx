import type { ProviderSettings } from "@klava/contracts";
import { Button } from "@klava/ui";
import { useAppI18n } from "../../i18n/AppI18n";
import { getProviderLabel, getSelectionModeLabel, isProviderReady } from "./providerMeta";

function formatModelCount(count: number, language: "en" | "ru") {
  if (language === "ru") {
    const mod10 = count % 10;
    const mod100 = count % 100;
    const noun = mod10 === 1 && mod100 !== 11 ? "модель" : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? "модели" : "моделей";
    return `${count} ${noun}`;
  }

  return `${count} model${count === 1 ? "" : "s"}`;
}

export function ProviderModelDock({
  busy,
  provider,
  onAutoSelectModel,
  onOpenProviderSetup,
  onRefreshModels,
  onResetProvider,
  onSelectModel,
}: {
  busy: boolean;
  provider: ProviderSettings | null;
  onAutoSelectModel: () => Promise<void>;
  onOpenProviderSetup: () => void;
  onRefreshModels: () => Promise<void>;
  onResetProvider: () => Promise<void>;
  onSelectModel: (model: string) => Promise<void>;
}) {
  const { language, t } = useAppI18n();
  const providerReady = isProviderReady(provider);
  const availableModels = provider?.availableModels?.length ? provider.availableModels : provider?.model ? [provider.model] : [];
  const providerLabel = getProviderLabel(provider, { language });
  const selectionModeLabel = getSelectionModeLabel(provider?.selectionMode, language);
  const modelCountLabel = formatModelCount(availableModels.length, language);
  const providerSummary =
    providerReady && provider
      ? provider.provider === "local"
        ? t(
            `Model selection: ${selectionModeLabel}. ${modelCountLabel} available from ${provider.apiBaseUrl}.`,
            `Режим выбора: ${selectionModeLabel}. Клава видит ${modelCountLabel} на локальном сервере ${provider.apiBaseUrl}.`,
          )
        : t(
            `Model selection: ${selectionModeLabel}. ${modelCountLabel} available from the provider list.`,
            `Режим выбора: ${selectionModeLabel}. Сейчас доступно ${modelCountLabel} от ${providerLabel}.`,
          )
      : provider?.provider === "gonka"
        ? t(
            "GONKA stays visible here, but the current desktop path is paused until the provider-side issue is resolved.",
            "GONKA остаётся видимой в интерфейсе, но маршрут подключения в настольной версии приостановлен до решения проблемы на стороне провайдера.",
          )
        : t(
            "Connect a provider to load the live model list and use the working chat path.",
            "Подключите провайдера, чтобы загрузить список моделей и полноценно работать через чат.",
          );

  return (
    <footer className="model-dock">
      <div className="model-dock__summary">
        <div className="model-dock__badges">
          <span className="app-badge">{providerLabel}</span>
          <span className={providerReady ? "app-badge app-badge--success" : "app-badge"}>
            {providerReady
              ? t("Ready for chat", "Чат готов")
              : provider?.provider === "gonka"
                ? t("Paused", "На паузе")
                : t("Setup required", "Нужна настройка")}
          </span>
          {provider?.model ? <span className="app-badge app-badge--accent">{provider.model}</span> : null}
          {provider?.selectionMode ? (
            <span className="app-badge">{getSelectionModeLabel(provider.selectionMode, language, { capitalized: true })}</span>
          ) : null}
          {provider?.provider === "local" ? <span className="app-badge">{provider.localRuntime === "ollama" ? "Ollama" : "vLLM"}</span> : null}
        </div>
        <span className="field-hint">
          {providerSummary}{" "}
          {t(
            "Use `/models`, `/model auto`, or `/model <name>` directly in chat if you want to switch models without the footer selector.",
            "Модели можно переключать и прямо из чата: посмотреть список через `/models`, вернуть автовыбор через `/model auto` или зафиксировать модель командой `/model <name>`.",
          )}
        </span>
      </div>

      <div className="model-dock__controls">
        <label className="model-dock__field">
          <span>{t("Model", "Модель")}</span>
          <select
            className="model-dock__select"
            disabled={!providerReady || busy || availableModels.length === 0}
            value={provider?.model ?? ""}
            onChange={(event) => void onSelectModel(event.target.value)}
          >
            {availableModels.length === 0 ? <option value="">{t("No models loaded", "Модели не загружены")}</option> : null}
            {availableModels.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </label>

        <Button variant="secondary" onClick={() => void onRefreshModels()} disabled={!providerReady || busy} style={{ height: 34 }}>
          {t("Refresh models", "Обновить список")}
        </Button>
        <Button
          variant="secondary"
          onClick={() => void onAutoSelectModel()}
          disabled={!providerReady || busy || provider?.selectionMode !== "manual"}
          style={{ height: 34 }}
        >
          {t("Use auto", "Автовыбор")}
        </Button>
        <Button variant="secondary" onClick={onOpenProviderSetup} disabled={busy} style={{ height: 34 }}>
          {t("Provider setup", "Настроить провайдера")}
        </Button>
        <Button
          variant="danger"
          onClick={() => void onResetProvider()}
          disabled={busy || !provider?.secretConfigured}
          style={{ height: 34 }}
        >
          {t("Disconnect", "Отключить")}
        </Button>
      </div>
    </footer>
  );
}
