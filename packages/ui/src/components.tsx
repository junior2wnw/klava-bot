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
        background: tokens.color.surfaceElevated,
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.md,
        boxShadow: tokens.shadow.panel,
        padding: tokens.spacing.md,
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacing.sm,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        ...style,
      }}
    >
      {(title || subtitle || actions) && (
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: tokens.spacing.sm,
          }}
        >
          <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
            {title ? (
              <strong style={{ fontSize: 13, fontWeight: 600, color: tokens.color.text, letterSpacing: "-0.01em" }}>
                {title}
              </strong>
            ) : null}
            {subtitle ? (
              <span style={{ color: tokens.color.textMuted, fontSize: 11, lineHeight: 1.4 }}>{subtitle}</span>
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
          borderColor: "transparent",
          color: "#ffffff",
        }
      : variant === "danger"
        ? {
            background: "rgba(248, 113, 113, 0.15)",
            borderColor: "rgba(248, 113, 113, 0.25)",
            color: tokens.color.danger,
          }
        : variant === "secondary"
          ? {
              background: "rgba(255, 255, 255, 0.06)",
              borderColor: tokens.color.border,
              color: tokens.color.textSecondary,
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
        height: 32,
        borderRadius: tokens.radius.sm,
        border: `1px solid ${palette.borderColor}`,
        background: palette.background,
        color: palette.color,
        fontWeight: 500,
        fontSize: 12,
        padding: "0 14px",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        transition: `all ${tokens.motion.fast} ease`,
        letterSpacing: "0.01em",
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
  rows = 3,
  spellCheck,
  style,
  type = "text",
  value,
}: TextFieldProps) {
  const sharedStyle: CSSProperties = {
    width: "100%",
    borderRadius: tokens.radius.sm,
    border: `1px solid ${tokens.color.border}`,
    background: "rgba(255, 255, 255, 0.03)",
    color: tokens.color.text,
    padding: "8px 12px",
    font: `400 13px ${tokens.typography.body}`,
    outline: "none",
    resize: "vertical",
    boxSizing: "border-box",
    transition: `border-color ${tokens.motion.fast} ease`,
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
      ? { background: "rgba(52, 211, 153, 0.12)", color: tokens.color.success }
      : tone === "warning"
        ? { background: "rgba(251, 191, 36, 0.12)", color: tokens.color.warning }
        : tone === "danger"
          ? { background: "rgba(248, 113, 113, 0.12)", color: tokens.color.danger }
          : tone === "accent"
            ? { background: tokens.color.accentSoft, color: tokens.color.accent }
            : { background: "rgba(255, 255, 255, 0.06)", color: tokens.color.textMuted };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 22,
        borderRadius: 6,
        padding: "0 8px",
        fontSize: 11,
        fontWeight: 600,
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
  gap = tokens.spacing.sm,
}: PropsWithChildren<{ gap?: number }>) {
  return <div style={{ display: "grid", gap }}>{children}</div>;
}
