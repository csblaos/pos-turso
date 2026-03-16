"use client";

import { useEffect, useState } from "react";

import { DEFAULT_UI_LOCALE, normalizeUiLocale, type UiLocale } from "@/lib/i18n/locales";

export function useUiLocale(): UiLocale {
  const [uiLocale, setUiLocale] = useState<UiLocale>(DEFAULT_UI_LOCALE);

  useEffect(() => {
    const lang = document.documentElement.getAttribute("lang");
    setUiLocale(normalizeUiLocale(lang));
  }, []);

  return uiLocale;
}

