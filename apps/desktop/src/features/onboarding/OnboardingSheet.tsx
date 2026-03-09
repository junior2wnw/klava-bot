import { useState } from "react";
import { Button, PanelCard, Stack, TextField } from "@klava/ui";

export function OnboardingSheet({
  busy,
  error,
  onSubmit,
}: {
  busy: boolean;
  error: string | null;
  onSubmit: (payload: { apiKey: string }) => void;
}) {
  const [apiKey, setApiKey] = useState("");

  return (
    <div className="onboarding-backdrop">
      <PanelCard
        title="Connect OpenAI"
        subtitle="Secrets stay outside the transcript. Klava validates the key, auto-selects the strongest available GPT model, and keeps it refreshed."
        style={{
          width: "min(560px, calc(100vw - 40px))",
          borderRadius: 28,
        }}
      >
        <Stack gap={14}>
          <label className="field-block">
            <span>OpenAI API key</span>
            <TextField type="password" value={apiKey} onChange={setApiKey} placeholder="sk-..." />
          </label>

          <div className="example-block">
            Example first prompt:
            <code>Summarize this folder and propose the next implementation step.</code>
          </div>

          {error ? <div className="app-banner">{error}</div> : null}

          <div className="composer__actions">
            <Button
              onClick={() => onSubmit({ apiKey: apiKey.trim() })}
              disabled={busy || apiKey.trim().length < 10}
            >
              {busy ? "Validating..." : "Connect OpenAI"}
            </Button>
          </div>
        </Stack>
      </PanelCard>
    </div>
  );
}
