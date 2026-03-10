import { useEffect, useMemo, useState } from "react";
import type { GonkaWalletBalanceResponse } from "@klava/contracts";
import { Button, PanelCard, Stack, TextField } from "@klava/ui";
import { requestJson } from "../../app/requestJson";

export function OnboardingSheet({
  busy,
  error,
  onSubmit,
}: {
  busy: boolean;
  error: string | null;
  onSubmit: (payload: { secret: string; walletAddress?: string; mnemonicPassphrase?: string }) => void;
}) {
  const [secret, setSecret] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [mnemonicPassphrase, setMnemonicPassphrase] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [walletPreview, setWalletPreview] = useState<GonkaWalletBalanceResponse | null>(null);
  const [walletPreviewError, setWalletPreviewError] = useState<string | null>(null);
  const [walletPreviewBusy, setWalletPreviewBusy] = useState(false);
  const trimmedSecret = secret.trim();
  const trimmedWalletAddress = walletAddress.trim();

  const formatHint = useMemo(() => {
    if (!trimmedSecret) {
      return "Recommended: paste the raw private key. Recovery phrases can also be matched against the wallet address your Gonka app shows.";
    }

    if (/^(0x)?[0-9a-fA-F]{64}$/.test(trimmedSecret)) {
      return "Raw private key detected. This is the most reliable way to match the exact Gonka wallet account.";
    }

    const wordCount = trimmedSecret.split(/\s+/).filter(Boolean).length;
    if ([12, 15, 18, 21, 24].includes(wordCount)) {
      if (trimmedWalletAddress) {
        return `${wordCount}-word recovery phrase detected. Klava will scan common Gonka/Cosmos account indices locally until it matches ${trimmedWalletAddress}.`;
      }

      return `${wordCount}-word recovery phrase detected. Klava will try the standard Gonka/Cosmos path plus nearby account indices locally before probing mainnet.`;
    }

    return "The format still looks incomplete. Double-check spacing and missing words or characters.";
  }, [trimmedSecret, trimmedWalletAddress]);

  useEffect(() => {
    if (trimmedWalletAddress.length < 12) {
      setWalletPreview(null);
      setWalletPreviewError(null);
      setWalletPreviewBusy(false);
      return;
    }

    let active = true;
    const timeoutId = window.setTimeout(() => {
      setWalletPreviewBusy(true);
      setWalletPreviewError(null);

      void requestJson<GonkaWalletBalanceResponse>(
        `/gonka/balance?address=${encodeURIComponent(trimmedWalletAddress)}`,
        { method: "GET" },
      )
        .then((response) => {
          if (!active) {
            return;
          }

          setWalletPreview(response);
          setWalletPreviewError(null);
        })
        .catch((lookupError) => {
          if (!active) {
            return;
          }

          setWalletPreview(null);
          setWalletPreviewError(lookupError instanceof Error ? lookupError.message : "Unable to read balance");
        })
        .finally(() => {
          if (!active) {
            return;
          }

          setWalletPreviewBusy(false);
        });
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [trimmedWalletAddress]);

  return (
    <div className="onboarding-backdrop">
      <PanelCard
        title="Connect GONKA"
        subtitle="Secrets stay outside the transcript. Recommended input is the raw Gonka private key. Recovery phrases can also be matched against the wallet address shown in your Gonka wallet."
        style={{
          width: "min(560px, calc(100vw - 40px))",
          borderRadius: 16,
          background: "rgba(255, 255, 255, 0.04)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
        }}
      >
        <Stack gap={14}>
          <div className="onboarding-status">
            <span className="status-chip status-chip--accent">Live mainnet check</span>
            <span className="status-chip">Encrypted local vault</span>
            <span className="status-chip">Auto strongest model</span>
          </div>

          <label className="field-block">
            <span>GONKA private key or standard recovery phrase</span>
            <div className="secret-input-row">
              <TextField
                autoComplete="off"
                spellCheck={false}
                type={showSecret ? "text" : "password"}
                value={secret}
                onChange={setSecret}
                placeholder="Recommended: 0x... private key, or a standard 12/24-word phrase"
              />
              <Button variant="secondary" onClick={() => setShowSecret((value) => !value)} style={{ minWidth: 82 }}>
                {showSecret ? "Hide" : "Show"}
              </Button>
            </div>
            <span className="field-hint">{formatHint}</span>
          </label>

          <label className="field-block">
            <span>Optional wallet address</span>
            <TextField
              autoComplete="off"
              spellCheck={false}
              type="text"
              value={walletAddress}
              onChange={setWalletAddress}
              placeholder="gonka1..."
            />
            <span className="field-hint">If your wallet shows a specific gonka1... address, Klava will try to derive that exact account from the recovery phrase. Keplr can also contain Gonka accounts imported separately by raw private key; those will not match a recovery phrase here.</span>
          </label>

          {trimmedWalletAddress ? (
            <div className="wallet-preview">
              <strong>Live wallet check</strong>
              <p>
                {walletPreviewBusy
                  ? "Checking Gonka mainnet balance..."
                  : walletPreview
                    ? `${walletPreview.balance.displayAmount} ${walletPreview.balance.displayDenom}`
                    : walletPreviewError ?? "Balance unavailable"}
              </p>
              {walletPreview ? (
                <code>{walletPreview.balance.amount} {walletPreview.balance.denom}</code>
              ) : null}
            </div>
          ) : null}

          <label className="field-block">
            <span>Optional mnemonic passphrase</span>
            <TextField
              autoComplete="off"
              spellCheck={false}
              type={showSecret ? "text" : "password"}
              value={mnemonicPassphrase}
              onChange={setMnemonicPassphrase}
              placeholder="Only if your wallet uses a 25th word/passphrase"
            />
            <span className="field-hint">Leave empty unless your wallet explicitly asks for a mnemonic passphrase in addition to the recovery phrase.</span>
          </label>

          <div className="onboarding-note">
            <strong>Before Klava saves anything</strong>
            <p>It derives candidate requester addresses locally and performs one tiny live inference probe against Gonka mainnet. If you know the wallet address your Gonka app shows, enter it above so Klava can match the right derivation path first.</p>
          </div>

          <div className="example-block">
            <span>Good first prompt</span>
            <code>Summarize this folder and propose the next implementation step.</code>
          </div>

          {error ? <div className="app-banner">{error}</div> : null}

          <div className="composer__actions">
            <Button
              onClick={() =>
                onSubmit({
                  secret: trimmedSecret,
                  walletAddress: trimmedWalletAddress || undefined,
                  mnemonicPassphrase: mnemonicPassphrase.length > 0 ? mnemonicPassphrase : undefined,
                })
              }
              disabled={busy || trimmedSecret.length === 0}
            >
              {busy ? "Validating..." : "Connect GONKA"}
            </Button>
          </div>
        </Stack>
      </PanelCard>
    </div>
  );
}
