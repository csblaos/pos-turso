import type { UiLocale } from "@/lib/i18n/locales";

export const UI_LOCALE_COOKIE_NAME = "csb_pos_ui_locale";

export const uiLocaleCookieOptions = {
  httpOnly: false,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
};

export function normalizeUiLocaleCookieValue(value: UiLocale) {
  return value;
}

