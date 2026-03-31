"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import {
  formatIsoDateDisplay,
  parseIsoDateValue,
  toDateInputValue,
} from "@/components/ui/date-picker-field";
import { type UiLocale, uiLocaleToDateLocale } from "@/lib/i18n/locales";
import { t } from "@/lib/i18n/messages";

type AuditLogDateRangeFieldsProps = {
  uiLocale: UiLocale;
  fromValue: string;
  toValue: string;
};

type AuditLogDatePickerFieldProps = {
  value: string;
  onChange: (nextValue: string) => void;
  placeholder: string;
  ariaLabel: string;
  dateLocale: string;
  weekdayLabels: readonly string[];
  clearLabel: string;
  closeLabel: string;
  panelAlign?: "left" | "right";
};

function AuditLogDatePickerField({
  value,
  onChange,
  placeholder,
  ariaLabel,
  dateLocale,
  weekdayLabels,
  clearLabel,
  closeLabel,
  panelAlign = "left",
}: AuditLogDatePickerFieldProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [viewCursor, setViewCursor] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  useEffect(() => {
    if (!isOpen) return;
    const parsed = parseIsoDateValue(value) ?? new Date();
    setViewCursor(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
  }, [isOpen, value]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!containerRef.current?.contains(target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const firstDayOfMonth = new Date(
    viewCursor.getFullYear(),
    viewCursor.getMonth(),
    1,
  ).getDay();
  const daysInMonth = new Date(
    viewCursor.getFullYear(),
    viewCursor.getMonth() + 1,
    0,
  ).getDate();
  const calendarCells: Array<number | null> = [
    ...Array.from({ length: firstDayOfMonth }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];
  while (calendarCells.length < 42) {
    calendarCells.push(null);
  }

  const selectedIso = parseIsoDateValue(value) ? value : "";
  const todayIso = toDateInputValue(new Date());
  const monthLabel = viewCursor.toLocaleDateString(dateLocale, {
    month: "long",
    year: "numeric",
  });

  return (
    <div ref={containerRef} className="relative min-w-0">
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none ring-primary transition focus:ring-2"
      >
        <span
          className={`truncate text-left ${selectedIso ? "text-slate-900" : "text-slate-400"}`}
        >
          {selectedIso ? formatIsoDateDisplay(selectedIso) : placeholder}
        </span>
        <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" />
      </button>

      {isOpen ? (
        <div
          className={`absolute top-[calc(100%+0.4rem)] z-[130] rounded-xl border border-slate-200 bg-white p-2 shadow-xl ${
            panelAlign === "right"
              ? "right-0 w-[calc(200%+0.75rem)] lg:left-0 lg:right-0 lg:w-auto"
              : "left-0 w-[calc(200%+0.75rem)] lg:left-0 lg:right-0 lg:w-auto"
          }`}
        >
          <div className="flex items-center justify-between pb-1">
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
              onClick={() =>
                setViewCursor(
                  (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1),
                )
              }
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <p className="text-xs font-semibold text-slate-700">{monthLabel}</p>
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
              onClick={() =>
                setViewCursor(
                  (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1),
                )
              }
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {weekdayLabels.map((label) => (
              <span
                key={label}
                className="inline-flex h-7 items-center justify-center text-[10px] font-medium text-slate-500"
              >
                {label}
              </span>
            ))}
            {calendarCells.map((day, index) => {
              if (!day) {
                return <span key={`empty-${index}`} className="h-7 w-7" />;
              }
              const candidate = toDateInputValue(
                new Date(viewCursor.getFullYear(), viewCursor.getMonth(), day),
              );
              const isSelected = candidate === selectedIso;
              const isToday = candidate === todayIso;

              return (
                <button
                  key={candidate}
                  type="button"
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-md text-xs transition ${
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : isToday
                        ? "border border-primary/40 text-primary"
                        : "text-slate-700 hover:bg-slate-100"
                  }`}
                  onClick={() => {
                    onChange(candidate);
                    setIsOpen(false);
                  }}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between gap-2">
            <button
              type="button"
              className="rounded-md px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-100"
              onClick={() => {
                onChange("");
                setIsOpen(false);
              }}
            >
              {clearLabel}
            </button>
            <button
              type="button"
              className="rounded-md px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-100"
              onClick={() => setIsOpen(false)}
            >
              {closeLabel}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function AuditLogDateRangeFields({
  uiLocale,
  fromValue,
  toValue,
}: AuditLogDateRangeFieldsProps) {
  const dateLocale = uiLocaleToDateLocale(uiLocale);
  const weekdayLabels = [
    t(uiLocale, "purchase.calendar.weekday.SUN"),
    t(uiLocale, "purchase.calendar.weekday.MON"),
    t(uiLocale, "purchase.calendar.weekday.TUE"),
    t(uiLocale, "purchase.calendar.weekday.WED"),
    t(uiLocale, "purchase.calendar.weekday.THU"),
    t(uiLocale, "purchase.calendar.weekday.FRI"),
    t(uiLocale, "purchase.calendar.weekday.SAT"),
  ] as const;
  const clearLabel = t(uiLocale, "common.action.clear");
  const closeLabel = t(uiLocale, "common.action.close");
  const datePlaceholder = t(uiLocale, "common.datePicker.placeholder");
  const [fromDate, setFromDate] = useState(fromValue);
  const [toDate, setToDate] = useState(toValue);

  return (
    <div className="space-y-1 md:col-span-2 lg:col-span-2">
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1 text-xs text-slate-600">
          {t(uiLocale, "settings.auditLog.filter.fromDate.label")}
          <input type="hidden" name="from" value={fromDate} />
          <AuditLogDatePickerField
            value={fromDate}
            onChange={setFromDate}
            placeholder={datePlaceholder}
            ariaLabel={t(uiLocale, "settings.auditLog.filter.fromDate.label")}
            dateLocale={dateLocale}
            weekdayLabels={weekdayLabels}
            clearLabel={clearLabel}
            closeLabel={closeLabel}
            panelAlign="left"
          />
        </label>

        <label className="space-y-1 text-xs text-slate-600">
          {t(uiLocale, "settings.auditLog.filter.toDate.label")}
          <input type="hidden" name="to" value={toDate} />
          <AuditLogDatePickerField
            value={toDate}
            onChange={setToDate}
            placeholder={datePlaceholder}
            ariaLabel={t(uiLocale, "settings.auditLog.filter.toDate.label")}
            dateLocale={dateLocale}
            weekdayLabels={weekdayLabels}
            clearLabel={clearLabel}
            closeLabel={closeLabel}
            panelAlign="right"
          />
        </label>
      </div>
    </div>
  );
}
