import { useEffect, useMemo, useState } from "react";
import type {
  LocalRuntime,
  LocalRuntimeAdvice,
  MachineProfile,
  OnboardingValidateRequest,
  ProviderId,
  ProviderSettings,
} from "@klava/contracts";
import { Button, PanelCard, Stack, TextField } from "@klava/ui";
import { useAppI18n } from "../../i18n/AppI18n";
import { LanguageSelector } from "../../i18n/LanguageSelector";
import {
  DEFAULT_LOCAL_ENDPOINTS,
  PROVIDER_CARD_ORDER,
  getProviderChoiceSummary,
  getProviderGuide,
  getProviderLabel,
  isProviderReady,
} from "../providers/providerMeta";

type SecretProviderId = "openai" | "gemini" | "groq" | "openrouter";

const SECRET_PROVIDERS: SecretProviderId[] = ["gemini", "openrouter", "groq", "openai"];

function gpuSummary(
  machineProfile: MachineProfile | null,
  t: (english: string, russian: string) => string,
) {
  if (!machineProfile?.gpus.length) {
    return t("No GPU detected", "GPU не обнаружен");
  }

  return machineProfile.gpus
    .map((gpu) => `${gpu.name}${gpu.memoryGb ? ` (${gpu.memoryGb.toFixed(1)} GB)` : ""}`)
    .join(", ");
}

function runtimeVerdictLabel(
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
      return t("unknown", "неизвестно");
  }
}

