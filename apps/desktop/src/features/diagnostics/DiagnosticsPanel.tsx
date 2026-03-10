import type { HealthResponse, ProviderSettings } from "@klava/contracts";
import { Button, PanelCard } from "@klava/ui";

export function DiagnosticsPanel({
  health,
  onExportSupportBundle,
  provider,
}: {
  health: HealthResponse | null;
  onExportSupportBundle: () => void;
  provider: ProviderSettings | null;
}) {
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
          {provider?.secretConfigured ? "validated and ready" : "not configured"}
        </strong>
      </div>
      <div className="detail-line">
        <span>Provider</span>
        <strong className="detail-line__value">{provider?.provider ?? "none"}</strong>
      </div>
      <div className="detail-line">
        <span>Model policy</span>
        <strong className="detail-line__value">{provider ? "auto strongest Gonka mainnet model" : "not configured"}</strong>
      </div>
      <div className="detail-line">
        <span>Current model</span>
        <strong className="detail-line__value">{provider?.model ?? "not configured"}</strong>
      </div>
      <div className="detail-line">
        <span>Requester</span>
        <strong className="detail-line__value">{provider?.requesterAddress ?? "not configured"}</strong>
      </div>
      <div className="detail-line">
        <span>Balance</span>
        <strong className="detail-line__value">
          {provider?.balance ? `${provider.balance.displayAmount} ${provider.balance.displayDenom}` : "unknown"}
        </strong>
      </div>
      <div className="detail-line">
        <span>Atomic balance</span>
        <strong className="detail-line__value">
          {provider?.balance ? `${provider.balance.amount} ${provider.balance.denom}` : "unknown"}
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
        <span>Uptime</span>
        <strong className="detail-line__value">{health ? `${Math.round(health.uptimeMs / 1000)}s` : "unknown"}</strong>
      </div>
    </PanelCard>
  );
}
