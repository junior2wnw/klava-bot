import { useAppI18n, type AppLanguagePreference } from "./AppI18n";

export function LanguageSelector({
  compact = false,
}: {
  compact?: boolean;
}) {
  const { preference, setPreference, t } = useAppI18n();

  return (
    <label className={compact ? "app-language app-language--compact" : "app-language"}>
      <span>{t("App language", "Язык приложения")}</span>
      <select
        className="app-language__select"
        value={preference}
        onChange={(event) => setPreference(event.target.value as AppLanguagePreference)}
      >
        <option value="system">{t("System", "Системный")}</option>
        <option value="en">English</option>
        <option value="ru">Русский</option>
      </select>
    </label>
  );
}
