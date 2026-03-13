import type { HealthResponse, LocalRuntimeAdvice, MachineProfile, ProviderSettings } from "@klava/contracts";
import { Button, PanelCard } from "@klava/ui";
import { getProviderLabel, isProviderReady } from "../providers/providerMeta";

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
  const providerReady = isProviderReady(provider);
  const providerLabel = getProviderLabel(provider);
  const gpuSummary =
    machineProfile?.gpus.length ? machineProfile.gpus.map((gpu) => gpu.name).join(", ") : "no GPU detected";

  return (
    <PanelCard
      title="Diagnostics"
      subtitle="Fast facts for support and debugging."
      actions={
        <Button variant="secondary" onClick={onExportSupportBundle} style={{ height: 34 }}>
          Export bundle
        </Button>
      }
    >
      <div className="detail-line">
        <span>Connection</span>
        <strong className="detail-line__value">
          {providerReady ? "validated and ready" : provider?.provider === "gonka" ? "paused" : "not configured"}
        </strong>
      </div>
      <div className="detail-line">
        <span>Provider</span>
        <strong className="detail-line__value">{providerLabel}</strong>
      </div>
      <div className="detail-line">
        <span>Model policy</span>
        <strong className="detail-line__value">
          {provider && provider.provider !== "gonka"
            ? provider.selectionMode === "manual"
              ? `manual ${providerLabel} selection`
              : `auto selected from ${providerLabel}`
            : provider?.provider === "gonka"
              ? "paused Gonka path"
              : "not configured"}
        </strong>
      </div>
      <div className="detail-line">
        <span>Current model</span>
        <strong className="detail-line__value">{provider?.model ?? "not configured"}</strong>
      </div>
      <div className="detail-line">
        <span>Available models</span>
        <strong className="detail-line__value">
          {provider?.availableModels?.length ? `${provider.availableModels.length}` : "unknown"}
        </strong>
      </div>
      <div className="detail-line">
        <span>Endpoint</span>
        <strong className="detail-line__value">
          {provider?.provider === "gonka" ? "n/a for GONKA" : provider?.apiBaseUrl ?? "not configured"}
        </strong>
      </div>
      <div className="detail-line">
        <span>Local runtime</span>
        <strong className="detail-line__value">
          {provider?.provider === "local" ? provider.localRuntime : "n/a"}
        </strong>
      </div>
      <div className="detail-line">
        <span>Requester</span>
        <strong className="detail-line__value">
          {provider?.provider === "gonka" ? provider.requesterAddress ?? "not configured" : "n/a"}
        </strong>
      </div>
      <div className="detail-line">
        <span>Balance</span>
        <strong className="detail-line__value">
          {provider?.provider === "gonka" && provider.balance ? `${provider.balance.displayAmount} ${provider.balance.displayDenom}` : "n/a"}
        </strong>
      </div>
      <div className="detail-line">
        <span>Atomic balance</span>
        <strong className="detail-line__value">
          {provider?.provider === "gonka" && provider.balance ? `${provider.balance.amount} ${provider.balance.denom}` : "n/a"}
        </strong>
      </div>
      <div className="detail-line">
        <span>Last validation</span>
        <strong className="detail-line__value">
          {provider?.validatedAt ? new Date(provider.validatedAt).toLocaleString() : "never"}
        </strong>
      </div>
      <div className="detail-line">
        <span>Balance checked</span>
        <strong className="detail-line__value">
          {provider?.balance?.asOf ? new Date(provider.balance.asOf).toLocaleString() : "never"}
        </strong>
      </div>
      <div className="detail-line">
        <span>Last refresh</span>
        <strong className="detail-line__value">
          {provider?.modelRefreshedAt ? new Date(provider.modelRefreshedAt).toLocaleString() : "never"}
        </strong>
      </div>
      <div className="detail-line">
        <span>Support logs</span>
        <strong className="detail-line__value">included in bundle export</strong>
      </div>
      <div className="detail-line">
        <span>Machine</span>
        <strong className="detail-line__value">
          {machineProfile ? `${machineProfile.platformLabel}, ${machineProfile.memoryGb.toFixed(1)} GB RAM` : "unknown"}
        </strong>
      </div>
      <div className="detail-line">
        <span>CPU</span>
        <strong className="detail-line__value">{machineProfile?.cpuModel ?? "unknown"}</strong>
      </div>
      <div className="detail-line">
        <span>GPU</span>
        <strong className="detail-line__value">{gpuSummary}</strong>
      </div>
      <div className="detail-line">
        <span>Local advice</span>
        <strong className="detail-line__value">{localRuntimeAdvice?.summary ?? "not available"}</strong>
      </div>
      <div className="detail-line">
        <span>Preferred local</span>
        <strong className="detail-line__value">
          {localRuntimeAdvice?.recommendedRuntime ?? localRuntimeAdvice?.cloudFallbackProvider ?? "not available"}
        </strong>
      </div>
      <div className="detail-line">
        <span>Uptime</span>
        <strong className="detail-line__value">{health ? `${Math.round(health.uptimeMs / 1000)}s` : "unknown"}</strong>
      </div>
    </PanelCard>
  );
}
