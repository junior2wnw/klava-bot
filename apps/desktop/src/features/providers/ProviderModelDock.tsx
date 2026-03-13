import type { ProviderSettings } from "@klava/contracts";
import { Button } from "@klava/ui";
import { getProviderLabel, isProviderReady } from "./providerMeta";

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
  const providerReady = isProviderReady(provider);
  const availableModels = provider?.availableModels?.length ? provider.availableModels : provider?.model ? [provider.model] : [];
  const providerLabel = getProviderLabel(provider);
  const providerSummary =
    providerReady && provider
      ? provider.provider === "local"
        ? `Selection mode: ${provider.selectionMode}. ${availableModels.length} model${availableModels.length === 1 ? "" : "s"} available from ${provider.apiBaseUrl}.`
        : `Selection mode: ${provider.selectionMode}. ${availableModels.length} model${availableModels.length === 1 ? "" : "s"} available from the live provider list.`
      : provider?.provider === "gonka"
        ? "GONKA stays visible here, but the current desktop path is paused until the provider-side issue is resolved."
        : "Connect a provider to load the live model list and use the working chat path.";

  return (
    <footer className="model-dock">
      <div className="model-dock__summary">
        <div className="model-dock__badges">
          <span className="app-badge">{providerLabel}</span>
          <span className={providerReady ? "app-badge app-badge--success" : "app-badge"}>
            {providerReady ? "Ready for chat" : provider?.provider === "gonka" ? "Paused" : "Setup required"}
          </span>
          {provider?.model ? <span className="app-badge app-badge--accent">{provider.model}</span> : null}
          {provider?.selectionMode ? <span className="app-badge">{provider.selectionMode}</span> : null}
          {provider?.provider === "local" ? <span className="app-badge">{provider.localRuntime}</span> : null}
        </div>
        <span className="field-hint">
          {providerSummary} Use `/models`, `/model auto`, or `/model &lt;name&gt;` directly in chat if you want to switch models without the footer selector.
        </span>
      </div>

      <div className="model-dock__controls">
        <label className="model-dock__field">
          <span>Model</span>
          <select
            className="model-dock__select"
            disabled={!providerReady || busy || availableModels.length === 0}
            value={provider?.model ?? ""}
            onChange={(event) => void onSelectModel(event.target.value)}
          >
            {availableModels.length === 0 ? <option value="">No models loaded</option> : null}
            {availableModels.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </label>

        <Button variant="secondary" onClick={() => void onRefreshModels()} disabled={!providerReady || busy} style={{ height: 34 }}>
          Refresh models
        </Button>
        <Button
          variant="secondary"
          onClick={() => void onAutoSelectModel()}
          disabled={!providerReady || busy || provider?.selectionMode !== "manual"}
          style={{ height: 34 }}
        >
          Use auto
        </Button>
        <Button variant="secondary" onClick={onOpenProviderSetup} disabled={busy} style={{ height: 34 }}>
          Provider setup
        </Button>
        <Button
          variant="danger"
          onClick={() => void onResetProvider()}
          disabled={busy || !provider?.secretConfigured}
          style={{ height: 34 }}
        >
          Disconnect
        </Button>
      </div>
    </footer>
  );
}
