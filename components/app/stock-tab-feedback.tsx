"use client";

import { AlertTriangle, FileSearch, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { uiLocaleToDateLocale, type UiLocale } from "@/lib/i18n/locales";
import { t } from "@/lib/i18n/messages";
import { useUiLocale } from "@/lib/i18n/use-ui-locale";

function formatLastUpdatedAt(uiLocale: UiLocale, value: string | null) {
  const dateLocale = uiLocaleToDateLocale(uiLocale);
  if (!value) {
    return t(uiLocale, "stock.toolbar.lastUpdated.never");
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return t(uiLocale, "stock.toolbar.lastUpdated.never");
  }
  return `${t(uiLocale, "stock.toolbar.lastUpdated.prefix")} ${date.toLocaleTimeString(dateLocale, {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export function StockTabToolbar({
  isRefreshing,
  lastUpdatedAt,
  onRefresh,
  refreshLabel,
}: {
  isRefreshing: boolean;
  lastUpdatedAt: string | null;
  onRefresh: () => void;
  refreshLabel?: string;
}) {
  const uiLocale = useUiLocale();
  const fallbackRefreshLabel = t(uiLocale, "stock.toolbar.refresh");
  const buttonLabel = refreshLabel ?? fallbackRefreshLabel;

  return (
    <div className="flex items-center justify-between gap-2">
      <p className="text-[11px] text-slate-500">{formatLastUpdatedAt(uiLocale, lastUpdatedAt)}</p>
      <Button
        type="button"
        variant="outline"
        className="h-8 gap-1.5 px-3 text-xs"
        disabled={isRefreshing}
        onClick={onRefresh}
      >
        <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
        {isRefreshing ? t(uiLocale, "stock.toolbar.refreshing") : buttonLabel}
      </Button>
    </div>
  );
}

export function StockTabLoadingState({
  message,
}: {
  message?: string;
}) {
  const uiLocale = useUiLocale();
  const fallbackMessage = t(uiLocale, "stock.feedback.loading");

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="animate-pulse space-y-2">
        <div className="h-3 w-32 rounded bg-slate-200" />
        <div className="h-3 w-full rounded bg-slate-200" />
        <div className="h-3 w-4/5 rounded bg-slate-200" />
      </div>
      <p className="mt-3 text-xs text-slate-500">{message ?? fallbackMessage}</p>
    </div>
  );
}

export function StockTabErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const uiLocale = useUiLocale();
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-6 text-center">
      <AlertTriangle className="mx-auto h-8 w-8 text-red-400" />
      <p className="mt-2 text-sm text-red-700">{message}</p>
      <Button
        type="button"
        variant="outline"
        className="mt-3 h-8 border-red-200 bg-white px-3 text-xs text-red-700 hover:bg-red-100"
        onClick={onRetry}
      >
        {t(uiLocale, "stock.feedback.retry")}
      </Button>
    </div>
  );
}

export function StockTabEmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center">
      <FileSearch className="mx-auto h-10 w-10 text-slate-300" />
      <p className="mt-2 text-sm font-medium text-slate-700">{title}</p>
      {description ? <p className="mt-1 text-xs text-slate-500">{description}</p> : null}
    </div>
  );
}
