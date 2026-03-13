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

function gpuSummary(machineProfile: MachineProfile | null) {
  if (!machineProfile?.gpus.length) {
    return "No GPU detected";
  }

  return machineProfile.gpus
    .map((gpu) => `${gpu.name}${gpu.memoryGb ? ` (${gpu.memoryGb.toFixed(1)} GB)` : ""}`)
    .join(", ");
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
    () => getProviderGuide(selectedProvider, { localRuntime, localRuntimeAdvice, machineProfile }),
    [selectedProvider, localRuntime, localRuntimeAdvice, machineProfile],
  );
  const localAdviceOption = localRuntimeAdvice?.options.find((option) => option.runtime === localRuntime) ?? null;
  const providerReady = isProviderReady(currentProvider);
  const providerLabel = getProviderLabel(currentProvider);

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
        title="Choose provider"
        subtitle="Klava can now connect to Gemini, Groq, OpenRouter, OpenAI, or a local Ollama/vLLM server. The provider picker stays available later from the bottom dock."
        actions={
          onDismiss ? (
            <Button variant="ghost" onClick={onDismiss} style={{ height: 30 }}>
              Close
            </Button>
          ) : null
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
                <strong>{getProviderLabel(providerId, localRuntime)}</strong>
                <p>{getProviderChoiceSummary(providerId)}</p>
              </button>
            ))}
          </div>

          <div className="provider-guide">
            <div className="provider-guide__main">
              <div className="onboarding-status">
                {guide.chips.map((chip) => (
                  <span key={chip} className={chip === "Recommended here" ? "status-chip status-chip--accent" : "status-chip"}>
                    {chip}
                  </span>
                ))}
                {providerReady ? <span className="status-chip status-chip--accent">{providerLabel} already connected</span> : null}
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
                      <strong>Local hardware analysis</strong>
                      <span className="status-chip status-chip--accent">
                        {localRuntimeAdvice?.verdict ?? "unknown"}
                      </span>
                    </div>
                    <p>{localRuntimeAdvice?.summary ?? "Hardware analysis is not available yet."}</p>
                    <div className="machine-facts">
                      <div className="machine-facts__item">
                        <span>RAM</span>
                        <strong>{machineProfile ? `${machineProfile.memoryGb.toFixed(1)} GB` : "unknown"}</strong>
                      </div>
                      <div className="machine-facts__item">
                        <span>CPU</span>
                        <strong>{machineProfile?.cpuModel ?? "unknown"}</strong>
                      </div>
                      <div className="machine-facts__item">
                        <span>GPU</span>
                        <strong>{gpuSummary(machineProfile)}</strong>
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
                          <strong>{getProviderLabel("local", runtime)}</strong>
                          <p>{option?.summary ?? "No recommendation available yet."}</p>
                          <span>{option?.recommended ? "Recommended here" : "Advanced path"}</span>
                        </button>
                      );
                    })}
                  </div>

                  <label className="field-block">
                    <span>Endpoint</span>
                    <TextField value={localApiBaseUrl} onChange={setLocalApiBaseUrl} spellCheck={false} />
                    <span className="field-hint">
                      Default endpoint for {getProviderLabel("local", localRuntime)} is {DEFAULT_LOCAL_ENDPOINTS[localRuntime]}.
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
                      Leave this blank unless your local proxy or vLLM server explicitly requires Bearer authentication.
                    </span>
                  </label>

                  {localAdviceOption?.modelRecommendation ? (
                    <div className="onboarding-note">
                      <strong>Recommended model</strong>
                      <p>{localAdviceOption.modelRecommendation.modelId}</p>
                      <p>{localAdviceOption.modelRecommendation.rationale}</p>
                    </div>
                  ) : null}
                </>
              ) : selectedProvider === "gonka" ? (
                <div className="onboarding-note onboarding-note--warning">
                  <strong>GONKA is paused for now</strong>
                  <p>
                    This path stays visible in Klava, but the live provider route remains intentionally disabled until the
                    provider-side issue tracked on GitHub is resolved.
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
                    Leave this blank if you already connected {guide.title} on this machine and want Klava to reuse the saved key from the local encrypted vault.
                  </span>
                </label>
              )}

              {error ? <div className="app-banner">{error}</div> : null}

              <div className="composer__actions">
                {selectedProvider === "gonka" ? (
                  <Button variant="secondary" onClick={() => setSelectedProvider("gemini")} style={{ height: 34 }}>
                    Use Gemini now
                  </Button>
                ) : (
                  <Button
                    onClick={submit}
                    disabled={busy || (selectedProvider === "local" && localApiBaseUrl.trim().length === 0)}
                    style={{ height: 34 }}
                  >
                    {busy ? "Connecting..." : guide.actionLabel}
                  </Button>
                )}
              </div>
            </div>

            <div className="provider-guide__side">
              <div className="onboarding-note">
                <strong>Exact setup steps</strong>
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
