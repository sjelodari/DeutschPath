import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isUiLocale } from "./config";

// Locale is cookie-based (no locale URL prefix): the single-user app keeps
// the chosen UI language in a cookie so the server can render the correct
// language + direction on first paint. LocaleSync reconciles the cookie with
// the backend-persisted profile.ui_language after mount.
export default getRequestConfig(async () => {
  const candidate = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isUiLocale(candidate) ? candidate : DEFAULT_LOCALE;
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
