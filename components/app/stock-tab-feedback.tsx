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
  title,
  isRefreshing,
  lastUpdatedAt,
  onRefresh,
  refreshLabel,
}: {
  title?: string;
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
      <div className="min-w-0">
        {title ? <h2 className="text-sm font-semibold text-slate-900">{title}</h2> : null}
        <p className="text-[11px] text-slate-500">{formatLastUpdatedAt(uiLocale, lastUpdatedAt)}</p>
      </div>
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
  variant = "generic",
  message,
}: {
  variant?: "generic" | "inventory" | "recording" | "history";
  message?: string;
}) {
  const uiLocale = useUiLocale();
  const fallbackMessage = t(uiLocale, "stock.feedback.loading");
  const renderInventorySkeleton = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={`inventory-stat-${index}`}
            className="rounded-lg border bg-white p-3 shadow-sm"
          >
            <div className="animate-pulse space-y-2">
              <div className="h-3 w-16 rounded bg-slate-200" />
              <div className="h-7 w-12 rounded bg-slate-200" />
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="animate-pulse space-y-3">
          <div className="flex gap-2">
            <div className="h-10 flex-1 rounded-md bg-slate-200" />
            <div className="h-10 w-10 rounded-md bg-slate-200" />
          </div>
          <div className="flex gap-2">
            <div className="h-10 flex-1 rounded-md bg-slate-200" />
            <div className="h-10 flex-1 rounded-md bg-slate-200" />
          </div>
          <div className="h-3 w-32 rounded bg-slate-200" />
        </div>
      </div>

      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={`inventory-item-${index}`}
            className="rounded-xl border bg-white p-4 shadow-sm"
          >
            <div className="animate-pulse space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="h-3 w-20 rounded bg-slate-200" />
                  <div className="h-4 w-40 rounded bg-slate-200" />
                </div>
                <div className="h-6 w-16 rounded-full bg-slate-200" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="h-12 rounded-lg bg-slate-200" />
                <div className="h-12 rounded-lg bg-slate-200" />
                <div className="h-12 rounded-lg bg-slate-200" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
  const renderRecordingSkeleton = () => (
    <div className="space-y-4">
      <div className="rounded-xl border bg-white p-3 shadow-sm">
        <div className="animate-pulse space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="h-4 w-44 rounded bg-slate-200" />
              <div className="h-3 w-56 rounded bg-slate-200" />
            </div>
            <div className="h-7 w-20 rounded-md bg-slate-200" />
          </div>
          <div className="h-16 rounded-lg bg-slate-200" />
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-36 rounded bg-slate-200" />
          <div className="h-4 w-full rounded bg-slate-200" />
          <div className="flex gap-2">
            <div className="h-10 flex-1 rounded-md bg-slate-200" />
            <div className="h-10 w-10 rounded-md bg-slate-200" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="h-10 rounded-md bg-slate-200" />
            <div className="h-10 rounded-md bg-slate-200" />
          </div>
          <div className="h-20 rounded-lg bg-slate-200" />
          <div className="h-10 rounded-md bg-slate-200" />
        </div>
      </div>
    </div>
  );
  const renderHistorySkeleton = () => (
    <div className="space-y-4">
      <div className="rounded-xl border bg-white p-3 shadow-sm">
        <div className="animate-pulse space-y-3">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <div className="col-span-2 h-10 rounded-md bg-slate-200 lg:col-span-1" />
            <div className="col-span-2 h-10 rounded-md bg-slate-200 lg:col-span-1" />
            <div className="h-10 rounded-md bg-slate-200" />
            <div className="h-10 rounded-md bg-slate-200" />
          </div>
          <div className="flex justify-end gap-2">
            <div className="h-8 w-20 rounded-md bg-slate-200" />
            <div className="h-8 w-24 rounded-md bg-slate-200" />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={`history-item-${index}`}
            className="rounded-xl border bg-white p-4 shadow-sm"
          >
            <div className="animate-pulse space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="h-3 w-20 rounded bg-slate-200" />
                  <div className="h-4 w-44 rounded bg-slate-200" />
                </div>
                <div className="h-6 w-16 rounded-full bg-slate-200" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="h-12 rounded-lg bg-slate-200" />
                <div className="h-12 rounded-lg bg-slate-200" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (variant === "inventory") {
    return renderInventorySkeleton();
  }

  if (variant === "recording") {
    return renderRecordingSkeleton();
  }

  if (variant === "history") {
    return renderHistorySkeleton();
  }

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
