import type { PropsWithChildren, ReactNode } from "react";
import { tokens } from "./tokens";

export function ShellRegion({
  title,
  actions,
  children,
}: PropsWithChildren<{ title?: ReactNode; actions?: ReactNode }>) {
  return (
    <section
      style={{
        minHeight: 0,
        background: tokens.color.surface,
        border: `1px solid ${tokens.color.borderSubtle}`,
        borderRadius: tokens.radius.lg,
        padding: tokens.spacing.md,
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacing.sm,
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
      }}
    >
      {(title || actions) && (
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingBottom: tokens.spacing.xs,
            borderBottom: `1px solid ${tokens.color.borderSubtle}`,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: tokens.color.textMuted,
            }}
          >
            {title}
          </span>
          {actions}
        </header>
      )}
      <div style={{ minHeight: 0, flex: 1 }}>{children}</div>
    </section>
  );
}
