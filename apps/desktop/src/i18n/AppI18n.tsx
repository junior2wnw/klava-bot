import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";

export type AppLanguage = "en" | "ru";
export type AppLanguagePreference = "system" | AppLanguage;

type AppI18nValue = {
  language: AppLanguage;
  locale: string;
  preference: AppLanguagePreference;
  setPreference: (preference: AppLanguagePreference) => void;
  t: (english: string, russian: string) => string;
  formatDateTime: (value: string | number | Date) => string;
  formatTime: (value: string | number | Date) => string;
};

const STORAGE_KEY = "klava.app-language";
const AppI18nContext = createContext<AppI18nValue | null>(null);

function detectSystemLanguage(): AppLanguage {
  if (typeof navigator === "undefined") {
    return "en";
  }

  return navigator.language?.toLowerCase().startsWith("ru") ? "ru" : "en";
}

function readStoredPreference(): AppLanguagePreference {
  if (typeof window === "undefined") {
    return "system";
  }

  const value = window.localStorage.getItem(STORAGE_KEY);
  return value === "en" || value === "ru" || value === "system" ? value : "system";
}

export function AppI18nProvider({ children }: PropsWithChildren) {
  const [preference, setPreference] = useState<AppLanguagePreference>(() => readStoredPreference());
  const [systemLanguage, setSystemLanguage] = useState<AppLanguage>(() => detectSystemLanguage());

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, preference);
  }, [preference]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleLanguageChange = () => {
      setSystemLanguage(detectSystemLanguage());
    };

    window.addEventListener("languagechange", handleLanguageChange);
    return () => window.removeEventListener("languagechange", handleLanguageChange);
  }, []);

  const language = preference === "system" ? systemLanguage : preference;
  const locale = language === "ru" ? "ru-RU" : "en-US";

  const value = useMemo<AppI18nValue>(
    () => ({
      language,
      locale,
      preference,
      setPreference,
      t: (english, russian) => (language === "ru" ? russian : english),
      formatDateTime: (input) => new Date(input).toLocaleString(locale),
      formatTime: (input) => new Date(input).toLocaleTimeString(locale),
    }),
    [language, locale, preference],
  );

  return <AppI18nContext.Provider value={value}>{children}</AppI18nContext.Provider>;
}

export function useAppI18n() {
  const context = useContext(AppI18nContext);
  if (!context) {
    throw new Error("useAppI18n must be used inside AppI18nProvider.");
  }

  return context;
}
