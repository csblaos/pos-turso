import { cookies, headers } from "next/headers";

import { DEFAULT_UI_LOCALE, normalizeUiLocale, type UiLocale } from "@/lib/i18n/locales";
import { UI_LOCALE_COOKIE_NAME } from "@/lib/i18n/ui-locale-cookie";

function parseAcceptLanguage(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.split(";")[0]?.trim())
    .filter(Boolean) as string[];
}

export async function getRequestUiLocale(): Promise<UiLocale> {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(UI_LOCALE_COOKIE_NAME)?.value;
  if (cookieLocale) {
    return normalizeUiLocale(cookieLocale);
  }

  const requestHeaders = await headers();
  const accepted = parseAcceptLanguage(requestHeaders.get("accept-language"));

  for (const lang of accepted) {
    const normalized = lang.toLowerCase();
    const base = normalized.split("-")[0] ?? normalized;
    const locale = normalizeUiLocale(base);
    if (locale !== DEFAULT_UI_LOCALE || base === DEFAULT_UI_LOCALE) {
      return locale;
    }
  }

  return DEFAULT_UI_LOCALE;
}
