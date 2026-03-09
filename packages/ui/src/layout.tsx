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
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.lg,
        boxShadow: tokens.shadow.soft,
        padding: tokens.spacing.md,
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacing.md,
      }}
    >
      {(title || actions) && (
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong style={{ fontSize: 15 }}>{title}</strong>
          {actions}
        </header>
      )}
      <div style={{ minHeight: 0, flex: 1 }}>{children}</div>
    </section>
  );
}
