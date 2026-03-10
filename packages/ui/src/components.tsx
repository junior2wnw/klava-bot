import type { CSSProperties, PropsWithChildren, ReactNode } from "react";
import { tokens } from "./tokens";

type CardProps = PropsWithChildren<{
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  style?: CSSProperties;
}>;

export function PanelCard({ title, subtitle, actions, style, children }: CardProps) {
  return (
    <section
      style={{
        background: tokens.color.surface,
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.md,
        boxShadow: tokens.shadow.panel,
        padding: tokens.spacing.md,
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacing.md,
        ...style,
      }}
    >
      {(title || subtitle || actions) && (
        <header style={{ display: "flex", justifyContent: "space-between", gap: tokens.spacing.md }}>
          <div style={{ display: "grid", gap: 4 }}>
            {title ? <strong style={{ fontSize: 16 }}>{title}</strong> : null}
            {subtitle ? (
              <span style={{ color: tokens.color.textMuted, fontSize: 13 }}>{subtitle}</span>
            ) : null}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

type ButtonProps = PropsWithChildren<{
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  style?: CSSProperties;
}>;

export function Button({
  children,
  disabled,
  onClick,
  style,
  type = "button",
  variant = "primary",
}: ButtonProps) {
  const palette =
    variant === "primary"
      ? {
          background: tokens.color.accent,
          borderColor: tokens.color.accent,
          color: "#ffffff",
        }
      : variant === "danger"
        ? {
            background: tokens.color.danger,
            borderColor: tokens.color.danger,
            color: "#ffffff",
          }
        : variant === "secondary"
          ? {
              background: tokens.color.surfaceMuted,
              borderColor: tokens.color.border,
              color: tokens.color.text,
            }
          : {
              background: "transparent",
              borderColor: "transparent",
              color: tokens.color.textMuted,
            };

  return (
    <button
      disabled={disabled}
      onClick={onClick}
      type={type}
      style={{
        height: 42,
        borderRadius: tokens.radius.sm,
        border: `1px solid ${palette.borderColor}`,
        background: palette.background,
        color: palette.color,
        fontWeight: 600,
        padding: "0 16px",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        transition: `transform ${tokens.motion.fast} ease, background ${tokens.motion.fast} ease`,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

type TextFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  multiline?: boolean;
  rows?: number;
  autoComplete?: string;
  spellCheck?: boolean;
  style?: CSSProperties;
};

export function TextField({
  autoComplete,
  multiline,
  onChange,
  placeholder,
  rows = 4,
  spellCheck,
  style,
  type = "text",
  value,
}: TextFieldProps) {
  const sharedStyle: CSSProperties = {
    width: "100%",
    borderRadius: tokens.radius.sm,
    border: `1px solid ${tokens.color.border}`,
    background: "#fffdfa",
    color: tokens.color.text,
    padding: "12px 14px",
    font: `400 14px ${tokens.typography.body}`,
    outlineColor: tokens.color.focus,
    resize: "vertical",
    boxSizing: "border-box",
    ...style,
  };

  if (multiline) {
    return (
      <textarea
        autoComplete={autoComplete}
        placeholder={placeholder}
        rows={rows}
        spellCheck={spellCheck}
        style={sharedStyle}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  return (
    <input
      autoComplete={autoComplete}
      placeholder={placeholder}
      spellCheck={spellCheck}
      style={sharedStyle}
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

export function StatusPill({
  tone,
  value,
}: {
  tone: "neutral" | "success" | "warning" | "danger" | "accent";
  value: string;
}) {
  const toneStyles =
    tone === "success"
      ? { background: "#def7ec", color: tokens.color.success }
      : tone === "warning"
        ? { background: "#fff1d6", color: tokens.color.warning }
        : tone === "danger"
          ? { background: "#fde8e5", color: tokens.color.danger }
          : tone === "accent"
            ? { background: tokens.color.accentSoft, color: tokens.color.accentStrong }
            : { background: tokens.color.surfaceMuted, color: tokens.color.textMuted };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        minHeight: 26,
        borderRadius: 999,
        padding: "0 10px",
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.02em",
        ...toneStyles,
      }}
    >
      {value}
    </span>
  );
}

export function Stack({
  children,
  gap = tokens.spacing.md,
}: PropsWithChildren<{ gap?: number }>) {
  return <div style={{ display: "grid", gap }}>{children}</div>;
}
