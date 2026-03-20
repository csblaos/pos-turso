"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { DatePickerField } from "@/components/ui/date-picker-field";
import {
  CASH_FLOW_DIRECTION_FILTERS,
  CASH_FLOW_ENTRY_TYPE_FILTERS,
  resolveCashFlowFilterState,
  type CashFlowFilterState,
} from "@/lib/finance/cash-flow-filters";
import { REPORT_DATE_PRESETS, getDateRangeForPreset } from "@/lib/reports/filters";
import type { UiLocale } from "@/lib/i18n/locales";
import { t, type MessageKey } from "@/lib/i18n/messages";

type CashFlowFiltersProps = {
  uiLocale: UiLocale;
  dateLocale: string;
  initialFilters: CashFlowFilterState;
  accountOptions: Array<{ value: string; label: string; type: string | null }>;
};

export function CashFlowFilters({
  uiLocale,
  dateLocale,
  initialFilters,
  accountOptions,
}: CashFlowFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [filters, setFilters] = useState(initialFilters);

  useEffect(() => {
    setFilters(initialFilters);
  }, [initialFilters]);

  const weekdayLabels = useMemo(
    () => [
      t(uiLocale, "purchase.calendar.weekday.SUN"),
      t(uiLocale, "purchase.calendar.weekday.MON"),
      t(uiLocale, "purchase.calendar.weekday.TUE"),
      t(uiLocale, "purchase.calendar.weekday.WED"),
      t(uiLocale, "purchase.calendar.weekday.THU"),
      t(uiLocale, "purchase.calendar.weekday.FRI"),
      t(uiLocale, "purchase.calendar.weekday.SAT"),
    ],
    [uiLocale],
  );

  const applyFilters = () => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("preset", filters.preset);
    next.set("dateFrom", filters.dateFrom);
    next.set("dateTo", filters.dateTo);
    next.set("direction", filters.direction);
    next.set("entryType", filters.entryType);
    next.set("account", filters.account);
    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    });
  };

  const resetFilters = () => {
    const preset = "LAST_7_DAYS";
    const range = getDateRangeForPreset(preset);
    const nextFilters = resolveCashFlowFilterState({
      preset,
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
      direction: "ALL",
      entryType: "ALL",
      account: "ALL",
    });
    setFilters(nextFilters);

    const next = new URLSearchParams(searchParams.toString());
    next.set("preset", preset);
    next.set("dateFrom", nextFilters.dateFrom);
    next.set("dateTo", nextFilters.dateTo);
    next.set("direction", nextFilters.direction);
    next.set("entryType", nextFilters.entryType);
    next.set("account", nextFilters.account);
    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    });
  };

  return (
    <article className="space-y-3 rounded-2xl border bg-white p-4 shadow-sm">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-slate-900">
          {t(uiLocale, "cashFlow.filters.title")}
        </h2>
        <p className="text-xs text-slate-500">{t(uiLocale, "cashFlow.filters.description")}</p>
      </div>

      <div className="-mx-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-w-max gap-2 px-1">
          {REPORT_DATE_PRESETS.map((option) => (
            <button
              key={option}
              type="button"
              disabled={isPending}
              onClick={() => {
                const nextRange = option === "CUSTOM" ? null : getDateRangeForPreset(option);
                setFilters((current) => ({
                  ...current,
                  preset: option,
                  dateFrom: nextRange?.dateFrom ?? current.dateFrom,
                  dateTo: nextRange?.dateTo ?? current.dateTo,
                }));
              }}
              className={`rounded-full border px-3 py-2 text-xs font-medium transition-colors ${
                filters.preset === option
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50"
              }`}
            >
              {t(uiLocale, `reports.filters.preset.${option}` as MessageKey)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-slate-600">
            {t(uiLocale, "cashFlow.filters.dateFrom")}
          </span>
          <DatePickerField
            value={filters.dateFrom}
            onChange={(nextValue) =>
              setFilters((current) => ({ ...current, preset: "CUSTOM", dateFrom: nextValue }))
            }
            placeholder={t(uiLocale, "cashFlow.filters.dateFromPlaceholder")}
            ariaLabel={t(uiLocale, "cashFlow.filters.dateFrom")}
            dateLocale={dateLocale}
            weekdayLabels={weekdayLabels}
            clearLabel={t(uiLocale, "common.action.clear")}
            closeLabel={t(uiLocale, "common.action.close")}
          />
        </div>

        <div className="space-y-1.5">
          <span className="text-xs font-medium text-slate-600">
            {t(uiLocale, "cashFlow.filters.dateTo")}
          </span>
          <DatePickerField
            value={filters.dateTo}
            onChange={(nextValue) =>
              setFilters((current) => ({ ...current, preset: "CUSTOM", dateTo: nextValue }))
            }
            placeholder={t(uiLocale, "cashFlow.filters.dateToPlaceholder")}
            ariaLabel={t(uiLocale, "cashFlow.filters.dateTo")}
            dateLocale={dateLocale}
            weekdayLabels={weekdayLabels}
            clearLabel={t(uiLocale, "common.action.clear")}
            closeLabel={t(uiLocale, "common.action.close")}
          />
        </div>

        <label className="space-y-1.5">
          <span className="text-xs font-medium text-slate-600">
            {t(uiLocale, "cashFlow.filters.direction")}
          </span>
          <select
            value={filters.direction}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                direction: event.target.value as CashFlowFilterState["direction"],
              }))
            }
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none ring-primary transition focus:ring-2"
          >
            {CASH_FLOW_DIRECTION_FILTERS.map((option) => (
              <option key={option} value={option}>
                {t(uiLocale, `cashFlow.filters.direction.${option}` as MessageKey)}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-medium text-slate-600">
            {t(uiLocale, "cashFlow.filters.entryType")}
          </span>
          <select
            value={filters.entryType}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                entryType: event.target.value as CashFlowFilterState["entryType"],
              }))
            }
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none ring-primary transition focus:ring-2"
          >
            {CASH_FLOW_ENTRY_TYPE_FILTERS.map((option) => (
              <option key={option} value={option}>
                {t(uiLocale, `cashFlow.filters.entryType.${option}` as MessageKey)}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-medium text-slate-600">
            {t(uiLocale, "cashFlow.filters.account")}
          </span>
          <select
            value={filters.account}
            onChange={(event) =>
              setFilters((current) => ({ ...current, account: event.target.value }))
            }
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none ring-primary transition focus:ring-2"
          >
            <option value="ALL">{t(uiLocale, "cashFlow.filters.account.ALL")}</option>
            <option value="UNASSIGNED">{t(uiLocale, "cashFlow.filters.account.UNASSIGNED")}</option>
            {accountOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" className="h-9 px-3 text-xs" disabled={isPending} onClick={applyFilters}>
          {t(uiLocale, "cashFlow.filters.apply")}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-9 px-3 text-xs"
          disabled={isPending}
          onClick={resetFilters}
        >
          {t(uiLocale, "cashFlow.filters.reset")}
        </Button>
      </div>
    </article>
  );
}
