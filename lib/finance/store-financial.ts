import type { UiLocale } from "@/lib/i18n/locales";
import { t } from "@/lib/i18n/messages";

export const storeCurrencyValues = ["LAK", "THB", "USD"] as const;
export type StoreCurrency = (typeof storeCurrencyValues)[number];

export const storeVatModeValues = ["EXCLUSIVE", "INCLUSIVE"] as const;
export type StoreVatMode = (typeof storeVatModeValues)[number];

const storeCurrencySet = new Set<string>(storeCurrencyValues);

export const defaultStoreCurrency: StoreCurrency = "LAK";
export const defaultStoreVatMode: StoreVatMode = "EXCLUSIVE";

export function isStoreCurrency(value: unknown): value is StoreCurrency {
  return typeof value === "string" && storeCurrencySet.has(value);
}

export function parseStoreCurrency(value: unknown, fallback: StoreCurrency = defaultStoreCurrency) {
  return isStoreCurrency(value) ? value : fallback;
}

export function parseStoreVatMode(value: unknown, fallback: StoreVatMode = defaultStoreVatMode) {
  return value === "INCLUSIVE" || value === "EXCLUSIVE" ? value : fallback;
}

export function parseSupportedCurrencies(
  rawValue: unknown,
  baseCurrency: StoreCurrency,
): StoreCurrency[] {
  const parsed = (() => {
    if (Array.isArray(rawValue)) {
      return rawValue;
    }

    if (typeof rawValue === "string") {
      try {
        const fromJson = JSON.parse(rawValue) as unknown;
        return Array.isArray(fromJson) ? fromJson : [];
      } catch {
        return [];
      }
    }

    return [];
  })();

  const dedupe = new Set<StoreCurrency>();
  for (const item of parsed) {
    if (isStoreCurrency(item)) {
      dedupe.add(item);
    }
  }

  if (!dedupe.has(baseCurrency)) {
    dedupe.add(baseCurrency);
  }

  if (dedupe.size === 0) {
    dedupe.add(baseCurrency);
  }

  return storeCurrencyValues.filter((currency) => dedupe.has(currency));
}

export function serializeSupportedCurrencies(currencies: StoreCurrency[]) {
  return JSON.stringify(currencies);
}

export function currencyLabel(currency: StoreCurrency) {
  if (currency === "LAK") {
    return "₭";
  }

  if (currency === "THB") {
    return "฿";
  }

  return "$";
}

const CURRENCY_SYMBOLS: Record<StoreCurrency, string> = {
  LAK: "₭",
  THB: "฿",
  USD: "$",
};

export function currencySymbol(currency: StoreCurrency): string {
  return CURRENCY_SYMBOLS[currency] ?? currency;
}

export function vatModeLabel(mode: StoreVatMode): string;
export function vatModeLabel(locale: UiLocale, mode: StoreVatMode): string;
export function vatModeLabel(arg1: StoreVatMode | UiLocale, arg2?: StoreVatMode) {
  const locale = arg2 ? (arg1 as UiLocale) : "th";
  const mode = arg2 ?? (arg1 as StoreVatMode);
  return t(locale, mode === "INCLUSIVE" ? "finance.vatMode.INCLUSIVE" : "finance.vatMode.EXCLUSIVE");
}
