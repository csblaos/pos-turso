"use client";

import { CheckCircle2, CircleAlert, Info, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { SlideUpSheet } from "@/components/ui/slide-up-sheet";
import { authFetch } from "@/lib/auth/client-token";
import type { UiLocale } from "@/lib/i18n/locales";
import { t } from "@/lib/i18n/messages";

type StoreInventorySettingsProps = {
  initialOutStockThreshold: number;
  initialLowStockThreshold: number;
  canUpdate: boolean;
  uiLocale: UiLocale;
};

type UpdateStoreResponse = {
  ok?: boolean;
  message?: string;
  store?: {
    outStockThreshold?: number;
    lowStockThreshold?: number;
  };
};

const toInt = (value: string) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  if (!Number.isInteger(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
};

export function StoreInventorySettings({
  initialOutStockThreshold,
  initialLowStockThreshold,
  canUpdate,
  uiLocale,
}: StoreInventorySettingsProps) {
  const [outStockText, setOutStockText] = useState(`${initialOutStockThreshold}`);
  const [lowStockText, setLowStockText] = useState(`${initialLowStockThreshold}`);

  const [savedOutStock, setSavedOutStock] = useState(initialOutStockThreshold);
  const [savedLowStock, setSavedLowStock] = useState(initialLowStockThreshold);

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const parsedOut = useMemo(() => toInt(outStockText), [outStockText]);
  const parsedLow = useMemo(() => toInt(lowStockText), [lowStockText]);

  const validationError = useMemo(() => {
    if (parsedOut === null) {
      return t(uiLocale, "settings.stock.validation.outStockInvalid");
    }
    if (parsedLow === null) {
      return t(uiLocale, "settings.stock.validation.lowStockInvalid");
    }
    if (parsedLow < parsedOut) {
      return t(uiLocale, "settings.stock.validation.lowLessThanOut");
    }
    return null;
  }, [parsedLow, parsedOut, uiLocale]);

  const isDirty =
    parsedOut !== null &&
    parsedLow !== null &&
    (parsedOut !== savedOutStock || parsedLow !== savedLowStock);

  const saveInventorySettings = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!canUpdate) {
      setErrorMessage(t(uiLocale, "settings.stock.error.permissionDenied"));
      return;
    }

    if (validationError || parsedOut === null || parsedLow === null) {
      setErrorMessage(validationError ?? t(uiLocale, "settings.stock.error.invalidData"));
      return;
    }

    setIsSaving(true);

    try {
      const response = await authFetch("/api/settings/store", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          outStockThreshold: parsedOut,
          lowStockThreshold: parsedLow,
        }),
      });

      const data = (await response.json().catch(() => null)) as UpdateStoreResponse | null;
      if (!response.ok) {
        setErrorMessage(data?.message ?? t(uiLocale, "settings.stock.error.saveFailed"));
        return;
      }

      const nextOut = data?.store?.outStockThreshold ?? parsedOut;
      const nextLow = data?.store?.lowStockThreshold ?? parsedLow;

      setOutStockText(`${nextOut}`);
      setLowStockText(`${nextLow}`);
      setSavedOutStock(nextOut);
      setSavedLowStock(nextLow);

      setSuccessMessage(t(uiLocale, "settings.stock.success.saved"));
    } catch {
      setErrorMessage(t(uiLocale, "settings.stock.error.network"));
    } finally {
      setIsSaving(false);
    }
  };

  const fieldClassName =
    "h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none ring-primary focus:ring-2 disabled:bg-slate-100";

  return (
    <section className="space-y-4">
      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {t(uiLocale, "settings.link.stockThresholds.title")}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {t(uiLocale, "settings.link.stockThresholds.description")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                isDirty
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700"
              }`}
            >
              {isDirty ? (
                <CircleAlert className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              )}
              {isDirty ? t(uiLocale, "settings.stock.badge.unsaved") : t(uiLocale, "settings.stock.badge.saved")}
            </span>
            <Button
              type="button"
              variant="outline"
              className="h-9 w-9 rounded-full px-0"
              onClick={() => setIsHelpOpen(true)}
              aria-label={t(uiLocale, "settings.stock.help.ariaLabel")}
            >
              <Info className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-4 px-4 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700" htmlFor="store-out-threshold">
                {t(uiLocale, "settings.stock.field.outStock")}
              </label>
              <input
                id="store-out-threshold"
                type="number"
                min={0}
                step={1}
                value={outStockText}
                onChange={(e) => setOutStockText(e.target.value)}
                className={fieldClassName}
                disabled={isSaving}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700" htmlFor="store-low-threshold">
                {t(uiLocale, "settings.stock.field.lowStock")}
              </label>
              <input
                id="store-low-threshold"
                type="number"
                min={0}
                step={1}
                value={lowStockText}
                onChange={(e) => setLowStockText(e.target.value)}
                className={fieldClassName}
                disabled={isSaving}
              />
            </div>
          </div>

          <p className="text-xs text-slate-500">
            {t(uiLocale, "settings.stock.field.helper")}
          </p>

          {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
          {successMessage && <p className="text-sm text-emerald-700">{successMessage}</p>}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <Button
              type="button"
              className="h-10 px-4"
              onClick={saveInventorySettings}
              disabled={isSaving || !isDirty || Boolean(validationError)}
            >
              {isSaving ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t(uiLocale, "settings.stock.action.saving")}
                </span>
              ) : (
                t(uiLocale, "settings.stock.action.save")
              )}
            </Button>
          </div>
        </div>
      </article>

      <SlideUpSheet
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        title={t(uiLocale, "settings.stock.help.sheet.title")}
        description={t(uiLocale, "settings.stock.help.sheet.description")}
        panelMaxWidthClass="min-[1200px]:max-w-md"
      >
        <div className="space-y-3 text-sm text-slate-700">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="font-medium text-slate-900">{t(uiLocale, "settings.stock.help.outStock.title")}</p>
            <p className="mt-1 text-xs text-slate-500">{t(uiLocale, "settings.stock.help.outStock.description")}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="font-medium text-slate-900">{t(uiLocale, "settings.stock.help.lowStock.title")}</p>
            <p className="mt-1 text-xs text-slate-500">{t(uiLocale, "settings.stock.help.lowStock.description")}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="font-medium text-slate-900">{t(uiLocale, "settings.stock.help.scope.title")}</p>
            <p className="mt-1 text-xs text-slate-500">{t(uiLocale, "settings.stock.help.scope.description")}</p>
          </div>
        </div>
      </SlideUpSheet>
    </section>
  );
}
