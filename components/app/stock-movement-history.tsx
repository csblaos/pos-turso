"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Calendar,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ListFilter,
  LoaderCircle,
  ScanBarcode,
  Search,
  X,
} from "lucide-react";

import { BarcodeScannerPanel } from "@/components/app/barcode-scanner-panel";
import { Button } from "@/components/ui/button";
import { SlideUpSheet } from "@/components/ui/slide-up-sheet";
import {
  StockTabEmptyState,
  StockTabErrorState,
  StockTabToolbar,
} from "@/components/app/stock-tab-feedback";
import { authFetch } from "@/lib/auth/client-token";
import { uiLocaleToDateLocale } from "@/lib/i18n/locales";
import { t, type MessageKey } from "@/lib/i18n/messages";
import { useUiLocale } from "@/lib/i18n/use-ui-locale";
import type { InventoryMovementView } from "@/lib/inventory/queries";

type StockMovementHistoryProps = {
  movements: InventoryMovementView[];
  initialTotal: number;
};

type MovementTypeFilter =
  | "all"
  | "IN"
  | "OUT"
  | "RESERVE"
  | "RELEASE"
  | "ADJUST"
  | "RETURN";

const movementBadgeClass: Record<InventoryMovementView["type"], string> = {
  IN: "bg-emerald-100 text-emerald-700",
  OUT: "bg-rose-100 text-rose-700",
  RESERVE: "bg-amber-100 text-amber-700",
  RELEASE: "bg-slate-200 text-slate-700",
  ADJUST: "bg-blue-100 text-blue-700",
  RETURN: "bg-purple-100 text-purple-700",
};

const movementTypeLabelKeyMap: Record<InventoryMovementView["type"], MessageKey> = {
  IN: "stock.movementType.IN",
  OUT: "stock.movementType.OUT",
  RESERVE: "stock.movementType.RESERVE",
  RELEASE: "stock.movementType.RELEASE",
  ADJUST: "stock.movementType.ADJUST",
  RETURN: "stock.movementType.RETURN",
};

const ITEMS_PER_PAGE = 10;
const HISTORY_CACHE_MAX_ENTRIES = 24;
const SCANNER_PERMISSION_STORAGE_KEY = "scanner-permission-seen";
const HISTORY_TYPE_QUERY_KEY = "historyType";
const HISTORY_PAGE_QUERY_KEY = "historyPage";
const HISTORY_Q_QUERY_KEY = "historyQ";
const HISTORY_DATE_FROM_QUERY_KEY = "historyDateFrom";
const HISTORY_DATE_TO_QUERY_KEY = "historyDateTo";
const HISTORY_LIST_SKELETON_COUNT = 4;

const isDateOnly = (value: string | null) =>
  Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));

function parseHistoryTypeFilter(value: string | null): MovementTypeFilter | null {
  if (
    value === "all" ||
    value === "IN" ||
    value === "OUT" ||
    value === "RESERVE" ||
    value === "RELEASE" ||
    value === "ADJUST" ||
    value === "RETURN"
  ) {
    return value;
  }
  return null;
}

