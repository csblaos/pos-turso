"use client";

import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { SlideUpSheet } from "@/components/ui/slide-up-sheet";
import { authFetch } from "@/lib/auth/client-token";
import { currencySymbol } from "@/lib/finance/store-financial";
import type { StoreCurrency } from "@/lib/finance/store-financial";
import { uiLocaleToDateLocale } from "@/lib/i18n/locales";
import { t, type MessageKey } from "@/lib/i18n/messages";
import { useUiLocale } from "@/lib/i18n/use-ui-locale";

type PurchaseApSupplierSummaryItem = {
  supplierKey: string;
  supplierName: string;
  poCount: number;
  unpaidPoCount: number;
  partialPoCount: number;
  totalOutstandingBase: number;
  overdueOutstandingBase: number;
  dueSoonOutstandingBase: number;
};

type PurchaseApStatementRow = {
  poId: string;
  poNumber: string;
  paymentStatus: "UNPAID" | "PARTIAL" | "PAID";
  dueDate: string | null;
  receivedAt: string | null;
  purchaseCurrency: StoreCurrency;
  grandTotalBase: number;
  totalPaidBase: number;
  outstandingBase: number;
  ageDays: number;
  fxDeltaBase: number;
  dueStatus: "OVERDUE" | "DUE_SOON" | "NOT_DUE" | "NO_DUE_DATE";
  daysUntilDue: number | null;
};

type PurchaseApStatementSummary = {
  supplierKey: string;
  supplierName: string;
  poCount: number;
  totalOutstandingBase: number;
  overdueOutstandingBase: number;
  dueSoonOutstandingBase: number;
  notDueOutstandingBase: number;
  noDueDateOutstandingBase: number;
  unpaidPoCount: number;
  partialPoCount: number;
};

type PurchaseApSupplierPanelProps = {
  storeCurrency: StoreCurrency;
  refreshKey?: string | null;
  preset?: PurchaseApPanelPreset | null;
  onFiltersChange?: (filters: {
    dueFilter: DueFilter;
    paymentFilter: PaymentFilter;
    statementSort: StatementSort;
  }) => void;
  onOpenPurchaseOrder: (poId: string) => void;
  onAfterBulkSettle?: () => Promise<void> | void;
};

type PaymentFilter = "ALL" | "UNPAID" | "PARTIAL" | "PAID";
type DueFilter = "ALL" | "OVERDUE" | "DUE_SOON" | "NOT_DUE" | "NO_DUE_DATE";
type StatementSort = "DUE_ASC" | "OUTSTANDING_DESC";
export type PurchaseApPanelPreset = {
  key: string;
  dueFilter?: DueFilter;
  paymentFilter?: PaymentFilter;
  statementSort?: StatementSort;
  resetDateRange?: boolean;
  resetPoQuery?: boolean;
};

const dueStatusKeyMap: Record<Exclude<DueFilter, "ALL">, MessageKey> = {
  OVERDUE: "purchase.ap.dueStatus.OVERDUE",
  DUE_SOON: "purchase.ap.dueStatus.DUE_SOON",
  NOT_DUE: "purchase.ap.dueStatus.NOT_DUE",
  NO_DUE_DATE: "purchase.ap.dueStatus.NO_DUE_DATE",
};

const paymentStatusKeyMap: Record<Exclude<PaymentFilter, "ALL">, MessageKey> = {
  UNPAID: "purchase.paymentStatus.UNPAID",
  PARTIAL: "purchase.paymentStatus.PARTIAL",
  PAID: "purchase.paymentStatus.PAID",
};

function fmtPrice(amount: number, currency: StoreCurrency, numberLocale: string): string {
  return `${currencySymbol(currency)}${amount.toLocaleString(numberLocale)}`;
}

