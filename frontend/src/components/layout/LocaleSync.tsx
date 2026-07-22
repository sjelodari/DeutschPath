"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useAppStore } from "@/src/lib/store";
import { getProfile } from "@/src/lib/api";
import { DEFAULT_LOCALE, isUiLocale, type UiLocale } from "@/src/i18n/config";
import { applyUiLocaleCookie } from "@/src/lib/locale";

/**
 * Reconciles the UI locale after mount, in priority order:
 *   1. backend profile.ui_language (explicitly chosen by the user in Settings)
 *   2. the user's primary explanation language (translationLanguages[0]),
 *      if it's one of the UI locales — a sensible default until they choose
 *   3. English
 * If the resolved locale differs from what the server rendered (cookie),
 * updates the cookie and refreshes so chrome + direction switch over.
 */
export function LocaleSync() {
  const router = useRouter();
  const currentLocale = useLocale();
  const translationLanguages = useAppStore((s) => s.translationLanguages);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      let desired: UiLocale | null = null;
      try {
        const profile = await getProfile();
        if (isUiLocale(profile?.ui_language)) desired = profile.ui_language;
      } catch {
        // backend unreachable — keep whatever the cookie said
        return;
      }
      if (!desired) {
        const primary = translationLanguages[0]?.code;
        desired = isUiLocale(primary) ? primary : DEFAULT_LOCALE;
      }
      if (desired !== currentLocale) {
        applyUiLocaleCookie(desired);
        router.refresh();
      }
    })();
  }, [currentLocale, translationLanguages, router]);

  return null;
}
