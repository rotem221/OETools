import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import type { Language } from "@/lib/db-types";
import en from "./locales/en.json";
import he from "./locales/he.json";

export const resources = {
  en: { translation: en },
  he: { translation: he },
} as const;

export const supportedLanguages: Language[] = ["en", "he"];
export const rtlLanguages: Language[] = ["he"];

void i18n.use(initReactI18next).init({
  resources,
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  returnNull: false,
});

/** Apply language + text direction to the document root. */
export function applyLanguage(lang: Language) {
  void i18n.changeLanguage(lang);
  const dir = rtlLanguages.includes(lang) ? "rtl" : "ltr";
  if (typeof document !== "undefined") {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }
}

export default i18n;
