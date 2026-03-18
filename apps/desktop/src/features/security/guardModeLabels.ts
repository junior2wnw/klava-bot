import type { GuardMode } from "@klava/contracts";

export function getGuardModeLabel(
  mode: GuardMode,
  t: (english: string, russian: string) => string,
  options: { includeKeyword?: boolean } = {},
) {
  const label =
    mode === "strict"
      ? t("Strict", "Строгий")
      : mode === "balanced"
        ? t("Balanced", "С подтверждением")
        : t("Off", "Без защиты");

  if (!options.includeKeyword) {
    return label;
  }

  return `${label} (${mode})`;
}
