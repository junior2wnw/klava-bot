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
        <span>Provider</span>
        <strong>{provider?.provider ?? "none"}</strong>
      </div>
      <div className="detail-line">
        <span>Model policy</span>
        <strong>{provider ? "auto frontier GPT" : "not configured"}</strong>
      </div>
      <div className="detail-line">
        <span>Current model</span>
        <strong>{provider?.model ?? "not configured"}</strong>
      </div>
      <div className="detail-line">
        <span>Last refresh</span>
        <strong>{provider?.modelRefreshedAt ? new Date(provider.modelRefreshedAt).toLocaleString() : "never"}</strong>
      </div>
      <div className="detail-line">
        <span>Uptime</span>
        <strong>{health ? `${Math.round(health.uptimeMs / 1000)}s` : "unknown"}</strong>
      </div>
    </PanelCard>
  );
}
