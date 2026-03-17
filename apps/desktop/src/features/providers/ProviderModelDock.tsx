import type { ProviderSettings } from "@klava/contracts";
import { Button } from "@klava/ui";
import { useAppI18n } from "../../i18n/AppI18n";
import { getProviderLabel, isProviderReady } from "./providerMeta";

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
  const modelCountLabel = formatModelCount(availableModels.length, language);
  const providerSummary =
    providerReady && provider
      ? provider.provider === "local"
        ? t(
            `Selection mode: ${provider.selectionMode}. ${modelCountLabel} available from ${provider.apiBaseUrl}.`,
            `Режим выбора: ${provider.selectionMode}. Доступно ${modelCountLabel} по адресу ${provider.apiBaseUrl}.`,
          )
        : t(
            `Selection mode: ${provider.selectionMode}. ${modelCountLabel} available from the live provider list.`,
            `Режим выбора: ${provider.selectionMode}. Доступно ${modelCountLabel} из live-списка провайдера.`,
          )
      : provider?.provider === "gonka"
        ? t(
            "GONKA stays visible here, but the current desktop path is paused until the provider-side issue is resolved.",
            "GONKA остаётся видимым здесь, но текущий desktop-путь приостановлен до решения проблемы на стороне провайдера.",
          )
        : t(
            "Connect a provider to load the live model list and use the working chat path.",
            "Подключите провайдера, чтобы загрузить live-список моделей и использовать рабочий чат-путь.",
          );

  return (
    <footer className="model-dock">
      <div className="model-dock__summary">
        <div className="model-dock__badges">
          <span className="app-badge">{providerLabel}</span>
          <span className={providerReady ? "app-badge app-badge--success" : "app-badge"}>
            {providerReady
              ? t("Ready for chat", "Готов к чату")
              : provider?.provider === "gonka"
                ? t("Paused", "Пауза")
                : t("Setup required", "Нужна настройка")}
          </span>
          {provider?.model ? <span className="app-badge app-badge--accent">{provider.model}</span> : null}
          {provider?.selectionMode ? <span className="app-badge">{provider.selectionMode}</span> : null}
          {provider?.provider === "local" ? <span className="app-badge">{provider.localRuntime}</span> : null}
        </div>
        <span className="field-hint">
          {providerSummary}{" "}
          {t(
            "Use `/models`, `/model auto`, or `/model <name>` directly in chat if you want to switch models without the footer selector.",
            "Используйте `/models`, `/model auto` или `/model <name>` прямо в чате, если хотите переключать модели без нижнего селектора.",
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
          {t("Refresh models", "Обновить модели")}
        </Button>
        <Button
          variant="secondary"
          onClick={() => void onAutoSelectModel()}
          disabled={!providerReady || busy || provider?.selectionMode !== "manual"}
          style={{ height: 34 }}
        >
          {t("Use auto", "Включить авто")}
        </Button>
        <Button variant="secondary" onClick={onOpenProviderSetup} disabled={busy} style={{ height: 34 }}>
          {t("Provider setup", "Настройка провайдера")}
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