function parsePositivePage(value: string | null): number {
  if (!value) {
    return 1;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1;
  }
  return parsed;
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
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
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

type HistoryDatePickerFieldProps = {
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

function HistoryDatePickerField({
  value,
  onChange,
  placeholder,
  ariaLabel,
  dateLocale,
  weekdayLabels,
  clearLabel,
  closeLabel,
  panelAlign = "left",
}: HistoryDatePickerFieldProps) {
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
        className="flex h-10 w-full items-center justify-between gap-2 rounded-md border px-3 text-sm outline-none ring-primary transition focus:ring-2"
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

const movementTypeFilterOptions: Array<{ value: MovementTypeFilter; labelKey: MessageKey }> = [
  { value: "all", labelKey: "common.filter.all" },
  { value: "IN", labelKey: "stock.movementType.IN" },
  { value: "OUT", labelKey: "stock.history.filter.type.OUT" },
  { value: "RESERVE", labelKey: "stock.movementType.RESERVE" },
  { value: "RELEASE", labelKey: "stock.movementType.RELEASE" },
  { value: "ADJUST", labelKey: "stock.movementType.ADJUST" },
  { value: "RETURN", labelKey: "stock.movementType.RETURN" },
];

function buildHistoryCacheKey(params: {
  page: number;
  typeFilter: MovementTypeFilter;
  query: string;
  dateFrom: string;
  dateTo: string;
}): string {
  return [
    params.page,
    params.typeFilter,
    params.query.trim().toLowerCase(),
    params.dateFrom,
    params.dateTo,
  ].join("|");
}

export function StockMovementHistory({ movements, initialTotal }: StockMovementHistoryProps) {
  const pathname = usePathname() ?? "/";
  const rawSearchParams = useSearchParams();
  const searchParams = useMemo(
    () => rawSearchParams ?? new URLSearchParams(),
    [rawSearchParams],
  );
  const uiLocale = useUiLocale();
  const numberLocale = uiLocaleToDateLocale(uiLocale);
  const weekdayLabels = [
    t(uiLocale, "purchase.calendar.weekday.SUN"),
    t(uiLocale, "purchase.calendar.weekday.MON"),
    t(uiLocale, "purchase.calendar.weekday.TUE"),
    t(uiLocale, "purchase.calendar.weekday.WED"),
    t(uiLocale, "purchase.calendar.weekday.THU"),
    t(uiLocale, "purchase.calendar.weekday.FRI"),
    t(uiLocale, "purchase.calendar.weekday.SAT"),
  ] as const;
  const isHistoryTabActive = searchParams.get("tab") === "history";
  const typeFilterFromQuery =
    parseHistoryTypeFilter(searchParams.get(HISTORY_TYPE_QUERY_KEY)) ?? "all";
  const pageFromQuery = parsePositivePage(searchParams.get(HISTORY_PAGE_QUERY_KEY));
  const queryFromUrl = searchParams.get(HISTORY_Q_QUERY_KEY)?.trim() ?? "";
  const dateFromFromUrl = isDateOnly(searchParams.get(HISTORY_DATE_FROM_QUERY_KEY))
    ? (searchParams.get(HISTORY_DATE_FROM_QUERY_KEY) as string)
    : "";
  const dateToFromUrl = isDateOnly(searchParams.get(HISTORY_DATE_TO_QUERY_KEY))
    ? (searchParams.get(HISTORY_DATE_TO_QUERY_KEY) as string)
    : "";

  const [movementItems, setMovementItems] = useState(movements);
  const [totalItems, setTotalItems] = useState(initialTotal);
  const [typeFilterInput, setTypeFilterInput] = useState<MovementTypeFilter>(typeFilterFromQuery);
  const [appliedTypeFilter, setAppliedTypeFilter] = useState<MovementTypeFilter>(typeFilterFromQuery);
  const [page, setPage] = useState(pageFromQuery);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(
    movements.length > 0 ? new Date().toISOString() : null,
  );

  const [productQueryInput, setProductQueryInput] = useState(queryFromUrl);
  const [dateFromInput, setDateFromInput] = useState(dateFromFromUrl);
  const [dateToInput, setDateToInput] = useState(dateToFromUrl);
  const [appliedProductQuery, setAppliedProductQuery] = useState(queryFromUrl);
  const [appliedDateFrom, setAppliedDateFrom] = useState(dateFromFromUrl);
  const [appliedDateTo, setAppliedDateTo] = useState(dateToFromUrl);
  const [showScanner, setShowScanner] = useState(false);
  const [showScannerPermission, setShowScannerPermission] = useState(false);
  const [hasSeenScannerPermission, setHasSeenScannerPermission] = useState(false);
  const [pendingScannedQuery, setPendingScannedQuery] = useState<string | null>(null);
  const [hasPendingScanFetchStarted, setHasPendingScanFetchStarted] = useState(false);
  const historySearchStickyRef = useRef<HTMLDivElement | null>(null);
  const [isHistorySearchStickyStuck, setIsHistorySearchStickyStuck] = useState(false);
  const historyCacheRef = useRef<
    Map<string, { movements: InventoryMovementView[]; total: number; fetchedAt: string }>
  >(new Map());

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    setHasSeenScannerPermission(
      window.localStorage.getItem(SCANNER_PERMISSION_STORAGE_KEY) === "1",
    );
  }, []);

  const currentCacheKey = buildHistoryCacheKey({
    page,
    typeFilter: appliedTypeFilter,
    query: appliedProductQuery,
    dateFrom: appliedDateFrom,
    dateTo: appliedDateTo,
  });
  const initialHistoryCacheKey = useMemo(
    () =>
      buildHistoryCacheKey({
        page: pageFromQuery,
        typeFilter: typeFilterFromQuery,
        query: queryFromUrl,
        dateFrom: dateFromFromUrl,
        dateTo: dateToFromUrl,
      }),
    [
      dateFromFromUrl,
      dateToFromUrl,
      pageFromQuery,
      queryFromUrl,
      typeFilterFromQuery,
    ],
  );

  useEffect(() => {
    setMovementItems(movements);
    setTotalItems(initialTotal);
    setErrorMessage(null);
    const fetchedAt = movements.length > 0 ? new Date().toISOString() : null;
    setLastUpdatedAt(fetchedAt);
    historyCacheRef.current.set(initialHistoryCacheKey, {
      movements,
      total: initialTotal,
      fetchedAt: fetchedAt ?? new Date().toISOString(),
    });
  }, [initialHistoryCacheKey, initialTotal, movements]);

  useEffect(() => {
    if (!isHistoryTabActive) {
      return;
    }

    const nextTypeFilter =
      parseHistoryTypeFilter(searchParams.get(HISTORY_TYPE_QUERY_KEY)) ?? "all";
    setTypeFilterInput((current) =>
      current === nextTypeFilter ? current : nextTypeFilter,
    );
    setAppliedTypeFilter((current) =>
      current === nextTypeFilter ? current : nextTypeFilter,
    );

    const nextPage = parsePositivePage(searchParams.get(HISTORY_PAGE_QUERY_KEY));
    setPage((current) => (current === nextPage ? current : nextPage));

    const nextQuery = searchParams.get(HISTORY_Q_QUERY_KEY)?.trim() ?? "";
    setProductQueryInput((current) => (current === nextQuery ? current : nextQuery));
    setAppliedProductQuery((current) => (current === nextQuery ? current : nextQuery));

    const nextDateFrom = isDateOnly(searchParams.get(HISTORY_DATE_FROM_QUERY_KEY))
      ? (searchParams.get(HISTORY_DATE_FROM_QUERY_KEY) as string)
      : "";
    const nextDateTo = isDateOnly(searchParams.get(HISTORY_DATE_TO_QUERY_KEY))
      ? (searchParams.get(HISTORY_DATE_TO_QUERY_KEY) as string)
      : "";
    setDateFromInput((current) =>
      current === nextDateFrom ? current : nextDateFrom,
    );
    setAppliedDateFrom((current) =>
      current === nextDateFrom ? current : nextDateFrom,
    );
    setDateToInput((current) => (current === nextDateTo ? current : nextDateTo));
    setAppliedDateTo((current) => (current === nextDateTo ? current : nextDateTo));
  }, [
    isHistoryTabActive,
    searchParams,
  ]);

  useEffect(() => {
    if (!isHistoryTabActive) {
      return;
    }

    const nextQuery = productQueryInput.trim();
    if (nextQuery === appliedProductQuery) {
      return;
    }

    const timer = window.setTimeout(() => {
      setAppliedProductQuery(nextQuery);
      setPage(1);
    }, 350);

    return () => {
      window.clearTimeout(timer);
    };
  }, [appliedProductQuery, isHistoryTabActive, productQueryInput]);

  const fetchHistory = useCallback(
    async (options?: { manual?: boolean; signal?: AbortSignal; background?: boolean }) => {
      const isManual = options?.manual ?? false;
      const isBackground = options?.background ?? false;
      setErrorMessage(null);
      if (isManual) {
        setIsRefreshing(true);
      } else if (!isBackground) {
        setIsLoading(true);
      }

      try {
        const params = new URLSearchParams({
          view: "history",
          page: String(page),
          pageSize: String(ITEMS_PER_PAGE),
        });

        if (appliedTypeFilter !== "all") {
          params.set("type", appliedTypeFilter);
        }
        if (appliedProductQuery) {
          params.set("q", appliedProductQuery);
        }
        if (appliedDateFrom) {
          params.set("dateFrom", appliedDateFrom);
        }
        if (appliedDateTo) {
          params.set("dateTo", appliedDateTo);
        }

        const res = await authFetch(`/api/stock/movements?${params.toString()}`, {
          signal: options?.signal,
        });
        const data = (await res.json().catch(() => null)) as
          | {
              ok?: boolean;
              movements?: InventoryMovementView[];
              total?: number;
              message?: string;
            }
          | null;

        if (options?.signal?.aborted) {
          return;
        }

        if (!res.ok) {
          setErrorMessage(data?.message ?? t(uiLocale, "stock.history.error.loadFailed"));
          return;
        }

        if (!data?.ok || !Array.isArray(data.movements)) {
          setErrorMessage(t(uiLocale, "stock.history.error.invalidData"));
          return;
        }

        const nextTotal = Number(data.total ?? data.movements.length);
        const fetchedAt = new Date().toISOString();
        setMovementItems(data.movements);
        setTotalItems(nextTotal);
        setErrorMessage(null);
        setLastUpdatedAt(fetchedAt);
        historyCacheRef.current.set(currentCacheKey, {
          movements: data.movements,
          total: nextTotal,
          fetchedAt,
        });
        if (historyCacheRef.current.size > HISTORY_CACHE_MAX_ENTRIES) {
          const oldestKey = historyCacheRef.current.keys().next().value;
          if (oldestKey) {
            historyCacheRef.current.delete(oldestKey);
          }
        }
      } catch {
        if (options?.signal?.aborted) {
          return;
        }
        setErrorMessage(t(uiLocale, "stock.error.serverUnreachableRetry"));
      } finally {
        if (options?.signal?.aborted) {
          return;
        }
        if (isManual) {
          setIsRefreshing(false);
        } else if (!isBackground) {
          setIsLoading(false);
        }
      }
    },
    [
      appliedDateFrom,
      appliedDateTo,
      appliedProductQuery,
      appliedTypeFilter,
      currentCacheKey,
      page,
      uiLocale,
    ],
  );

  useEffect(() => {
    if (!isHistoryTabActive) {
      return;
    }

    const controller = new AbortController();
    const cached = historyCacheRef.current.get(currentCacheKey);
    if (cached) {
      setMovementItems(cached.movements);
      setTotalItems(cached.total);
      setErrorMessage(null);
      setLastUpdatedAt(cached.fetchedAt);
      void fetchHistory({ signal: controller.signal, background: true });
    } else {
      void fetchHistory({ signal: controller.signal });
    }
    return () => controller.abort();
  }, [currentCacheKey, fetchHistory, isHistoryTabActive]);

  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    if (!isHistoryTabActive) {
      return;
    }

    const params = new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : searchParams.toString(),
    );
    let changed = false;

    if (appliedTypeFilter === "all") {
      if (params.has(HISTORY_TYPE_QUERY_KEY)) {
        params.delete(HISTORY_TYPE_QUERY_KEY);
        changed = true;
      }
    } else if (params.get(HISTORY_TYPE_QUERY_KEY) !== appliedTypeFilter) {
      params.set(HISTORY_TYPE_QUERY_KEY, appliedTypeFilter);
      changed = true;
    }

    if (appliedProductQuery) {
      if (params.get(HISTORY_Q_QUERY_KEY) !== appliedProductQuery) {
        params.set(HISTORY_Q_QUERY_KEY, appliedProductQuery);
        changed = true;
      }
    } else if (params.has(HISTORY_Q_QUERY_KEY)) {
      params.delete(HISTORY_Q_QUERY_KEY);
      changed = true;
    }

    if (appliedDateFrom) {
      if (params.get(HISTORY_DATE_FROM_QUERY_KEY) !== appliedDateFrom) {
        params.set(HISTORY_DATE_FROM_QUERY_KEY, appliedDateFrom);
        changed = true;
      }
    } else if (params.has(HISTORY_DATE_FROM_QUERY_KEY)) {
      params.delete(HISTORY_DATE_FROM_QUERY_KEY);
      changed = true;
    }

    if (appliedDateTo) {
      if (params.get(HISTORY_DATE_TO_QUERY_KEY) !== appliedDateTo) {
        params.set(HISTORY_DATE_TO_QUERY_KEY, appliedDateTo);
        changed = true;
      }
    } else if (params.has(HISTORY_DATE_TO_QUERY_KEY)) {
      params.delete(HISTORY_DATE_TO_QUERY_KEY);
      changed = true;
    }

    if (currentPage <= 1) {
      if (params.has(HISTORY_PAGE_QUERY_KEY)) {
        params.delete(HISTORY_PAGE_QUERY_KEY);
        changed = true;
      }
    } else if (params.get(HISTORY_PAGE_QUERY_KEY) !== String(currentPage)) {
      params.set(HISTORY_PAGE_QUERY_KEY, String(currentPage));
      changed = true;
    }

    if (!changed) {
      return;
    }

    const nextQuery = params.toString();
    if (typeof window !== "undefined") {
      window.history.replaceState(
        window.history.state,
        "",
        nextQuery ? `${pathname}?${nextQuery}` : pathname,
      );
    }
  }, [
    appliedDateFrom,
    appliedDateTo,
    appliedProductQuery,
    currentPage,
    isHistoryTabActive,
    pathname,
    searchParams,
    appliedTypeFilter,
  ]);

  useEffect(() => {
    if (!pendingScannedQuery) {
      return;
    }

    if (!hasPendingScanFetchStarted && isLoading) {
      setHasPendingScanFetchStarted(true);
      return;
    }

    if (!hasPendingScanFetchStarted && historyCacheRef.current.has(currentCacheKey)) {
      setPendingScannedQuery(null);
      return;
    }

    if (hasPendingScanFetchStarted && !isLoading && !isRefreshing) {
      setPendingScannedQuery(null);
      setHasPendingScanFetchStarted(false);
    }
  }, [
    currentCacheKey,
    hasPendingScanFetchStarted,
    isLoading,
    isRefreshing,
    pendingScannedQuery,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const updateStuckState = () => {
      const stickyEl = historySearchStickyRef.current;
      if (!stickyEl) {
        return;
      }

      const style = window.getComputedStyle(stickyEl);
      if (style.position !== "sticky") {
        setIsHistorySearchStickyStuck(false);
        return;
      }

      const topPx = Number.parseFloat(style.top || "0") || 0;
      const nextStuck = stickyEl.getBoundingClientRect().top <= topPx + 0.5;
      setIsHistorySearchStickyStuck((prev) => (prev === nextStuck ? prev : nextStuck));
    };

    updateStuckState();

    let rafId = 0;
    const scheduleUpdate = () => {
      if (rafId !== 0) {
        return;
      }
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        updateStuckState();
      });
    };

    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    return () => {
      if (rafId !== 0) {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, []);

  const applyFilters = () => {
    if (dateFromInput && dateToInput && dateFromInput > dateToInput) {
      setErrorMessage(t(uiLocale, "stock.history.filter.error.invalidDateRange"));
      return;
    }

    const nextQuery = productQueryInput.trim();
    const shouldResetPage =
      appliedTypeFilter !== typeFilterInput ||
      appliedProductQuery !== nextQuery ||
      appliedDateFrom !== dateFromInput ||
      appliedDateTo !== dateToInput;
    setAppliedTypeFilter(typeFilterInput);
    setAppliedProductQuery(nextQuery);
    setAppliedDateFrom(dateFromInput);
    setAppliedDateTo(dateToInput);
    if (shouldResetPage) {
      setPage(1);
    }
  };

  const clearFilters = () => {
    setTypeFilterInput("all");
    setProductQueryInput("");
    setDateFromInput("");
    setDateToInput("");
    setAppliedTypeFilter("all");
    setAppliedProductQuery("");
    setAppliedDateFrom("");
    setAppliedDateTo("");
    setPage(1);
  };

  const openScanner = () => {
    if (hasSeenScannerPermission) {
      setShowScanner(true);
    } else {
      setShowScannerPermission(true);
    }
  };

  const handleBarcodeResult = useCallback((barcode: string) => {
    const trimmed = barcode.trim();
    setShowScanner(false);
    if (!trimmed) {
      return;
    }
    setPendingScannedQuery(trimmed);
    setHasPendingScanFetchStarted(false);
    setProductQueryInput(trimmed);
    setAppliedProductQuery(trimmed);
    setPage(1);
  }, []);

  const hasActiveFilters =
    appliedTypeFilter !== "all" ||
    Boolean(appliedProductQuery) ||
    Boolean(appliedDateFrom) ||
    Boolean(appliedDateTo);
  const isScanSearchPending = pendingScannedQuery !== null;
  const isSearchTypingPending = productQueryInput.trim() !== appliedProductQuery;
  const isHistorySearchPending = isScanSearchPending || isSearchTypingPending;
  const shouldShowHistoryListSkeleton =
    (isLoading || isRefreshing) && movementItems.length === 0;

  const getTypeFilterLabel = (value: MovementTypeFilter) => {
    const option = movementTypeFilterOptions.find((item) => item.value === value);
    return t(uiLocale, option?.labelKey ?? "common.filter.all");
  };

  const clearHistorySearch = () => {
    setPendingScannedQuery(null);
    setHasPendingScanFetchStarted(false);
    setProductQueryInput("");
    setAppliedProductQuery("");
    setPage(1);
  };

  return (
    <section className="space-y-4">
      <StockTabToolbar
        title={t(uiLocale, "stock.tabs.history.mobile")}
        isRefreshing={isRefreshing || isLoading}
        lastUpdatedAt={lastUpdatedAt}
        onRefresh={() => {
          void fetchHistory({ manual: true });
        }}
      />

      <div
        ref={historySearchStickyRef}
        className={`sticky top-[3.8rem] z-10 transition-[margin,padding,background-color,box-shadow,border-color] ${
          isHistorySearchStickyStuck
            ? "-mx-4 border-y border-slate-200 bg-white px-4 py-2 shadow-sm supports-[backdrop-filter]:bg-white md:-mx-6 md:px-6 min-[1200px]:-mx-8 min-[1200px]:px-8"
            : "px-0 py-2"
        }`}
      >
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="text"
              value={productQueryInput}
              onChange={(event) => setProductQueryInput(event.target.value)}
              placeholder={t(uiLocale, "stock.history.filter.product.placeholder")}
              className="h-10 w-full rounded-md border pl-9 pr-9 text-sm outline-none focus:border-blue-300"
            />
            {isHistorySearchPending ? (
              <LoaderCircle
                className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400"
                aria-hidden="true"
              />
            ) : productQueryInput ? (
              <button
                type="button"
                onClick={clearHistorySearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label={t(uiLocale, "stock.history.filter.clear")}
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-10 w-10 shrink-0 px-0"
            onClick={openScanner}
            aria-label={t(uiLocale, "products.search.scanAria")}
            disabled={isHistorySearchPending}
          >
            <ScanBarcode className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <article className="space-y-3 rounded-xl border bg-white p-3 shadow-sm">
        <div className="grid grid-cols-3 gap-2">
          <div className="relative min-w-0">
            <ListFilter
              className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${
                typeFilterInput === "all" ? "text-slate-400" : "text-blue-600"
              }`}
              aria-hidden="true"
            />
            <select
              value={typeFilterInput}
              onChange={(event) =>
                setTypeFilterInput((event.target.value as MovementTypeFilter) ?? "all")
              }
              className={`h-10 w-full appearance-none rounded-xl border bg-white pl-9 pr-9 text-sm outline-none focus:border-blue-300 ${
                typeFilterInput === "all"
                  ? "border-slate-200 text-slate-700"
                  : "border-blue-200 bg-blue-50 text-blue-700"
              }`}
              aria-label={t(uiLocale, "stock.history.filter.type.ariaLabel")}
            >
              {movementTypeFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(uiLocale, "stock.history.filter.type.optionPrefix")} {t(uiLocale, option.labelKey)}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
          </div>
          <HistoryDatePickerField
            value={dateFromInput}
            onChange={setDateFromInput}
            ariaLabel={t(uiLocale, "stock.history.filter.dateFrom.ariaLabel")}
            placeholder={t(uiLocale, "stock.history.filter.dateFrom.placeholder")}
            dateLocale={numberLocale}
            weekdayLabels={weekdayLabels}
            clearLabel={t(uiLocale, "stock.history.datePicker.clear")}
            closeLabel={t(uiLocale, "stock.history.datePicker.close")}
            panelAlign="left"
          />
          <HistoryDatePickerField
            value={dateToInput}
            onChange={setDateToInput}
            ariaLabel={t(uiLocale, "stock.history.filter.dateTo.ariaLabel")}
            placeholder={t(uiLocale, "stock.history.filter.dateTo.placeholder")}
            dateLocale={numberLocale}
            weekdayLabels={weekdayLabels}
            clearLabel={t(uiLocale, "stock.history.datePicker.clear")}
            closeLabel={t(uiLocale, "stock.history.datePicker.close")}
            panelAlign="right"
          />
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-8 px-3 text-xs"
            onClick={clearFilters}
          >
            {t(uiLocale, "stock.history.filter.clear")}
          </Button>
          <Button type="button" className="h-8 px-3 text-xs" onClick={applyFilters}>
            {t(uiLocale, "stock.history.filter.apply")}
          </Button>
        </div>

        {hasActiveFilters ? (
          <div className="flex flex-wrap gap-2 text-xs text-slate-600">
            <span className="rounded-full bg-slate-100 px-2 py-1">
              {t(uiLocale, "stock.history.filter.chip.type")} {getTypeFilterLabel(appliedTypeFilter)}
            </span>
            {appliedProductQuery ? (
              <span className="rounded-full bg-slate-100 px-2 py-1">
                {t(uiLocale, "stock.history.filter.chip.search")} {appliedProductQuery}
              </span>
            ) : null}
            {appliedDateFrom ? (
              <span className="rounded-full bg-slate-100 px-2 py-1">
                {t(uiLocale, "stock.history.filter.chip.from")} {appliedDateFrom}
              </span>
            ) : null}
            {appliedDateTo ? (
              <span className="rounded-full bg-slate-100 px-2 py-1">
                {t(uiLocale, "stock.history.filter.chip.to")} {appliedDateTo}
              </span>
            ) : null}
          </div>
        ) : null}
      </article>

      {shouldShowHistoryListSkeleton ? (
        <div className="space-y-2">
          {Array.from({ length: HISTORY_LIST_SKELETON_COUNT }).map((_, index) => (
            <article
              key={`history-loading-${index}`}
              className="rounded-xl border bg-white p-4 shadow-sm"
            >
              <div className="animate-pulse space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-20 rounded bg-slate-200" />
                    <div className="h-4 w-44 rounded bg-slate-200" />
                  </div>
                  <div className="h-6 w-16 rounded-full bg-slate-200" />
                </div>
                <div className="h-8 w-24 rounded bg-slate-100" />
                <div className="h-10 rounded-lg bg-slate-100" />
              </div>
            </article>
          ))}
        </div>
      ) : errorMessage && movementItems.length === 0 ? (
        <StockTabErrorState
          message={errorMessage}
          onRetry={() => {
            void fetchHistory({ manual: true });
          }}
        />
      ) : movementItems.length === 0 ? (
        <StockTabEmptyState
          title={t(uiLocale, "stock.history.empty.title")}
          description={t(uiLocale, "stock.history.empty.description")}
        />
      ) : (
        <div className={`space-y-2 transition-opacity ${isHistorySearchPending ? "opacity-60" : "opacity-100"}`}>
          <p className="text-xs text-slate-500">
            {t(uiLocale, "stock.history.summary.showing.prefix")}{" "}
            {movementItems.length.toLocaleString(numberLocale)}{" "}
            {t(uiLocale, "stock.history.summary.showing.infix")}{" "}
            {totalItems.toLocaleString(numberLocale)}{" "}
            {t(uiLocale, "stock.history.summary.showing.suffix")}
          </p>

          <div className="space-y-2">
            {movementItems.map((movement) => (
              <article
                key={movement.id}
                className="rounded-xl border bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs text-slate-500">{movement.productSku}</p>
                        <p className="text-sm font-medium">{movement.productName}</p>
                        {movement.productBarcode ? (
                          <p className="text-[11px] text-slate-500">
                            {t(uiLocale, "products.label.barcode")}: {movement.productBarcode}
                          </p>
                        ) : null}
                      </div>
                      <span
                        className={`flex-shrink-0 rounded-full px-2 py-1 text-xs ${movementBadgeClass[movement.type]}`}
                      >
                        {t(uiLocale, movementTypeLabelKeyMap[movement.type])}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center gap-4">
                      <div>
                        <p className="text-xs text-slate-500">{t(uiLocale, "stock.movement.baseQty.label")}</p>
                        <p
                          className={`text-lg font-bold ${
                            movement.qtyBase >= 0 ? "text-emerald-600" : "text-red-600"
                          }`}
                        >
                          {movement.qtyBase >= 0 ? "+" : ""}
                          {movement.qtyBase.toLocaleString(numberLocale)}
                        </p>
                      </div>
                    </div>

                    {movement.note && (
                      <div className="mt-2 rounded-lg bg-slate-50 p-2">
                        <p className="text-xs text-slate-600">
                          <strong>{t(uiLocale, "stock.movement.note.prefix")}</strong> {movement.note}
                        </p>
                      </div>
                    )}

                    <div className="mt-2 flex items-center gap-1 text-xs text-slate-500">
                      <Calendar className="h-3 w-3" />
                      <span>
                        {new Date(movement.createdAt).toLocaleString(numberLocale, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span>•</span>
                      <span>
                        {t(uiLocale, "stock.movement.by.prefix")}{" "}
                        {movement.createdByName ?? t(uiLocale, "common.actor.system")}
                      </span>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {errorMessage && movementItems.length > 0 ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2">
          <p className="text-xs text-red-700">{errorMessage}</p>
          <Button
            type="button"
            variant="outline"
            className="h-7 border-red-200 bg-white px-2.5 text-xs text-red-700 hover:bg-red-100"
            onClick={() => {
              void fetchHistory({ manual: true });
            }}
          >
            {t(uiLocale, "stock.feedback.retry")}
          </Button>
        </div>
      ) : null}

      {totalPages > 1 && (
        <article className="rounded-xl border bg-white p-3 shadow-sm">
          <div className="flex items-center justify-between text-xs">
            <p className="text-slate-600">
              {t(uiLocale, "stock.history.pagination.pagePrefix")}{" "}
              {currentPage.toLocaleString(numberLocale)} /{" "}
              {totalPages.toLocaleString(numberLocale)} (
              {totalItems.toLocaleString(numberLocale)}{" "}
              {t(uiLocale, "stock.history.pagination.itemsSuffix")})
            </p>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-8 px-3 text-xs"
                disabled={currentPage <= 1 || isLoading || isRefreshing}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                {t(uiLocale, "stock.history.pagination.prev")}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="h-8 px-3 text-xs"
                disabled={currentPage >= totalPages || isLoading || isRefreshing}
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              >
                {t(uiLocale, "stock.history.pagination.next")}
              </Button>
            </div>
          </div>
        </article>
      )}

      <SlideUpSheet
        isOpen={showScannerPermission}
        onClose={() => setShowScannerPermission(false)}
        title={t(uiLocale, "products.scannerPermission.title")}
        description={t(uiLocale, "products.scannerPermission.description")}
      >
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            <p className="font-medium text-slate-700">
              {t(uiLocale, "products.scannerPermission.whyTitle")}
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>{t(uiLocale, "products.scannerPermission.bullet.fast")}</li>
              <li>{t(uiLocale, "products.scannerPermission.bullet.fewerTypos")}</li>
              <li>{t(uiLocale, "products.scannerPermission.bullet.ready")}</li>
            </ul>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-10 flex-1"
              onClick={() => setShowScannerPermission(false)}
            >
              {t(uiLocale, "common.action.cancel")}
            </Button>
            <Button
              type="button"
              className="h-10 flex-1"
              onClick={() => {
                window.localStorage.setItem(SCANNER_PERMISSION_STORAGE_KEY, "1");
                setHasSeenScannerPermission(true);
                setShowScannerPermission(false);
                setShowScanner(true);
              }}
            >
              {t(uiLocale, "products.scannerPermission.allowAndScan")}
            </Button>
          </div>
        </div>
      </SlideUpSheet>

      <SlideUpSheet
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        title={t(uiLocale, "products.scanner.title")}
        description={t(uiLocale, "products.scanner.description")}
      >
        <BarcodeScannerPanel
          isOpen={showScanner}
          onResult={handleBarcodeResult}
          onClose={() => setShowScanner(false)}
          cameraSelectId="stock-history-barcode-scanner-camera-select"
        />
      </SlideUpSheet>
    </section>
  );
}
