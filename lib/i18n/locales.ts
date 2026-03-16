export const uiLocaleValues = ["th", "lo", "en"] as const;

export type UiLocale = (typeof uiLocaleValues)[number];

export const DEFAULT_UI_LOCALE: UiLocale = "th";

export function normalizeUiLocale(value: unknown): UiLocale {
  if (typeof value !== "string") {
    return DEFAULT_UI_LOCALE;
  }

  const normalized = value.trim().toLowerCase();
  if ((uiLocaleValues as readonly string[]).includes(normalized)) {
    return normalized as UiLocale;
  }

  return DEFAULT_UI_LOCALE;
}

export function uiLocaleToDateLocale(locale: UiLocale) {
  if (locale === "lo") {
    return "lo-LA";
  }

  if (locale === "en") {
    return "en-US";
  }

  return "th-TH";
}

