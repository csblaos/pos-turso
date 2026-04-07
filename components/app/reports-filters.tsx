"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DatePickerField } from "@/components/ui/date-picker-field";
import {
  REPORT_DATE_PRESETS,
  getDateRangeForPreset,
  type ReportsFilterState,
  type ReportDatePreset,
} from "@/lib/reports/filters";
import { t, type MessageKey } from "@/lib/i18n/messages";
import type { UiLocale } from "@/lib/i18n/locales";

type ReportsFiltersProps = {
  uiLocale: UiLocale;
  dateLocale: string;
  initialFilters: ReportsFilterState;
};

export function ReportsFilters({
  uiLocale,
  dateLocale,
  initialFilters,
}: ReportsFiltersProps) {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const rawSearchParams = useSearchParams();
  const searchParams = useMemo(
    () => rawSearchParams ?? new URLSearchParams(),
    [rawSearchParams],
  );
  const [isPending, startTransition] = useTransition();
  const [preset, setPreset] = useState<ReportDatePreset>(initialFilters.preset);
  const [dateFrom, setDateFrom] = useState(initialFilters.dateFrom);
  const [dateTo, setDateTo] = useState(initialFilters.dateTo);
  const [channel, setChannel] = useState(initialFilters.channel);

  useEffect(() => {
    setPreset(initialFilters.preset);
    setDateFrom(initialFilters.dateFrom);
    setDateTo(initialFilters.dateTo);
    setChannel(initialFilters.channel);
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
    next.set("preset", preset);
    next.set("channel", channel);
    next.set("dateFrom", dateFrom);
    next.set("dateTo", dateTo);
    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    });
  };

  const resetFilters = () => {
    const nextPreset: ReportDatePreset = "LAST_7_DAYS";
    const range = getDateRangeForPreset(nextPreset);
    setPreset(nextPreset);
    setDateFrom(range.dateFrom);
    setDateTo(range.dateTo);
    setChannel("ALL");

    const next = new URLSearchParams(searchParams.toString());
    next.set("preset", nextPreset);
    next.set("channel", "ALL");
    next.set("dateFrom", range.dateFrom);
    next.set("dateTo", range.dateTo);
    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    });
  };

  return (
    <article className="space-y-3 rounded-2xl border bg-white p-4 shadow-sm">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-slate-900">
          {t(uiLocale, "reports.filters.title")}
        </h2>
      </div>

      <div className="-mx-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-w-max gap-2 px-1">
          {REPORT_DATE_PRESETS.map((option) => (
            <button
              key={option}
              type="button"
              disabled={isPending}
              onClick={() => {
                setPreset(option);
                if (option !== "CUSTOM") {
                  const range = getDateRangeForPreset(option);
                  setDateFrom(range.dateFrom);
                  setDateTo(range.dateTo);
                }
              }}
              className={`rounded-full border px-3 py-2 text-xs font-medium transition-colors ${
                preset === option
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50"
              }`}
            >
              {t(uiLocale, `reports.filters.preset.${option}` as MessageKey)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_13rem]">
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-slate-600">
            {t(uiLocale, "reports.filters.dateFrom")}
          </span>
          <DatePickerField
            value={dateFrom}
            onChange={(nextValue) => {
              setPreset("CUSTOM");
              setDateFrom(nextValue);
            }}
            placeholder={t(uiLocale, "reports.filters.dateFromPlaceholder")}
            ariaLabel={t(uiLocale, "reports.filters.dateFrom")}
            dateLocale={dateLocale}
            weekdayLabels={weekdayLabels}
            clearLabel={t(uiLocale, "common.action.clear")}
            closeLabel={t(uiLocale, "common.action.close")}
          />
        </div>

        <div className="space-y-1.5">
          <span className="text-xs font-medium text-slate-600">
            {t(uiLocale, "reports.filters.dateTo")}
          </span>
          <DatePickerField
            value={dateTo}
            onChange={(nextValue) => {
              setPreset("CUSTOM");
              setDateTo(nextValue);
            }}
            placeholder={t(uiLocale, "reports.filters.dateToPlaceholder")}
            ariaLabel={t(uiLocale, "reports.filters.dateTo")}
            dateLocale={dateLocale}
            weekdayLabels={weekdayLabels}
            clearLabel={t(uiLocale, "common.action.clear")}
            closeLabel={t(uiLocale, "common.action.close")}
          />
        </div>

        <label className="col-span-2 space-y-1.5 md:col-span-1">
          <span className="text-xs font-medium text-slate-600">
            {t(uiLocale, "reports.filters.channel")}
          </span>
          <select
            value={channel}
            onChange={(event) =>
              setChannel(event.target.value as ReportsFilterState["channel"])
            }
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none ring-primary transition focus:ring-2"
          >
            <option value="ALL">{t(uiLocale, "reports.filters.channel.ALL")}</option>
            <option value="WALK_IN">{t(uiLocale, "reports.filters.channel.WALK_IN")}</option>
            <option value="FACEBOOK">{t(uiLocale, "reports.filters.channel.FACEBOOK")}</option>
            <option value="WHATSAPP">{t(uiLocale, "reports.filters.channel.WHATSAPP")}</option>
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          className="h-9 px-3 text-xs"
          disabled={isPending}
          aria-busy={isPending}
          onClick={applyFilters}
        >
          <span className="inline-flex items-center gap-2">
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {t(uiLocale, "reports.filters.apply")}
          </span>
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-9 px-3 text-xs"
          disabled={isPending}
          onClick={resetFilters}
        >
          {t(uiLocale, "reports.filters.reset")}
        </Button>
      </div>
    </article>
  );
}
