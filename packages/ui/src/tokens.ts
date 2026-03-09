export const tokens = {
  color: {
    accent: "#0f766e",
    accentStrong: "#115e59",
    accentSoft: "#ccfbf1",
    background: "#f4f2eb",
    surface: "#fbfaf6",
    surfaceMuted: "#f0ede4",
    border: "#d8d1c2",
    text: "#1f1f1a",
    textMuted: "#676254",
    success: "#1c7c54",
    warning: "#9a5a00",
    danger: "#a43a2a",
    focus: "#1d4ed8",
  },
  spacing: {
    xs: 6,
    sm: 10,
    md: 16,
    lg: 24,
    xl: 32,
  },
  radius: {
    sm: 12,
    md: 18,
    lg: 28,
  },
  shadow: {
    soft: "0 18px 48px rgba(31, 31, 26, 0.08)",
    panel: "0 12px 32px rgba(31, 31, 26, 0.06)",
  },
  motion: {
    fast: "140ms",
    normal: "220ms",
  },
  typography: {
    display: "\"IBM Plex Sans\", \"Segoe UI\", sans-serif",
    body: "\"IBM Plex Sans\", \"Segoe UI\", sans-serif",
    mono: "\"IBM Plex Mono\", Consolas, monospace",
  },
} as const;