function formatDate(dateStr: string | null, dateLocale: string): string {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  if (!Number.isFinite(date.getTime())) return "-";
  return date.toLocaleDateString(dateLocale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDateValue(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  ) {
    return null;
  }
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
}

function formatIsoDateDisplay(value: string): string {
  const parsed = parseIsoDateValue(value);
  if (!parsed) return "";
  const day = `${parsed.getDate()}`.padStart(2, "0");
  const month = `${parsed.getMonth() + 1}`.padStart(2, "0");
  const year = parsed.getFullYear();
  return `${day}/${month}/${year}`;
}

type PurchaseDatePickerFieldProps = {
  value: string;
  onChange: (nextValue: string) => void;
  triggerClassName: string;
  placeholder?: string;
  ariaLabel: string;
  dateLocale: string;
  weekdayLabels: readonly string[];
  disabled?: boolean;
  panelAlign?: "left" | "right";
};

function PurchaseDatePickerField({
  value,
  onChange,
  triggerClassName,
  placeholder = "dd/mm/yyyy",
  ariaLabel,
  dateLocale,
  weekdayLabels,
  disabled = false,
  panelAlign = "left",
}: PurchaseDatePickerFieldProps) {
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
  const todayIso = toDateInputValue(new Date());
  const selectedIso = parseIsoDateValue(value) ? value : "";
  const monthLabel = viewCursor.toLocaleDateString(dateLocale, {
    month: "long",
    year: "numeric",
  });

  return (
    <div ref={containerRef} className="relative min-w-0">
      <button
        type="button"
        className={triggerClassName}
        aria-label={ariaLabel}
        onClick={() => {
          if (disabled) return;
          setIsOpen((prev) => !prev);
        }}
        disabled={disabled}
      >
        <span
          className={`truncate ${selectedIso ? "text-slate-900" : "text-slate-400"}`}
        >
          {selectedIso ? formatIsoDateDisplay(selectedIso) : placeholder}
        </span>
        <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" />
      </button>

      {isOpen ? (
        <div
          className={`absolute top-[calc(100%+0.4rem)] z-[130] rounded-xl border border-slate-200 bg-white p-2 shadow-xl ${
            panelAlign === "right"
              ? "right-0 w-[calc(200%+0.5rem)] lg:left-0 lg:right-0 lg:w-auto"
              : "left-0 w-[calc(200%+0.5rem)] lg:left-0 lg:right-0 lg:w-auto"
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

          <div className="grid grid-cols-7 gap-1 pb-1">
            {weekdayLabels.map((label) => (
              <span
                key={label}
                className="flex h-6 items-center justify-center text-[10px] font-medium text-slate-400"
              >
                {label}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map((day, index) => {
              if (day === null) {
                return <span key={`blank-${index}`} className="h-8" />;
              }
              const dayIso = toDateInputValue(
                new Date(viewCursor.getFullYear(), viewCursor.getMonth(), day),
              );
              const isSelected = selectedIso === dayIso;
              const isToday = todayIso === dayIso;
              return (
                <button
                  key={dayIso}
                  type="button"
                  className={`h-8 rounded-md text-xs font-medium transition-colors ${
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : isToday
                        ? "border border-primary/40 bg-primary/10 text-primary"
                        : "text-slate-700 hover:bg-slate-100"
                  }`}
                  onClick={() => {
                    onChange(dayIso);
                    setIsOpen(false);
                  }}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function PurchaseApSupplierPanel({
  storeCurrency,
  refreshKey,
  preset,
  onFiltersChange,
  onOpenPurchaseOrder,
  onAfterBulkSettle,
}: PurchaseApSupplierPanelProps) {
  const uiLocale = useUiLocale();
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

  const dueStatusLabel = useCallback(
    (status: DueFilter) => {
      if (status === "ALL") return t(uiLocale, "common.filter.all");
      return t(uiLocale, dueStatusKeyMap[status]);
    },
    [uiLocale],
  );

  const paymentStatusLabel = useCallback(
    (status: PaymentFilter) => {
      if (status === "ALL") return t(uiLocale, "common.filter.all");
      return t(uiLocale, paymentStatusKeyMap[status]);
    },
    [uiLocale],
  );

  const formatMoney = useCallback(
    (amount: number) => fmtPrice(amount, storeCurrency, dateLocale),
    [storeCurrency, dateLocale],
  );

  const formatDateLocal = useCallback(
    (value: string | null) => formatDate(value, dateLocale),
    [dateLocale],
  );

  const [supplierSearchInput, setSupplierSearchInput] = useState("");
  const [supplierQuery, setSupplierQuery] = useState("");
  const [suppliers, setSuppliers] = useState<PurchaseApSupplierSummaryItem[]>([]);
  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(false);
  const [supplierError, setSupplierError] = useState<string | null>(null);
  const [selectedSupplierKey, setSelectedSupplierKey] = useState<string | null>(null);
  const [isSupplierPickerOpen, setIsSupplierPickerOpen] = useState(false);

  const [poQueryInput, setPoQueryInput] = useState("");
  const [poQuery, setPoQuery] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("ALL");
  const [dueFilter, setDueFilter] = useState<DueFilter>("ALL");
  const [statementSort, setStatementSort] = useState<StatementSort>("DUE_ASC");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");

  const [statementRows, setStatementRows] = useState<PurchaseApStatementRow[]>([]);
  const [statementSummary, setStatementSummary] =
    useState<PurchaseApStatementSummary | null>(null);
  const [isLoadingStatement, setIsLoadingStatement] = useState(false);
  const [statementError, setStatementError] = useState<string | null>(null);
  const [selectedPoIds, setSelectedPoIds] = useState<string[]>([]);
  const [isBulkSettleMode, setIsBulkSettleMode] = useState(false);
  const [isBulkSettling, setIsBulkSettling] = useState(false);
  const [bulkPaidAtInput, setBulkPaidAtInput] = useState("");
  const [bulkReferenceInput, setBulkReferenceInput] = useState("");
  const [bulkNoteInput, setBulkNoteInput] = useState("");
  const [bulkProgressText, setBulkProgressText] = useState<string | null>(null);
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);

  const getDateShortcutValue = useCallback(
    (shortcut: "TODAY" | "PLUS_7" | "END_OF_MONTH" | "CLEAR"): string => {
      if (shortcut === "CLEAR") return "";
      const now = new Date();
      if (shortcut === "TODAY") {
        return toDateInputValue(now);
      }
      if (shortcut === "PLUS_7") {
        const next = new Date(now);
        next.setDate(next.getDate() + 7);
        return toDateInputValue(next);
      }
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return toDateInputValue(endOfMonth);
    },
    [],
  );

  const applyStatementDateShortcut = useCallback(
    (
      field: "dueFrom" | "dueTo",
      shortcut: "TODAY" | "PLUS_7" | "END_OF_MONTH" | "CLEAR",
    ) => {
      const value = getDateShortcutValue(shortcut);
      if (field === "dueFrom") {
        setDueFrom(value);
        return;
      }
      setDueTo(value);
    },
    [getDateShortcutValue],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSupplierQuery(supplierSearchInput.trim());
    }, 250);
    return () => window.clearTimeout(timer);
  }, [supplierSearchInput]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPoQuery(poQueryInput.trim());
    }, 250);
    return () => window.clearTimeout(timer);
  }, [poQueryInput]);

  const loadSupplierSummary = useCallback(async () => {
    setIsLoadingSuppliers(true);
    try {
      const params = new URLSearchParams();
      if (supplierQuery) {
        params.set("q", supplierQuery);
      }
      params.set("limit", "100");
      const query = params.toString();
      const res = await authFetch(
        `/api/stock/purchase-orders/ap-by-supplier${query ? `?${query}` : ""}`,
        { cache: "no-store" },
      );
      const data = (await res.json().catch(() => null)) as
        | {
            ok?: boolean;
            message?: string;
            suppliers?: PurchaseApSupplierSummaryItem[];
          }
        | null;
      if (!res.ok || !data?.ok) {
        setSupplierError(data?.message ?? t(uiLocale, "purchase.ap.error.loadSuppliersFailed"));
        return;
      }

      const nextSuppliers = Array.isArray(data.suppliers) ? data.suppliers : [];
      setSuppliers(nextSuppliers);
      setSupplierError(null);

      if (nextSuppliers.length === 0) {
        setSelectedSupplierKey(null);
        return;
      }
      setSelectedSupplierKey((prev) => {
        if (prev && nextSuppliers.some((item) => item.supplierKey === prev)) {
          return prev;
        }
        return nextSuppliers[0]!.supplierKey;
      });
    } catch {
      setSupplierError(t(uiLocale, "purchase.error.serverUnreachableRetry"));
    } finally {
      setIsLoadingSuppliers(false);
    }
  }, [supplierQuery, uiLocale]);

  const loadStatement = useCallback(async () => {
    if (!selectedSupplierKey) {
      setStatementRows([]);
      setStatementSummary(null);
      setStatementError(null);
      return;
    }

    setIsLoadingStatement(true);
    try {
      const params = new URLSearchParams();
      params.set("supplierKey", selectedSupplierKey);
      params.set("paymentStatus", paymentFilter);
      params.set("dueFilter", dueFilter);
      if (dueFrom) params.set("dueFrom", dueFrom);
      if (dueTo) params.set("dueTo", dueTo);
      if (poQuery) params.set("q", poQuery);
      params.set("limit", "500");

      const res = await authFetch(
        `/api/stock/purchase-orders/ap-by-supplier/statement?${params.toString()}`,
        { cache: "no-store" },
      );
      const data = (await res.json().catch(() => null)) as
        | {
            ok?: boolean;
            message?: string;
            rows?: PurchaseApStatementRow[];
            summary?: PurchaseApStatementSummary;
          }
        | null;

      if (!res.ok || !data?.ok) {
        setStatementError(data?.message ?? t(uiLocale, "purchase.ap.error.loadStatementFailed"));
        return;
      }

      setStatementRows(Array.isArray(data.rows) ? data.rows : []);
      setStatementSummary(data.summary ?? null);
      setStatementError(null);
    } catch {
      setStatementError(t(uiLocale, "purchase.error.serverUnreachableRetry"));
    } finally {
      setIsLoadingStatement(false);
    }
  }, [dueFilter, dueFrom, dueTo, paymentFilter, poQuery, selectedSupplierKey, uiLocale]);

  useEffect(() => {
    void loadSupplierSummary();
  }, [loadSupplierSummary, refreshKey]);

  useEffect(() => {
    void loadStatement();
  }, [loadStatement]);

  useEffect(() => {
    setSelectedPoIds([]);
    setIsBulkSettleMode(false);
    setBulkErrors([]);
    setBulkProgressText(null);
  }, [selectedSupplierKey]);

  useEffect(() => {
    if (!preset) {
      return;
    }
    if (preset.dueFilter) {
      setDueFilter(preset.dueFilter);
    }
    if (preset.paymentFilter) {
      setPaymentFilter(preset.paymentFilter);
    }
    if (preset.statementSort) {
      setStatementSort(preset.statementSort);
    }
    if (preset.resetDateRange) {
      setDueFrom("");
      setDueTo("");
    }
    if (preset.resetPoQuery) {
      setPoQueryInput("");
      setPoQuery("");
    }
  }, [preset]);

  useEffect(() => {
    onFiltersChange?.({
      dueFilter,
      paymentFilter,
      statementSort,
    });
  }, [dueFilter, onFiltersChange, paymentFilter, statementSort]);

  const selectedSupplier = useMemo(
    () =>
      selectedSupplierKey
        ? suppliers.find((item) => item.supplierKey === selectedSupplierKey) ?? null
        : null,
    [selectedSupplierKey, suppliers],
  );

  const exportStatement = useCallback(() => {
    if (!selectedSupplierKey) return;
    const params = new URLSearchParams();
    params.set("supplierKey", selectedSupplierKey);
    params.set("paymentStatus", paymentFilter);
    params.set("dueFilter", dueFilter);
    if (dueFrom) params.set("dueFrom", dueFrom);
    if (dueTo) params.set("dueTo", dueTo);
    if (poQuery) params.set("q", poQuery);
    window.open(
      `/api/stock/purchase-orders/ap-by-supplier/export-csv?${params.toString()}`,
      "_blank",
      "noopener,noreferrer",
    );
  }, [dueFilter, dueFrom, dueTo, paymentFilter, poQuery, selectedSupplierKey]);

  const displayStatementRows = useMemo(() => {
    const dueDateValue = (value: string | null) => {
      if (!value) return Number.POSITIVE_INFINITY;
      const parsed = new Date(value).getTime();
      return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
    };
    const rows = [...statementRows];
    if (statementSort === "OUTSTANDING_DESC") {
      return rows.sort((a, b) => b.outstandingBase - a.outstandingBase);
    }
    return rows.sort((a, b) => {
      const dueDiff = dueDateValue(a.dueDate) - dueDateValue(b.dueDate);
      if (dueDiff !== 0) return dueDiff;
      return a.poNumber.localeCompare(b.poNumber);
    });
  }, [statementRows, statementSort]);

  const selectableStatementRows = useMemo(
    () => displayStatementRows.filter((row) => row.outstandingBase > 0),
    [displayStatementRows],
  );
  useEffect(() => {
    setSelectedPoIds((prev) =>
      prev.filter((poId) => selectableStatementRows.some((row) => row.poId === poId)),
    );
  }, [selectableStatementRows]);
  const selectedPoIdSet = useMemo(
    () => new Set(selectedPoIds),
    [selectedPoIds],
  );
  const selectedRows = useMemo(
    () =>
      selectedPoIds
        .map((poId) => selectableStatementRows.find((row) => row.poId === poId))
        .filter((row): row is PurchaseApStatementRow => Boolean(row)),
    [selectableStatementRows, selectedPoIds],
  );
  const sortedSelectedRows = useMemo(() => {
    const dueDateValue = (value: string | null) => {
      if (!value) return Number.POSITIVE_INFINITY;
      const parsed = new Date(value).getTime();
      return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
    };
    return [...selectedRows].sort((a, b) => {
      const dueDiff = dueDateValue(a.dueDate) - dueDateValue(b.dueDate);
      if (dueDiff !== 0) return dueDiff;
      return a.poNumber.localeCompare(b.poNumber);
    });
  }, [selectedRows]);
  const bulkAllocationPreview = useMemo(() => {
    let plannedTotal = 0;
    const rows = sortedSelectedRows.map((row) => {
      const plannedAmount = Math.max(0, Math.round(row.outstandingBase));
      plannedTotal += plannedAmount;
      return {
        poId: row.poId,
        poNumber: row.poNumber,
        outstandingBase: Math.round(row.outstandingBase),
        plannedAmount,
      };
    });
    const totalOutstanding = rows.reduce(
      (sum, row) => sum + row.outstandingBase,
      0,
    );
    return {
      rows,
      totalOutstanding,
      plannedTotal,
      outstandingAfter: Math.max(0, totalOutstanding - plannedTotal),
    };
  }, [sortedSelectedRows]);

  const resetSupplierSearch = useCallback(() => {
    setSupplierSearchInput("");
    setSupplierQuery("");
  }, []);

  const resetStatementFilters = useCallback(() => {
    setPoQueryInput("");
    setPoQuery("");
    setPaymentFilter("ALL");
    setDueFilter("ALL");
    setStatementSort("DUE_ASC");
    setDueFrom("");
    setDueTo("");
  }, []);

  const clearPoQuery = useCallback(() => {
    setPoQueryInput("");
    setPoQuery("");
  }, []);

  const toggleRowSelection = useCallback((poId: string) => {
    setSelectedPoIds((prev) => {
      if (prev.includes(poId)) {
        return prev.filter((id) => id !== poId);
      }
      return [...prev, poId];
    });
  }, []);

  const selectAllRows = useCallback(() => {
    setSelectedPoIds(selectableStatementRows.map((row) => row.poId));
  }, [selectableStatementRows]);

  const clearSelectedRows = useCallback(() => {
    setSelectedPoIds([]);
  }, []);

  const mobileSupplierSummary = useMemo(() => {
    const supplierCount = suppliers.length;
    const poCount = suppliers.reduce((sum, supplier) => sum + supplier.poCount, 0);
    return { supplierCount, poCount };
  }, [suppliers]);

  const openBulkSettleMode = useCallback(() => {
    if (sortedSelectedRows.length === 0) {
      toast.error(t(uiLocale, "purchase.monthEnd.bulk.validation.selectAtLeastOne"));
      return;
    }
    setBulkPaidAtInput(new Date().toISOString().slice(0, 10));
    setBulkReferenceInput("");
    setBulkNoteInput("");
    setBulkErrors([]);
    setBulkProgressText(null);
    setIsBulkSettleMode(true);
  }, [sortedSelectedRows.length, uiLocale]);

  const submitBulkSettle = useCallback(async () => {
    if (sortedSelectedRows.length === 0) {
      toast.error(t(uiLocale, "purchase.ap.bulk.validation.selectToSettle"));
      return;
    }
    const paymentReference = bulkReferenceInput.trim();
    if (!paymentReference) {
      toast.error(t(uiLocale, "purchase.monthEnd.bulk.validation.referenceRequired"));
      return;
    }

    const paymentNote = bulkNoteInput.trim();
    const paidAt = bulkPaidAtInput.trim();
    const errors: string[] = [];
    let settledCount = 0;
    let settledAmountTotal = 0;

    setIsBulkSettling(true);
    setBulkErrors([]);
    setBulkProgressText(t(uiLocale, "purchase.monthEnd.bulk.progress.start"));

    try {
      for (let i = 0; i < sortedSelectedRows.length; i += 1) {
        const row = sortedSelectedRows[i]!;
        setBulkProgressText(
          `${t(uiLocale, "purchase.monthEnd.bulk.progress.processing.prefix")} ${i + 1}/${sortedSelectedRows.length} (${row.poNumber})`,
        );

        const outstandingAmount = Math.max(0, Math.round(row.outstandingBase));
        const settleAmount = outstandingAmount;
        if (!Number.isFinite(settleAmount) || settleAmount <= 0) {
          continue;
        }

        const res = await authFetch(
          `/api/stock/purchase-orders/${row.poId}/settle`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": `po-ap-bulk-settle-${row.poId}-${Date.now()}-${i}`,
            },
            body: JSON.stringify({
              amountBase: settleAmount,
              paidAt: paidAt || undefined,
              paymentReference,
              paymentNote: paymentNote || undefined,
            }),
          },
        );
        const data = (await res.json().catch(() => null)) as
          | {
              message?: string;
            }
          | null;
        if (!res.ok) {
          errors.push(
            `${row.poNumber}: ${t(uiLocale, "purchase.monthEnd.bulk.error.settleFailed.prefix")} (${data?.message ?? t(uiLocale, "common.unknown")})`,
          );
          continue;
        }

        settledAmountTotal += settleAmount;
        settledCount += 1;
      }

      if (settledCount > 0) {
        toast.success(
          `${t(uiLocale, "purchase.monthEnd.bulk.toast.settled.prefix")} ${settledCount}/${sortedSelectedRows.length} ${t(uiLocale, "purchase.items")} (${t(uiLocale, "purchase.monthEnd.bulk.toast.total.prefix")} ${formatMoney(settledAmountTotal)})`,
        );
      }
      if (errors.length > 0) {
        toast.error(
          `${t(uiLocale, "purchase.monthEnd.bulk.toast.failures.prefix")} ${errors.length} ${t(uiLocale, "purchase.items")}`,
        );
      } else {
        setSelectedPoIds([]);
        setIsBulkSettleMode(false);
      }

      setBulkErrors(errors);
      await loadSupplierSummary();
      await loadStatement();
      await onAfterBulkSettle?.();
    } catch {
      toast.error(t(uiLocale, "purchase.monthEnd.bulk.error.connectionDuringBulk"));
    } finally {
      setIsBulkSettling(false);
      setBulkProgressText(null);
    }
  }, [
    bulkNoteInput,
    bulkPaidAtInput,
    bulkReferenceInput,
    formatMoney,
    loadStatement,
    loadSupplierSummary,
    onAfterBulkSettle,
    sortedSelectedRows,
    uiLocale,
  ]);

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-700">
            {t(uiLocale, "purchase.ap.panel.title")}
          </p>
          <p className="text-[11px] text-slate-500">
            {t(uiLocale, "purchase.ap.panel.subtitle")}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-8 rounded-lg px-2.5 text-xs"
          onClick={() => {
            void loadSupplierSummary();
          }}
          disabled={isLoadingSuppliers}
        >
          {isLoadingSuppliers ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <>
              <RefreshCw className="mr-1 h-3.5 w-3.5" />
              {t(uiLocale, "purchase.ap.panel.refresh")}
            </>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(220px,300px)_1fr]">
        <div className="hidden space-y-2 lg:block">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-9 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-slate-300"
              placeholder={t(uiLocale, "purchase.ap.supplier.search.placeholder")}
              value={supplierSearchInput}
              onChange={(event) => setSupplierSearchInput(event.target.value)}
            />
            {supplierSearchInput.trim().length > 0 ? (
              <button
                type="button"
                className="absolute right-1.5 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                onClick={resetSupplierSearch}
                aria-label={t(uiLocale, "purchase.ap.supplier.search.clear")}
                title={t(uiLocale, "purchase.ap.supplier.search.clear")}
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
            {isLoadingSuppliers ? (
              <p className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-500">
                {t(uiLocale, "purchase.ap.supplier.list.loading")}
              </p>
            ) : supplierError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-xs text-red-700">
                {supplierError}
              </div>
            ) : suppliers.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white px-2.5 py-4 text-center">
                <p className="text-xs text-slate-500">
                  {t(uiLocale, "purchase.ap.supplier.list.empty")}
                </p>
                {supplierSearchInput.trim().length > 0 ? (
                  <button
                    type="button"
                    className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                    onClick={resetSupplierSearch}
                  >
                    {t(uiLocale, "purchase.ap.supplier.search.clear")}
                  </button>
                ) : null}
              </div>
            ) : (
              suppliers.map((supplier) => {
                const isActive = supplier.supplierKey === selectedSupplierKey;
                return (
                  <button
                    key={supplier.supplierKey}
                    type="button"
                    className={`w-full rounded-lg border px-2.5 py-2 text-left ${
                      isActive
                        ? "border-primary bg-primary/5"
                        : "border-slate-200 bg-white hover:bg-slate-100"
                    }`}
                    onClick={() => setSelectedSupplierKey(supplier.supplierKey)}
                  >
                    <p className="truncate text-xs font-medium text-slate-900">
                      {supplier.supplierName}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {supplier.poCount} PO · {t(uiLocale, "dashboard.purchaseAp.item.outstandingLabel")}{" "}
                      {formatMoney(supplier.totalOutstandingBase)}
                    </p>
                    {(supplier.overdueOutstandingBase > 0 ||
                      supplier.dueSoonOutstandingBase > 0) && (
                      <p className="mt-1 text-[10px] text-amber-700">
                        {dueStatusLabel("OVERDUE")}{" "}
                        {formatMoney(supplier.overdueOutstandingBase)}
                        {" · "}
                        {dueStatusLabel("DUE_SOON")}{" "}
                        {formatMoney(supplier.dueSoonOutstandingBase)}
                      </p>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
            <div className="w-full space-y-1 sm:w-auto sm:min-w-0">
              <div className="lg:hidden">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-medium text-slate-500">
                    {t(uiLocale, "purchase.ap.supplier.select.placeholder")}
                  </p>
                  {!isLoadingSuppliers && mobileSupplierSummary.supplierCount > 0 ? (
                    <div className="flex flex-wrap justify-end gap-1">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                        {mobileSupplierSummary.supplierCount}{" "}
                        {t(uiLocale, "purchase.ap.supplier.summary.suppliers")}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                        {mobileSupplierSummary.poCount}{" "}
                        {t(uiLocale, "purchase.ap.supplier.summary.purchaseOrders")}
                      </span>
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="inline-flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-left"
                  onClick={() => setIsSupplierPickerOpen(true)}
                >
                  <span className="min-w-0 truncate text-sm font-semibold text-slate-900">
                    {selectedSupplier?.supplierName ??
                      t(uiLocale, "purchase.ap.supplier.select.placeholder")}
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
                </button>
              </div>
              <p className="hidden text-sm font-semibold text-slate-900 lg:block">
                {selectedSupplier?.supplierName ??
                  t(uiLocale, "purchase.ap.supplier.select.placeholder")}
              </p>
              {statementSummary ? (
                <p className="text-xs text-slate-500">
                  {statementSummary.poCount} PO ·{" "}
                  {t(uiLocale, "reports.apAging.totalOutstanding")}{" "}
                  {formatMoney(statementSummary.totalOutstandingBase)}
                </p>
              ) : (
                <p className="text-xs text-slate-500">
                  {t(uiLocale, "purchase.ap.statement.empty")}
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-8 w-full rounded-lg px-2.5 text-xs sm:w-auto"
              onClick={exportStatement}
              disabled={!selectedSupplierKey || isLoadingStatement}
            >
              <Download className="mr-1 h-3.5 w-3.5" />
              {t(uiLocale, "purchase.ap.statement.exportCsv")}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2 xl:grid-cols-5">
            <div className="relative col-span-2 xl:col-span-2">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="h-8 w-full rounded-md border border-slate-200 pl-8 pr-9 text-xs outline-none focus:ring-2 focus:ring-slate-300"
                placeholder={t(uiLocale, "purchase.ap.poQuery.placeholder")}
                value={poQueryInput}
                onChange={(event) => setPoQueryInput(event.target.value)}
              />
              {poQueryInput.trim().length > 0 ? (
                <button
                  type="button"
                  className="absolute right-1.5 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                  onClick={clearPoQuery}
                  aria-label={t(uiLocale, "common.action.clear")}
                  title={t(uiLocale, "common.action.clear")}
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            <select
              className="h-8 w-full rounded-md border border-slate-200 px-2 text-xs outline-none focus:ring-2 focus:ring-slate-300"
              value={paymentFilter}
              onChange={(event) =>
                setPaymentFilter(event.target.value as PaymentFilter)
              }
            >
              <option value="ALL">{paymentStatusLabel("ALL")}</option>
              <option value="UNPAID">{paymentStatusLabel("UNPAID")}</option>
              <option value="PARTIAL">{paymentStatusLabel("PARTIAL")}</option>
            </select>
            <select
              className="h-8 w-full rounded-md border border-slate-200 px-2 text-xs outline-none focus:ring-2 focus:ring-slate-300"
              value={dueFilter}
              onChange={(event) => setDueFilter(event.target.value as DueFilter)}
            >
              <option value="ALL">{dueStatusLabel("ALL")}</option>
              <option value="OVERDUE">{dueStatusLabel("OVERDUE")}</option>
              <option value="DUE_SOON">{dueStatusLabel("DUE_SOON")}</option>
              <option value="NOT_DUE">{dueStatusLabel("NOT_DUE")}</option>
              <option value="NO_DUE_DATE">{dueStatusLabel("NO_DUE_DATE")}</option>
            </select>
            <select
              className="col-span-2 h-8 w-full rounded-md border border-slate-200 px-2 text-xs outline-none focus:ring-2 focus:ring-slate-300 xl:col-span-1"
              value={statementSort}
              onChange={(event) => setStatementSort(event.target.value as StatementSort)}
            >
              <option value="DUE_ASC">{t(uiLocale, "purchase.ap.sort.dueAsc")}</option>
              <option value="OUTSTANDING_DESC">
                {t(uiLocale, "purchase.ap.sort.outstandingDesc")}
              </option>
            </select>
          </div>

          <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-2.5">
            <p className="text-[11px] text-slate-600">
              {t(uiLocale, "purchase.ap.dueRange.title")}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1 min-w-0">
                <label className="text-[11px] text-slate-500">
                  {t(uiLocale, "purchase.ap.dueRange.from.label")}
                </label>
                <PurchaseDatePickerField
                  value={dueFrom}
                  onChange={setDueFrom}
                  triggerClassName="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-left text-xs outline-none focus:ring-2 focus:ring-slate-300 flex items-center justify-between gap-2"
                  ariaLabel={t(uiLocale, "purchase.ap.dueRange.from.aria")}
                  dateLocale={dateLocale}
                  weekdayLabels={weekdayLabels}
                  panelAlign="left"
                />
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-100"
                    onClick={() => applyStatementDateShortcut("dueFrom", "TODAY")}
                  >
                    {t(uiLocale, "purchase.dateShortcut.today")}
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-100"
                    onClick={() => applyStatementDateShortcut("dueFrom", "END_OF_MONTH")}
                  >
                    {t(uiLocale, "purchase.dateShortcut.endOfMonth")}
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-100"
                    onClick={() => applyStatementDateShortcut("dueFrom", "CLEAR")}
                  >
                    {t(uiLocale, "purchase.dateShortcut.clear")}
                  </button>
                </div>
              </div>
              <div className="space-y-1 min-w-0">
                <label className="text-[11px] text-slate-500">
                  {t(uiLocale, "purchase.ap.dueRange.to.label")}
                </label>
                <PurchaseDatePickerField
                  value={dueTo}
                  onChange={setDueTo}
                  triggerClassName="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-left text-xs outline-none focus:ring-2 focus:ring-slate-300 flex items-center justify-between gap-2"
                  ariaLabel={t(uiLocale, "purchase.ap.dueRange.to.aria")}
                  dateLocale={dateLocale}
                  weekdayLabels={weekdayLabels}
                  panelAlign="right"
                />
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-100"
                    onClick={() => applyStatementDateShortcut("dueTo", "TODAY")}
                  >
                    {t(uiLocale, "purchase.dateShortcut.today")}
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-100"
                    onClick={() => applyStatementDateShortcut("dueTo", "END_OF_MONTH")}
                  >
                    {t(uiLocale, "purchase.dateShortcut.endOfMonth")}
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-100"
                    onClick={() => applyStatementDateShortcut("dueTo", "CLEAR")}
                  >
                    {t(uiLocale, "purchase.dateShortcut.clear")}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {statementSummary && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
                <p className="text-[10px] text-slate-500">{dueStatusLabel("OVERDUE")}</p>
                <p className="text-xs font-medium text-red-600">
                  {formatMoney(statementSummary.overdueOutstandingBase)}
                </p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
                <p className="text-[10px] text-slate-500">{dueStatusLabel("DUE_SOON")}</p>
                <p className="text-xs font-medium text-amber-700">
                  {formatMoney(statementSummary.dueSoonOutstandingBase)}
                </p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
                <p className="text-[10px] text-slate-500">{dueStatusLabel("NOT_DUE")}</p>
                <p className="text-xs font-medium text-emerald-700">
                  {formatMoney(statementSummary.notDueOutstandingBase)}
                </p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
                <p className="text-[10px] text-slate-500">
                  {dueStatusLabel("NO_DUE_DATE")}
                </p>
                <p className="text-xs font-medium text-slate-700">
                  {formatMoney(statementSummary.noDueDateOutstandingBase)}
                </p>
              </div>
            </div>
          )}

          {isLoadingStatement ? (
            <p className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-3 text-xs text-slate-500">
              {t(uiLocale, "purchase.ap.statement.loading")}
            </p>
          ) : statementError ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-2.5 py-2 text-xs text-red-700">
              {statementError}
            </div>
          ) : displayStatementRows.length === 0 ? (
            <div className="space-y-2 rounded-md border border-dashed border-slate-300 bg-slate-50 px-2.5 py-4 text-center">
              <p className="text-xs text-slate-500">
                {t(uiLocale, "purchase.ap.statement.emptyFiltered")}
              </p>
              <button
                type="button"
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                onClick={resetStatementFilters}
              >
                {t(uiLocale, "purchase.ap.statement.clearFilters")}
              </button>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              <div className="sticky top-0 z-10 mb-2 rounded-md border border-slate-200 bg-white/95 px-2 py-1.5 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/85">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-slate-600">
                    {t(uiLocale, "purchase.monthEnd.selected")} {selectedPoIds.length}/
                    {selectableStatementRows.length} {t(uiLocale, "purchase.items")}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-7 rounded-md px-2 text-[11px]"
                    onClick={selectAllRows}
                    disabled={selectableStatementRows.length === 0 || isBulkSettling}
                  >
                    {t(uiLocale, "purchase.monthEnd.selectAll")}
                  </Button>
                  {selectedPoIds.length > 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-7 rounded-md px-2 text-[11px]"
                      onClick={clearSelectedRows}
                      disabled={isBulkSettling}
                    >
                      {t(uiLocale, "purchase.monthEnd.clearSelection")}
                    </Button>
                  ) : null}
                  {selectedPoIds.length > 0 ? (
                    <Button
                      type="button"
                      className="h-7 rounded-md px-2 text-[11px]"
                      onClick={openBulkSettleMode}
                      disabled={isBulkSettling}
                    >
                      {t(uiLocale, "purchase.ap.bulk.cta.open")}
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="space-y-1.5">
              {displayStatementRows.map((row) => (
                <div
                  key={row.poId}
                  className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-400"
                    checked={selectedPoIdSet.has(row.poId)}
                    onChange={() => toggleRowSelection(row.poId)}
                    disabled={isBulkSettling || row.outstandingBase <= 0}
                  />
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => onOpenPurchaseOrder(row.poId)}
                  >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-slate-900">
                        {row.poNumber}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {t(uiLocale, "purchase.label.dueDate")} {formatDateLocal(row.dueDate)} ·{" "}
                        {t(uiLocale, "purchase.label.receivedAt")} {formatDateLocal(row.receivedAt)}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {paymentStatusLabel(row.paymentStatus)} · {dueStatusLabel(row.dueStatus)}
                        {row.daysUntilDue !== null
                          ? ` (${row.daysUntilDue >= 0 ? `${t(uiLocale, "purchase.ap.row.daysRemaining.prefix")} ${row.daysUntilDue} ${t(uiLocale, "purchase.ap.row.days.suffix")}` : `${t(uiLocale, "purchase.ap.row.daysOverdue.prefix")} ${Math.abs(row.daysUntilDue)} ${t(uiLocale, "purchase.ap.row.days.suffix")}`})`
                          : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-slate-900">
                        {formatMoney(row.grandTotalBase)}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {t(uiLocale, "purchase.detail.payment.paidPrefix")}{" "}
                        {formatMoney(row.totalPaidBase)}
                        {row.outstandingBase > 0 ? (
                          <>
                            {" · "}
                            {t(uiLocale, "purchase.label.outstanding")}{" "}
                            {formatMoney(row.outstandingBase)}
                          </>
                        ) : null}
                      </p>
                    </div>
                  </div>
                  </button>
                </div>
              ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <SlideUpSheet
        isOpen={isSupplierPickerOpen}
        onClose={() => setIsSupplierPickerOpen(false)}
        title={t(uiLocale, "purchase.ap.supplier.select.placeholder")}
        description={t(uiLocale, "purchase.ap.panel.subtitle")}
        scrollToTopOnOpen
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-700">
              {t(uiLocale, "purchase.ap.supplier.search.placeholder")}
            </p>
            <Button
              type="button"
              variant="outline"
              className="h-8 rounded-lg px-2.5 text-xs"
              onClick={() => {
                void loadSupplierSummary();
              }}
              disabled={isLoadingSuppliers}
            >
              {isLoadingSuppliers ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <RefreshCw className="mr-1 h-3.5 w-3.5" />
                  {t(uiLocale, "purchase.ap.panel.refresh")}
                </>
              )}
            </Button>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-9 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-300"
              placeholder={t(uiLocale, "purchase.ap.supplier.search.placeholder")}
              value={supplierSearchInput}
              onChange={(event) => setSupplierSearchInput(event.target.value)}
            />
            {supplierSearchInput.trim().length > 0 ? (
              <button
                type="button"
                className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                onClick={resetSupplierSearch}
                aria-label={t(uiLocale, "purchase.ap.supplier.search.clear")}
                title={t(uiLocale, "purchase.ap.supplier.search.clear")}
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <div className="max-h-[50vh] space-y-1.5 overflow-y-auto pr-1">
            {isLoadingSuppliers ? (
              <p className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-500">
                {t(uiLocale, "purchase.ap.supplier.list.loading")}
              </p>
            ) : supplierError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-sm text-red-700">
                {supplierError}
              </div>
            ) : suppliers.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white px-2.5 py-6 text-center">
                <p className="text-sm text-slate-500">
                  {t(uiLocale, "purchase.ap.supplier.list.empty")}
                </p>
              </div>
            ) : (
              suppliers.map((supplier) => {
                const isActive = supplier.supplierKey === selectedSupplierKey;
                return (
                  <button
                    key={supplier.supplierKey}
                    type="button"
                    className={`w-full rounded-lg border px-3 py-2.5 text-left ${
                      isActive
                        ? "border-primary bg-primary/5"
                        : "border-slate-200 bg-white hover:bg-slate-100"
                    }`}
                    onClick={() => {
                      setSelectedSupplierKey(supplier.supplierKey);
                      setIsSupplierPickerOpen(false);
                    }}
                  >
                    <p className="truncate text-sm font-medium text-slate-900">
                      {supplier.supplierName}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {supplier.poCount} PO ·{" "}
                      {t(uiLocale, "dashboard.purchaseAp.item.outstandingLabel")}{" "}
                      {formatMoney(supplier.totalOutstandingBase)}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </SlideUpSheet>

      <SlideUpSheet
        isOpen={isBulkSettleMode}
        onClose={() => setIsBulkSettleMode(false)}
        title={t(uiLocale, "purchase.ap.bulk.title")}
        description={t(uiLocale, "purchase.monthEnd.bulk.panel.subtitle")}
        closeOnBackdrop={false}
        disabled={isBulkSettling}
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-10 border-emerald-200 bg-white text-xs text-emerald-700 hover:bg-emerald-50"
              onClick={() => setIsBulkSettleMode(false)}
              disabled={isBulkSettling}
            >
              {t(uiLocale, "common.action.cancel")}
            </Button>
            <Button
              type="button"
              className="h-10 bg-emerald-600 text-xs text-white hover:bg-emerald-700"
              onClick={() => {
                void submitBulkSettle();
              }}
              disabled={isBulkSettling || selectedPoIds.length === 0}
            >
              {isBulkSettling ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t(uiLocale, "purchase.ap.bulk.cta.confirm")
              )}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-[11px] text-slate-600">
                {t(uiLocale, "purchase.monthEnd.bulk.field.paidAt.label")}
              </label>
              <input
                type="date"
                className="h-10 w-full rounded-lg border border-emerald-200 bg-white px-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-300"
                value={bulkPaidAtInput}
                onChange={(event) => setBulkPaidAtInput(event.target.value)}
                disabled={isBulkSettling}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-slate-600">
                {t(uiLocale, "purchase.monthEnd.bulk.field.reference.labelRequired")}
              </label>
              <input
                className="h-10 w-full rounded-lg border border-emerald-200 bg-white px-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-300"
                value={bulkReferenceInput}
                onChange={(event) => setBulkReferenceInput(event.target.value)}
                placeholder={t(uiLocale, "purchase.monthEnd.bulk.field.reference.placeholder")}
                disabled={isBulkSettling}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-slate-600">
                {t(uiLocale, "purchase.monthEnd.bulk.field.note.labelOptional")}
              </label>
              <input
                className="h-10 w-full rounded-lg border border-emerald-200 bg-white px-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-300"
                value={bulkNoteInput}
                onChange={(event) => setBulkNoteInput(event.target.value)}
                placeholder={t(uiLocale, "purchase.monthEnd.bulk.field.note.placeholder")}
                disabled={isBulkSettling}
              />
            </div>
          </div>

          <div className="space-y-1.5 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
            <p className="text-xs font-medium text-emerald-800">
              {t(uiLocale, "purchase.monthEnd.bulk.preview.title")}
            </p>
            <p className="text-xs text-emerald-800">
              {t(uiLocale, "purchase.monthEnd.bulk.preview.selectedOutstanding.prefix")}{" "}
              {formatMoney(bulkAllocationPreview.totalOutstanding)}
              {" · "}
              {t(uiLocale, "purchase.monthEnd.bulk.preview.willSettle.prefix")}{" "}
              {formatMoney(bulkAllocationPreview.plannedTotal)}
              {" · "}
              {t(uiLocale, "purchase.monthEnd.bulk.preview.remainingOutstanding.prefix")}{" "}
              {formatMoney(bulkAllocationPreview.outstandingAfter)}
            </p>
          </div>

          {bulkProgressText ? (
            <p className="text-xs text-emerald-700">{bulkProgressText}</p>
          ) : null}
          {bulkErrors.length > 0 ? (
            <div className="space-y-1 rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-xs font-medium text-red-700">
                {t(uiLocale, "purchase.monthEnd.bulk.errors.title.prefix")} (
                {bulkErrors.length.toLocaleString()})
              </p>
              <ul className="max-h-28 list-disc space-y-0.5 overflow-y-auto pl-4 text-[11px] text-red-700">
                {bulkErrors.map((error, index) => (
                  <li key={`${error}-${index}`}>{error}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </SlideUpSheet>
    </div>
  );
}
