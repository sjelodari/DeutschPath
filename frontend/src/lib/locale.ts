import { LOCALE_COOKIE, type UiLocale } from "@/src/i18n/config";

/** Persist the UI locale in the cookie the server reads on every render. */
export function applyUiLocaleCookie(locale: UiLocale) {
  document.cookie = `${LOCALE_COOKIE}=${locale};path=/;max-age=31536000;samesite=lax`;
}

const UMLAUT_MAP: Record<string, string> = {
  ä: "ae", ö: "oe", ü: "ue", ß: "ss",
  Ä: "Ae", Ö: "Oe", Ü: "Ue",
};

const COMBINING_DIACRITICS = /[̀-ͯ]/g;

/**
 * Derives the stable slug used as the `grammar.ruleName_<slug>` message key
 * for a given GrammarRule.name (e.g. "Present Tense (Präsens)" ->
 * "present_tense_praesens"). Must produce slugs matching the `ruleName_*`
 * keys already baked into the message catalogs (frontend/src/messages/*.json);
 * on a miss, the caller falls back to the raw rule name.
 */
export function slugifyRuleName(name: string): string {
  const transliterated = name.replace(/[äöüßÄÖÜ]/g, (c) => UMLAUT_MAP[c] ?? c);
  const ascii = transliterated.normalize("NFKD").replace(COMBINING_DIACRITICS, "");
  return ascii
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}