export function OnboardingSheet({
  busy,
  currentProvider,
  error,
  localRuntimeAdvice,
  machineProfile,
  onDismiss,
  onSubmit,
}: {
  busy: boolean;
  currentProvider: ProviderSettings | null;
  error: string | null;
  localRuntimeAdvice: LocalRuntimeAdvice | null;
  machineProfile: MachineProfile | null;
  onDismiss: (() => void) | null;
  onSubmit: (payload: OnboardingValidateRequest) => void;
}) {
  const { language, t } = useAppI18n();
  const [selectedProvider, setSelectedProvider] = useState<ProviderId>("gemini");
  const [secrets, setSecrets] = useState<Record<SecretProviderId, string>>({
    gemini: "",
    groq: "",
    openrouter: "",
    openai: "",
  });
  const [localRuntime, setLocalRuntime] = useState<LocalRuntime>("ollama");
  const [localApiKey, setLocalApiKey] = useState("");
  const [localApiBaseUrl, setLocalApiBaseUrl] = useState(DEFAULT_LOCAL_ENDPOINTS.ollama);

  useEffect(() => {
    if (currentProvider && (currentProvider.provider === "gonka" || isProviderReady(currentProvider))) {
      setSelectedProvider(currentProvider.provider);
    } else {
      setSelectedProvider("gemini");
    }

    if (currentProvider?.provider === "local") {
      setLocalRuntime(currentProvider.localRuntime);
      setLocalApiBaseUrl(currentProvider.apiBaseUrl);
    } else {
      setLocalRuntime(localRuntimeAdvice?.recommendedRuntime ?? "ollama");
      setLocalApiBaseUrl(DEFAULT_LOCAL_ENDPOINTS[localRuntimeAdvice?.recommendedRuntime ?? "ollama"]);
    }
  }, [currentProvider, localRuntimeAdvice?.recommendedRuntime]);

  useEffect(() => {
    setLocalApiBaseUrl((current) =>
      current.trim().length === 0 || current === DEFAULT_LOCAL_ENDPOINTS.ollama || current === DEFAULT_LOCAL_ENDPOINTS.vllm
        ? DEFAULT_LOCAL_ENDPOINTS[localRuntime]
        : current,
    );
  }, [localRuntime]);

  const guide = useMemo(
    () => getProviderGuide(selectedProvider, { localRuntime, localRuntimeAdvice, machineProfile, language }),
    [language, localRuntime, localRuntimeAdvice, machineProfile, selectedProvider],
  );
  const localAdviceOption = localRuntimeAdvice?.options.find((option) => option.runtime === localRuntime) ?? null;
  const providerReady = isProviderReady(currentProvider);
  const providerLabel = getProviderLabel(currentProvider, { language });

  function setSecret(providerId: SecretProviderId, value: string) {
    setSecrets((current) => ({
      ...current,
      [providerId]: value,
    }));
  }

  function submit() {
    if (selectedProvider === "gonka") {
      return;
    }

    if (selectedProvider === "local") {
      onSubmit({
        provider: "local",
        secret: localApiKey.trim() || null,
        localRuntime,
        apiBaseUrl: localApiBaseUrl.trim(),
      });
      return;
    }

    onSubmit({
      provider: selectedProvider,
      secret: secrets[selectedProvider].trim() || null,
    });
  }

  return (
    <div className="onboarding-backdrop">
      <PanelCard
        title={t("Choose provider", "Выберите провайдера")}
        subtitle={t(
          "Klava can now connect to Gemini, Groq, OpenRouter, OpenAI, or a local Ollama/vLLM server. The provider picker stays available later from the bottom dock.",
          "Klava умеет подключаться к Gemini, Groq, OpenRouter, OpenAI или локальному серверу Ollama/vLLM. Выбор провайдера останется доступен позже и из нижней панели.",
        )}
        actions={
          <div className="app-header__actions no-drag">
            <LanguageSelector compact />
            {onDismiss ? (
              <Button variant="ghost" onClick={onDismiss} style={{ height: 30 }}>
                {t("Close", "Закрыть")}
              </Button>
            ) : null}
          </div>
        }
        style={{
          width: "min(960px, calc(100vw - 32px))",
          borderRadius: 16,
          background: "rgba(255, 245, 235, 0.03)",
          border: "1px solid rgba(255, 245, 235, 0.06)",
        }}
      >
        <Stack gap={16}>
          <div className="provider-choice-grid provider-choice-grid--wide">
            {PROVIDER_CARD_ORDER.map((providerId) => (
              <button
                key={providerId}
                className={selectedProvider === providerId ? "provider-card provider-card--active" : "provider-card"}
                onClick={() => setSelectedProvider(providerId)}
                type="button"
              >
                <strong>{getProviderLabel(providerId, { localRuntime, language })}</strong>
                <p>{getProviderChoiceSummary(providerId, language)}</p>
              </button>
            ))}
          </div>

          <div className="provider-guide">
            <div className="provider-guide__main">
              <div className="onboarding-status">
                {guide.chips.map((chip) => (
                  <span
                    key={`${guide.title}-${chip.label}`}
                    className={chip.tone === "accent" ? "status-chip status-chip--accent" : "status-chip"}
                  >
                    {chip.label}
                  </span>
                ))}
                {providerReady ? (
                  <span className="status-chip status-chip--accent">
                    {t(`${providerLabel} already connected`, `${providerLabel} уже подключён`)}
                  </span>
                ) : null}
              </div>

              <div className="onboarding-note">
                <strong>{guide.title}</strong>
                <p>{guide.summary}</p>
                <p>{guide.hint}</p>
              </div>

              {selectedProvider === "local" ? (
                <>
                  <div className="machine-panel">
                    <div className="machine-panel__head">
                      <strong>{t("Local hardware analysis", "Анализ локального железа")}</strong>
                      <span className="status-chip status-chip--accent">
                        {runtimeVerdictLabel(localRuntimeAdvice?.verdict, t)}
                      </span>
                    </div>
                    <p>{localRuntimeAdvice?.summary ?? t("Hardware analysis is not available yet.", "Анализ железа пока недоступен.")}</p>
                    <div className="machine-facts">
                      <div className="machine-facts__item">
                        <span>RAM</span>
                        <strong>{machineProfile ? `${machineProfile.memoryGb.toFixed(1)} GB` : t("unknown", "неизвестно")}</strong>
                      </div>
                      <div className="machine-facts__item">
                        <span>CPU</span>
                        <strong>{machineProfile?.cpuModel ?? t("unknown", "неизвестно")}</strong>
                      </div>
                      <div className="machine-facts__item">
                        <span>GPU</span>
                        <strong>{gpuSummary(machineProfile, t)}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="runtime-choice-grid">
                    {(["ollama", "vllm"] as LocalRuntime[]).map((runtime) => {
                      const option = localRuntimeAdvice?.options.find((candidate) => candidate.runtime === runtime) ?? null;
                      const active = localRuntime === runtime;
                      return (
                        <button
                          key={runtime}
                          type="button"
                          className={active ? "runtime-choice runtime-choice--active" : "runtime-choice"}
                          onClick={() => setLocalRuntime(runtime)}
                        >
                          <strong>{getProviderLabel("local", { localRuntime: runtime, language })}</strong>
                          <p>{option?.summary ?? t("No recommendation available yet.", "Рекомендация пока недоступна.")}</p>
                          <span>
                            {option?.recommended
                              ? t("Recommended here", "Рекомендуется для этой машины")
                              : t("Advanced path", "Продвинутый путь")}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <label className="field-block">
                    <span>{t("Endpoint", "Endpoint")}</span>
                    <TextField value={localApiBaseUrl} onChange={setLocalApiBaseUrl} spellCheck={false} />
                    <span className="field-hint">
                      {t(
                        `Default endpoint for ${getProviderLabel("local", { localRuntime, language })} is ${DEFAULT_LOCAL_ENDPOINTS[localRuntime]}.`,
                        `Endpoint по умолчанию для ${getProviderLabel("local", { localRuntime, language })}: ${DEFAULT_LOCAL_ENDPOINTS[localRuntime]}.`,
                      )}
                    </span>
                  </label>

                  <label className="field-block">
                    <span>{guide.secretLabel}</span>
                    <TextField
                      autoComplete="off"
                      spellCheck={false}
                      type="password"
                      value={localApiKey}
                      onChange={setLocalApiKey}
                      placeholder={guide.secretPlaceholder}
                    />
                    <span className="field-hint">
                      {t(
                        "Leave this blank unless your local proxy or vLLM server explicitly requires Bearer authentication.",
                        "Оставьте поле пустым, если ваш локальный прокси или vLLM-сервер явно не требует Bearer-аутентификацию.",
                      )}
                    </span>
                  </label>

                  {localAdviceOption?.modelRecommendation ? (
                    <div className="onboarding-note">
                      <strong>{t("Recommended model", "Рекомендуемая модель")}</strong>
                      <p>{localAdviceOption.modelRecommendation.modelId}</p>
                      <p>{localAdviceOption.modelRecommendation.rationale}</p>
                    </div>
                  ) : null}
                </>
              ) : selectedProvider === "gonka" ? (
                <div className="onboarding-note onboarding-note--warning">
                  <strong>{t("GONKA is paused for now", "GONKA сейчас на паузе")}</strong>
                  <p>
                    {t(
                      "This path stays visible in Klava, but the live provider route remains intentionally disabled until the provider-side issue tracked on GitHub is resolved.",
                      "Этот путь остаётся видимым в Klava, но live-маршрут провайдера намеренно отключён, пока не будет решена проблема, отслеживаемая на GitHub.",
                    )}
                  </p>
                </div>
              ) : (
                <label className="field-block">
                  <span>{guide.secretLabel}</span>
                  <TextField
                    autoComplete="off"
                    spellCheck={false}
                    type="password"
                    value={secrets[selectedProvider as SecretProviderId]}
                    onChange={(value) => setSecret(selectedProvider as SecretProviderId, value)}
                    placeholder={guide.secretPlaceholder}
                  />
                  <span className="field-hint">
                    {t(
                      `Leave this blank if you already connected ${guide.title} on this machine and want Klava to reuse the saved key from the local encrypted vault.`,
                      `Оставьте поле пустым, если ${guide.title} уже подключён на этой машине и вы хотите, чтобы Klava использовала ключ из локального зашифрованного хранилища.`,
                    )}
                  </span>
                </label>
              )}

              {error ? <div className="app-banner">{error}</div> : null}

              <div className="composer__actions">
                {selectedProvider === "gonka" ? (
                  <Button variant="secondary" onClick={() => setSelectedProvider("gemini")} style={{ height: 34 }}>
                    {t("Use Gemini now", "Использовать Gemini сейчас")}
                  </Button>
                ) : (
                  <Button
                    onClick={submit}
                    disabled={busy || (selectedProvider === "local" && localApiBaseUrl.trim().length === 0)}
                    style={{ height: 34 }}
                  >
                    {busy ? t("Connecting...", "Подключаю...") : guide.actionLabel}
                  </Button>
                )}
              </div>
            </div>

            <div className="provider-guide__side">
              <div className="onboarding-note">
                <strong>{t("Exact setup steps", "Точные шаги настройки")}</strong>
              </div>
              <div className="provider-guide__list">
                {guide.steps.map((step, index) => (
                  <div key={`${step.title}-${index}`} className="provider-guide__step">
                    <div className="provider-guide__step-count">{index + 1}</div>
                    <div className="provider-guide__step-copy">
                      <strong>{step.title}</strong>
                      <p>{step.detail}</p>
                      {step.href ? (
                        <a className="provider-guide__link" href={step.href} rel="noreferrer" target="_blank">
                          {step.href}
                        </a>
                      ) : null}
                      {step.code ? <code className="provider-guide__code">{step.code}</code> : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Stack>
      </PanelCard>
    </div>
  );
}
