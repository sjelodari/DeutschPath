// UI locales the app chrome can be rendered in.
// Distinct from SUPPORTED_LANGUAGES (lib/languages.ts), which lists the
// languages AI explanations/translations can be generated in.
export const UI_LOCALES = ["en", "fa", "ar", "hi", "tr", "ur"] as const;
export type UiLocale = (typeof UI_LOCALES)[number];

export const DEFAULT_LOCALE: UiLocale = "en";

export const LOCALE_COOKIE = "ui-locale";

const RTL_LOCALES: ReadonlySet<string> = new Set(["fa", "ar", "ur"]);

export function isUiLocale(code: unknown): code is UiLocale {
  return typeof code === "string" && (UI_LOCALES as readonly string[]).includes(code);
}

export function dirFor(locale: string): "rtl" | "ltr" {
  return RTL_LOCALES.has(locale) ? "rtl" : "ltr";
}

export const UI_LOCALE_LABELS: Record<UiLocale, { name: string; nativeName: string }> = {
  en: { name: "English", nativeName: "English" },
  fa: { name: "Persian", nativeName: "فارسی" },
  ar: { name: "Arabic", nativeName: "العربية" },
  hi: { name: "Hindi", nativeName: "हिंदी" },
  tr: { name: "Turkish", nativeName: "Türkçe" },
  ur: { name: "Urdu", nativeName: "اردو" },
};
