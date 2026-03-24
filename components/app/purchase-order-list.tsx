"use client";

import {
  Banknote,
  CalendarDays,
  Clock,
  ChevronLeft,
  Download,
  Loader2,
  Package,
  Pencil,
  Plus,
  Share2,
  ShoppingCart,
  Truck,
  CheckCircle2,
  XCircle,
  FileText,
  X,
  ChevronRight,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { SlideUpSheet } from "@/components/ui/slide-up-sheet";
import {
  StockTabErrorState,
  StockTabLoadingState,
  StockTabToolbar,
} from "@/components/app/stock-tab-feedback";
import {
  PurchaseApSupplierPanel,
  type PurchaseApPanelPreset,
} from "@/components/app/purchase-ap-supplier-panel";
import { authFetch } from "@/lib/auth/client-token";
import type { StoreCurrency } from "@/lib/finance/store-financial";
import { currencySymbol, parseStoreCurrency } from "@/lib/finance/store-financial";
import type { UiLocale } from "@/lib/i18n/locales";
import { uiLocaleToDateLocale } from "@/lib/i18n/locales";
import { t } from "@/lib/i18n/messages";
import { useUiLocale } from "@/lib/i18n/use-ui-locale";
import {
  getLegacyPurchaseSavedPresetsStorageKey,
  getLegacyPurchaseWorkspaceStorageKey,
  getPurchaseSavedPresetsStorageKey,
  getPurchaseWorkspaceStorageKey,
} from "@/lib/purchases/client-storage";
import type { POPdfData } from "@/lib/pdf/generate-po-pdf";
import type { PoPdfConfig } from "@/lib/pdf/generate-po-pdf";
import { canNativeShare } from "@/lib/pdf/share-or-download";
import type { PurchaseOrderListItem } from "@/server/repositories/purchase.repo";

/* ── Status config ── */
function getPurchaseStatusLabel(
  uiLocale: UiLocale,
  status: PurchaseOrderListItem["status"],
): string {
  if (status === "DRAFT") return t(uiLocale, "purchase.status.DRAFT");
  if (status === "ORDERED") return t(uiLocale, "purchase.status.ORDERED");
  if (status === "SHIPPED") return t(uiLocale, "purchase.status.SHIPPED");
  if (status === "RECEIVED") return t(uiLocale, "purchase.status.RECEIVED");
  return t(uiLocale, "purchase.status.CANCELLED");
}

function getPurchaseStatusConfig(uiLocale: UiLocale): Record<
  PurchaseOrderListItem["status"],
  { label: string; icon: typeof Clock; badgeClass: string }
> {
  return {
    DRAFT: {
      label: getPurchaseStatusLabel(uiLocale, "DRAFT"),
      icon: FileText,
      badgeClass: "bg-slate-100 text-slate-600",
    },
    ORDERED: {
      label: getPurchaseStatusLabel(uiLocale, "ORDERED"),
      icon: ShoppingCart,
      badgeClass: "bg-amber-100 text-amber-700",
    },
    SHIPPED: {
      label: getPurchaseStatusLabel(uiLocale, "SHIPPED"),
      icon: Truck,
      badgeClass: "bg-blue-100 text-blue-700",
    },
    RECEIVED: {
      label: getPurchaseStatusLabel(uiLocale, "RECEIVED"),
      icon: CheckCircle2,
      badgeClass: "bg-emerald-100 text-emerald-700",
    },
    CANCELLED: {
      label: getPurchaseStatusLabel(uiLocale, "CANCELLED"),
      icon: XCircle,
      badgeClass: "bg-red-100 text-red-600",
    },
  };
}

type PurchaseOrderListProps = {
  purchaseOrders: PurchaseOrderListItem[];
  activeStoreId: string;
  userId: string;
  storeCurrency: StoreCurrency;
  canCreate: boolean;
  pageSize: number;
  initialHasMore: boolean;
  storeLogoUrl?: string | null;
  pdfConfig?: Partial<PoPdfConfig>;
};

type StatusFilter = "ALL" | "OPEN" | PurchaseOrderListItem["status"];
type PurchaseWorkspace = "OPERATIONS" | "MONTH_END" | "SUPPLIER_AP";
type KpiShortcut = "OPEN_PO" | "PENDING_RATE" | "OVERDUE_AP" | "OUTSTANDING_AP";
type SavedPurchasePreset = {
  id: string;
  label: string;
  shortcut: KpiShortcut;
  createdAt: string;
};
const PURCHASE_WORKSPACE_QUERY_KEY = "workspace";
const PURCHASE_STATUS_QUERY_KEY = "poStatus";
const PURCHASE_AP_DUE_QUERY_KEY = "due";
const PURCHASE_AP_PAYMENT_QUERY_KEY = "payment";
const PURCHASE_AP_SORT_QUERY_KEY = "sort";

type PurchaseApDueFilter = "ALL" | "OVERDUE" | "DUE_SOON" | "NOT_DUE" | "NO_DUE_DATE";
type PurchaseApPaymentFilter = "ALL" | "UNPAID" | "PARTIAL" | "PAID";
type PurchaseApSort = "DUE_ASC" | "OUTSTANDING_DESC";
const DEFAULT_PO_STATUS_FILTER: StatusFilter = "OPEN";

function isPurchaseWorkspace(value: string | null): value is PurchaseWorkspace {
  return value === "OPERATIONS" || value === "MONTH_END" || value === "SUPPLIER_AP";
}

function isPurchaseStatusFilter(value: string | null): value is StatusFilter {
  return (
    value === "ALL" ||
    value === "OPEN" ||
    value === "DRAFT" ||
    value === "ORDERED" ||
    value === "SHIPPED" ||
    value === "RECEIVED" ||
    value === "CANCELLED"
  );
}

function isPurchaseApDueFilter(value: string | null): value is PurchaseApDueFilter {
  return (
    value === "ALL" ||
    value === "OVERDUE" ||
    value === "DUE_SOON" ||
    value === "NOT_DUE" ||
    value === "NO_DUE_DATE"
  );
}

function isPurchaseApPaymentFilter(value: string | null): value is PurchaseApPaymentFilter {
  return value === "ALL" || value === "UNPAID" || value === "PARTIAL" || value === "PAID";
}

function isPurchaseApSort(value: string | null): value is PurchaseApSort {
  return value === "DUE_ASC" || value === "OUTSTANDING_DESC";
}

function kpiShortcutDefaultLabel(uiLocale: UiLocale, shortcut: KpiShortcut): string {
  if (shortcut === "OPEN_PO") return t(uiLocale, "purchase.kpiShortcut.OPEN_PO.label");
  if (shortcut === "PENDING_RATE") return t(uiLocale, "purchase.kpiShortcut.PENDING_RATE.label");
  if (shortcut === "OVERDUE_AP") return t(uiLocale, "purchase.kpiShortcut.OVERDUE_AP.label");
  return t(uiLocale, "purchase.kpiShortcut.OUTSTANDING_AP.label");
}

type PurchaseOrderDetail = {
  id: string;
  poNumber: string;
  supplierName: string | null;
  supplierContact: string | null;
  purchaseCurrency: string;
  exchangeRate: number;
  exchangeRateInitial: number;
  exchangeRateLockedAt: string | null;
  exchangeRateLockNote: string | null;
  paymentStatus: "UNPAID" | "PARTIAL" | "PAID";
  paidAt: string | null;
  paidByName: string | null;
  paymentReference: string | null;
  paymentNote: string | null;
  dueDate: string | null;
  shippingCost: number;
  otherCost: number;
  otherCostNote: string | null;
  status: string;
  orderedAt: string | null;
  shippedAt: string | null;
  receivedAt: string | null;
  expectedAt: string | null;
  trackingInfo: string | null;
  note: string | null;
  createdByName: string | null;
  createdAt: string;
  items: {
    id: string;
    productId: string;
    unitId: string;
    purchaseUnitCode: string;
    purchaseUnitNameTh: string;
    baseUnitCode: string;
    baseUnitNameTh: string;
    multiplierToBase: number;
    productName: string;
    productSku: string;
    qtyOrdered: number;
    qtyReceived: number;
    qtyBaseOrdered: number;
    qtyBaseReceived: number;
    unitCostPurchase: number;
    unitCostBase: number;
    landedCostPerUnit: number;
  }[];
  totalCostBase: number;
  totalPaidBase: number;
  outstandingBase: number;
  paymentEntries: {
    id: string;
    entryType: "PAYMENT" | "REVERSAL";
    amountBase: number;
    paidAt: string;
    reference: string | null;
    note: string | null;
    reversedPaymentId: string | null;
    createdByName: string | null;
  }[];
};

type PoDetailLoadResult = {
  purchaseOrder: PurchaseOrderDetail | null;
  error: string | null;
};

type PendingRateQueueItem = {
  id: string;
  poNumber: string;
  supplierName: string | null;
  purchaseCurrency: StoreCurrency;
  exchangeRateInitial: number;
  receivedAt: string | null;
  expectedAt: string | null;
  dueDate: string | null;
  paymentStatus: "UNPAID" | "PARTIAL" | "PAID";
  itemCount: number;
  totalCostBase: number;
  outstandingBase: number;
};

type PurchaseProductOption = {
  id: string;
  name: string;
  sku: string;
  baseUnitId: string;
  baseUnitCode: string;
  baseUnitNameTh: string;
  unitOptions: {
    unitId: string;
    unitCode: string;
    unitNameTh: string;
    multiplierToBase: number;
  }[];
};

type DraftPurchaseItem = {
  productId: string;
  productName: string;
  productSku: string;
  unitId: string;
  unitCode: string;
  unitNameTh: string;
  baseUnitCode: string;
  baseUnitNameTh: string;
  multiplierToBase: number;
  qtyOrdered: string;
  unitCostPurchase: string;
};

function fmtPrice(amount: number, currency: StoreCurrency, numberLocale?: string): string {
  return `${currencySymbol(currency)}${amount.toLocaleString(numberLocale)}`;
}

function CurrencyAmountStack({
  primaryAmount,
  primaryCurrency,
  secondaryAmount,
  secondaryCurrency,
  numberLocale,
  align = "right",
  primaryClassName = "font-medium",
}: {
  primaryAmount: number;
  primaryCurrency: StoreCurrency;
  secondaryAmount?: number | null;
  secondaryCurrency?: StoreCurrency | null;
  numberLocale?: string;
  align?: "left" | "right";
  primaryClassName?: string;
}) {
  const wrapperClassName =
    align === "left"
      ? "inline-flex flex-col items-start"
      : "inline-flex flex-col items-end text-right";
  const shouldShowSecondary =
    secondaryAmount != null &&
    secondaryCurrency != null &&
    secondaryCurrency !== primaryCurrency;

  return (
    <span className={wrapperClassName}>
      <span className={primaryClassName}>
        {fmtPrice(primaryAmount, primaryCurrency, numberLocale)}
      </span>
      {shouldShowSecondary ? (
        <span className="text-[11px] font-normal text-slate-500">
          ≈ {fmtPrice(secondaryAmount, secondaryCurrency, numberLocale)}
        </span>
      ) : null}
    </span>
  );
}

function getPurchaseUnitLabel(unitCode: string, unitNameTh: string): string {
  return unitCode.trim() || unitNameTh.trim();
}

function daysUntil(dateStr: string): number {
  const targetDate = new Date(dateStr);
  const now = new Date();
  return Math.ceil(
    (targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
}

function formatDate(dateStr: string, dateLocale?: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(dateLocale, {
    day: "numeric",
    month: "short",
    year: undefined,
  });
}

function sortableDateValue(dateStr: string | null): number {
  if (!dateStr) return Number.POSITIVE_INFINITY;
  const parsed = new Date(dateStr).getTime();
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
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

function getCalendarWeekdayLabels(uiLocale: UiLocale) {
  return [
    t(uiLocale, "purchase.calendar.weekday.SUN"),
    t(uiLocale, "purchase.calendar.weekday.MON"),
    t(uiLocale, "purchase.calendar.weekday.TUE"),
    t(uiLocale, "purchase.calendar.weekday.WED"),
    t(uiLocale, "purchase.calendar.weekday.THU"),
    t(uiLocale, "purchase.calendar.weekday.FRI"),
    t(uiLocale, "purchase.calendar.weekday.SAT"),
  ] as const;
}

type PurchaseDatePickerFieldProps = {
  uiLocale: UiLocale;
  value: string;
  onChange: (nextValue: string) => void;
  triggerClassName: string;
  placeholder?: string;
  ariaLabel: string;
  disabled?: boolean;
};

function PurchaseDatePickerField({
  uiLocale,
  value,
  onChange,
  triggerClassName,
  placeholder,
  ariaLabel,
  disabled = false,
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
  const dateLocale = uiLocaleToDateLocale(uiLocale);
  const weekdayLabels = getCalendarWeekdayLabels(uiLocale);
  const placeholderText = placeholder ?? t(uiLocale, "common.datePicker.placeholder");
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
          {selectedIso ? formatIsoDateDisplay(selectedIso) : placeholderText}
        </span>
        <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" />
      </button>

      {isOpen ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.4rem)] z-[130] rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
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

function sortPendingQueueForSettlement(
  items: PendingRateQueueItem[],
): PendingRateQueueItem[] {
  return [...items].sort((a, b) => {
    const dueDiff = sortableDateValue(a.dueDate) - sortableDateValue(b.dueDate);
    if (dueDiff !== 0) return dueDiff;
    const receivedDiff =
      sortableDateValue(a.receivedAt) - sortableDateValue(b.receivedAt);
    if (receivedDiff !== 0) return receivedDiff;
    return a.poNumber.localeCompare(b.poNumber);
  });
}

export function PurchaseOrderList({
  purchaseOrders: initialList,
  activeStoreId,
  userId,
  storeCurrency,
  canCreate,
  pageSize,
  initialHasMore,
  storeLogoUrl,
  pdfConfig,
}: PurchaseOrderListProps) {
  const uiLocale = useUiLocale();
  const dateLocale = uiLocaleToDateLocale(uiLocale);
  const numberLocale = dateLocale;
  const statusConfig = useMemo(() => getPurchaseStatusConfig(uiLocale), [uiLocale]);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isPurchaseTabActive = searchParams.get("tab") === "purchase";
  const workspaceFromQuery = useMemo(() => {
    const raw = searchParams.get(PURCHASE_WORKSPACE_QUERY_KEY);
    return isPurchaseWorkspace(raw) ? raw : null;
  }, [searchParams]);
  const statusFromQuery = useMemo(() => {
    const raw = searchParams.get(PURCHASE_STATUS_QUERY_KEY);
    return isPurchaseStatusFilter(raw) ? raw : null;
  }, [searchParams]);
  const apDueFromQuery = useMemo(() => {
    const raw = searchParams.get(PURCHASE_AP_DUE_QUERY_KEY);
    return isPurchaseApDueFilter(raw) ? raw : null;
  }, [searchParams]);
  const apPaymentFromQuery = useMemo(() => {
    const raw = searchParams.get(PURCHASE_AP_PAYMENT_QUERY_KEY);
    return isPurchaseApPaymentFilter(raw) ? raw : null;
  }, [searchParams]);
  const apSortFromQuery = useMemo(() => {
    const raw = searchParams.get(PURCHASE_AP_SORT_QUERY_KEY);
    return isPurchaseApSort(raw) ? raw : null;
  }, [searchParams]);
  const workspaceStorageKey = useMemo(
    () => getPurchaseWorkspaceStorageKey({ storeId: activeStoreId, userId }),
    [activeStoreId, userId],
  );
  const savedPresetsStorageKey = useMemo(
    () => getPurchaseSavedPresetsStorageKey({ storeId: activeStoreId, userId }),
    [activeStoreId, userId],
  );
  const [poList, setPoList] = useState(initialList);
  const [poPage, setPoPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshingList, setIsRefreshingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(
    initialList.length > 0 ? new Date().toISOString() : null,
  );
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    statusFromQuery ?? DEFAULT_PO_STATUS_FILTER,
  );
  const [workspaceTab, setWorkspaceTab] = useState<PurchaseWorkspace>("OPERATIONS");
  const [activeKpiShortcut, setActiveKpiShortcut] = useState<KpiShortcut | null>(null);
  const [apPanelPreset, setApPanelPreset] = useState<PurchaseApPanelPreset | null>(null);
  const [savedPresets, setSavedPresets] = useState<SavedPurchasePreset[]>([]);
  const [pendingRateQueue, setPendingRateQueue] = useState<PendingRateQueueItem[]>([]);
  const [isLoadingPendingQueue, setIsLoadingPendingQueue] = useState(false);
  const [pendingQueueError, setPendingQueueError] = useState<string | null>(null);
  const [pendingSupplierFilter, setPendingSupplierFilter] = useState("");
  const [pendingReceivedFrom, setPendingReceivedFrom] = useState("");
  const [pendingReceivedTo, setPendingReceivedTo] = useState("");
  const [selectedPendingQueueIds, setSelectedPendingQueueIds] = useState<string[]>([]);
  const [isBulkMonthEndMode, setIsBulkMonthEndMode] = useState(false);
  const [bulkRateInput, setBulkRateInput] = useState("");
  const [bulkPaidAtInput, setBulkPaidAtInput] = useState("");
  const [bulkStatementTotalInput, setBulkStatementTotalInput] = useState("");
  const [bulkReferenceInput, setBulkReferenceInput] = useState("");
  const [bulkNoteInput, setBulkNoteInput] = useState("");
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);
  const [bulkProgressText, setBulkProgressText] = useState<string | null>(null);
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);
  const pendingScrollRestoreRef = useRef<{ x: number; y: number } | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreateCloseConfirmOpen, setIsCreateCloseConfirmOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<string | null>(null);
  const poDetailCacheRef = useRef<Map<string, PurchaseOrderDetail>>(new Map());
  const poDetailPendingRef = useRef<Map<string, Promise<PoDetailLoadResult>>>(
    new Map(),
  );

  /* ── Create wizard state ── */
  const [wizardStep, setWizardStep] = useState(1);

  /* ── Create form ── */
  const [supplierName, setSupplierName] = useState("");
  const [supplierContact, setSupplierContact] = useState("");
  const [purchaseCurrency, setPurchaseCurrency] =
    useState<StoreCurrency>(storeCurrency);
  const [exchangeRate, setExchangeRate] = useState("");
  const [items, setItems] = useState<DraftPurchaseItem[]>([]);
  const [shippingCost, setShippingCost] = useState("");
  const [otherCost, setOtherCost] = useState("");
  const [otherCostNote, setOtherCostNote] = useState("");
  const [note, setNote] = useState("");
  const [expectedAt, setExpectedAt] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* ── Product search for item picker ── */
  const [productSearch, setProductSearch] = useState("");
  const [isProductPickerOpen, setIsProductPickerOpen] = useState(false);
  const [productOptions, setProductOptions] = useState<PurchaseProductOption[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [isSupplierPickerOpen, setIsSupplierPickerOpen] = useState(false);

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

  const applyCreateDateShortcut = useCallback(
    (
      field: "expectedAt" | "dueDate",
      shortcut: "TODAY" | "PLUS_7" | "END_OF_MONTH" | "CLEAR",
    ) => {
      const value = getDateShortcutValue(shortcut);
      if (field === "expectedAt") {
        setExpectedAt(value);
        return;
      }
      setDueDate(value);
    },
    [getDateShortcutValue],
  );

  const applyPendingQueueDateShortcut = useCallback(
    (
      field: "receivedFrom" | "receivedTo",
      shortcut: "TODAY" | "PLUS_7" | "END_OF_MONTH" | "CLEAR",
    ) => {
      const value = getDateShortcutValue(shortcut);
      if (field === "receivedFrom") {
        setPendingReceivedFrom(value);
        return;
      }
      setPendingReceivedTo(value);
    },
    [getDateShortcutValue],
  );

  const hasCreateDraftChanges = useMemo(() => {
    const hasSupplierDraft =
      supplierName.trim().length > 0 || supplierContact.trim().length > 0;
    const hasCurrencyDraft = purchaseCurrency !== storeCurrency;
    const hasExchangeRateDraft = exchangeRate.trim().length > 0;
    const hasItemDraft = items.length > 0;
    const hasCostDraft =
      (Number(shippingCost) || 0) > 0 ||
      (Number(otherCost) || 0) > 0 ||
      otherCostNote.trim().length > 0;
    const hasMetaDraft =
      note.trim().length > 0 || expectedAt.trim().length > 0 || dueDate.trim().length > 0;
    const hasWizardProgress = wizardStep !== 1;

    return (
      hasSupplierDraft ||
      hasCurrencyDraft ||
      hasExchangeRateDraft ||
      hasItemDraft ||
      hasCostDraft ||
      hasMetaDraft ||
      hasWizardProgress
    );
  }, [
    dueDate,
    exchangeRate,
    items.length,
    note,
    otherCost,
    otherCostNote,
    purchaseCurrency,
    shippingCost,
    storeCurrency,
    supplierContact,
    supplierName,
    wizardStep,
    expectedAt,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      const raw = window.localStorage.getItem(savedPresetsStorageKey);
      const legacyKey = getLegacyPurchaseSavedPresetsStorageKey();
      const legacyRaw = window.localStorage.getItem(legacyKey);
      const payload = raw ?? legacyRaw;
      if (!payload) {
        setSavedPresets([]);
        return;
      }
      const parsed = JSON.parse(payload) as SavedPurchasePreset[];
      if (!Array.isArray(parsed)) {
        setSavedPresets([]);
        return;
      }
      const sanitized = parsed.filter(
        (item) =>
          Boolean(item?.id) &&
          Boolean(item?.label) &&
          typeof item?.createdAt === "string" &&
          (item?.shortcut === "OPEN_PO" ||
            item?.shortcut === "PENDING_RATE" ||
            item?.shortcut === "OVERDUE_AP" ||
            item?.shortcut === "OUTSTANDING_AP"),
      );
      const nextPresets = sanitized.slice(0, 6);
      setSavedPresets(nextPresets);
      if (!raw) {
        window.localStorage.setItem(savedPresetsStorageKey, JSON.stringify(nextPresets));
        window.localStorage.removeItem(legacyKey);
      }
    } catch {
      // Ignore invalid localStorage payload.
      setSavedPresets([]);
    }
  }, [savedPresetsStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(
      savedPresetsStorageKey,
      JSON.stringify(savedPresets),
    );
  }, [savedPresets, savedPresetsStorageKey]);

  const replacePurchaseQuery = useCallback(
    (apply: (params: URLSearchParams) => void) => {
      const latestQuery =
        typeof window !== "undefined"
          ? window.location.search.replace(/^\?/, "")
          : searchParams.toString();
      const params = new URLSearchParams(latestQuery);
      apply(params);
      const nextQuery = params.toString();
      const currentQuery = latestQuery;
      if (nextQuery === currentQuery) {
        return;
      }
      if (typeof window !== "undefined") {
        pendingScrollRestoreRef.current = {
          x: window.scrollX,
          y: window.scrollY,
        };
      }
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    if (!isPurchaseTabActive || typeof window === "undefined") {
      pendingScrollRestoreRef.current = null;
      return;
    }

    const pending = pendingScrollRestoreRef.current;
    if (!pending) {
      return;
    }
    const restore = () => {
      window.scrollTo(pending.x, pending.y);
    };
    const rafId = window.requestAnimationFrame(() => {
      restore();
      window.setTimeout(restore, 0);
    });
    pendingScrollRestoreRef.current = null;
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [isPurchaseTabActive, searchParams]);

  const replaceWorkspaceQuery = useCallback(
    (nextWorkspace: PurchaseWorkspace) => {
      replacePurchaseQuery((params) => {
        params.set(PURCHASE_WORKSPACE_QUERY_KEY, nextWorkspace);
      });
    },
    [replacePurchaseQuery],
  );

  const handleWorkspaceChange = useCallback(
    (
      nextWorkspace: PurchaseWorkspace,
      options?: {
        preserveShortcut?: boolean;
      },
    ) => {
      if (nextWorkspace === workspaceTab) {
        return;
      }
      setWorkspaceTab(nextWorkspace);
      if (!options?.preserveShortcut) {
        setActiveKpiShortcut(null);
        setApPanelPreset(null);
      }
      if (typeof window !== "undefined") {
        window.localStorage.setItem(workspaceStorageKey, nextWorkspace);
      }
      replaceWorkspaceQuery(nextWorkspace);
    },
    [replaceWorkspaceQuery, workspaceStorageKey, workspaceTab],
  );

  useEffect(() => {
    if (!isPurchaseTabActive) {
      return;
    }

    if (workspaceFromQuery) {
      setWorkspaceTab(workspaceFromQuery);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(workspaceStorageKey, workspaceFromQuery);
      }
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const legacyKey = getLegacyPurchaseWorkspaceStorageKey();
    const scopedWorkspace = window.localStorage.getItem(workspaceStorageKey);
    const legacyWorkspace = window.localStorage.getItem(legacyKey);
    const savedWorkspace = scopedWorkspace ?? legacyWorkspace;
    if (!isPurchaseWorkspace(savedWorkspace)) {
      setWorkspaceTab("OPERATIONS");
      return;
    }
    setWorkspaceTab(savedWorkspace);
    if (!scopedWorkspace) {
      window.localStorage.setItem(workspaceStorageKey, savedWorkspace);
      window.localStorage.removeItem(legacyKey);
    }
    replaceWorkspaceQuery(savedWorkspace);
  }, [isPurchaseTabActive, replaceWorkspaceQuery, workspaceFromQuery, workspaceStorageKey]);

  useEffect(() => {
    if (!isPurchaseTabActive) {
      return;
    }
    setStatusFilter(statusFromQuery ?? DEFAULT_PO_STATUS_FILTER);
  }, [isPurchaseTabActive, statusFromQuery]);

  useEffect(() => {
    if (!isPurchaseTabActive) {
      return;
    }
    replacePurchaseQuery((params) => {
      if (statusFilter === DEFAULT_PO_STATUS_FILTER) {
        params.delete(PURCHASE_STATUS_QUERY_KEY);
      } else {
        params.set(PURCHASE_STATUS_QUERY_KEY, statusFilter);
      }
    });
  }, [isPurchaseTabActive, replacePurchaseQuery, statusFilter]);

  const handleApFiltersChange = useCallback(
    (filters: {
      dueFilter: PurchaseApDueFilter;
      paymentFilter: PurchaseApPaymentFilter;
      statementSort: PurchaseApSort;
    }) => {
      replacePurchaseQuery((params) => {
        params.set(PURCHASE_WORKSPACE_QUERY_KEY, "SUPPLIER_AP");
        if (filters.dueFilter === "ALL") {
          params.delete(PURCHASE_AP_DUE_QUERY_KEY);
        } else {
          params.set(PURCHASE_AP_DUE_QUERY_KEY, filters.dueFilter);
        }
        if (filters.paymentFilter === "ALL") {
          params.delete(PURCHASE_AP_PAYMENT_QUERY_KEY);
        } else {
          params.set(PURCHASE_AP_PAYMENT_QUERY_KEY, filters.paymentFilter);
        }
        if (filters.statementSort === "DUE_ASC") {
          params.delete(PURCHASE_AP_SORT_QUERY_KEY);
        } else {
          params.set(PURCHASE_AP_SORT_QUERY_KEY, filters.statementSort);
        }
      });
    },
    [replacePurchaseQuery],
  );

  const apQueryPreset = useMemo<PurchaseApPanelPreset | null>(() => {
    const hasAnyQueryFilter = Boolean(
      apDueFromQuery || apPaymentFromQuery || apSortFromQuery,
    );
    if (!hasAnyQueryFilter) {
      return null;
    }
    return {
      key: `query-${apDueFromQuery ?? "ALL"}-${apPaymentFromQuery ?? "ALL"}-${apSortFromQuery ?? "DUE_ASC"}`,
      dueFilter: apDueFromQuery ?? "ALL",
      paymentFilter: apPaymentFromQuery ?? "ALL",
      statementSort: apSortFromQuery ?? "DUE_ASC",
    };
  }, [apDueFromQuery, apPaymentFromQuery, apSortFromQuery]);

  const applyKpiShortcut = useCallback(
    (shortcut: KpiShortcut) => {
      const presetKey = `${shortcut}-${Date.now()}`;
      if (shortcut === "OPEN_PO") {
        setStatusFilter("OPEN");
        setActiveKpiShortcut(shortcut);
        setApPanelPreset(null);
        replacePurchaseQuery((params) => {
          params.delete(PURCHASE_AP_DUE_QUERY_KEY);
          params.delete(PURCHASE_AP_PAYMENT_QUERY_KEY);
          params.delete(PURCHASE_AP_SORT_QUERY_KEY);
        });
        handleWorkspaceChange("OPERATIONS", { preserveShortcut: true });
        return;
      }
      if (shortcut === "PENDING_RATE") {
        setStatusFilter(DEFAULT_PO_STATUS_FILTER);
        setActiveKpiShortcut(shortcut);
        setApPanelPreset(null);
        replacePurchaseQuery((params) => {
          params.delete(PURCHASE_AP_DUE_QUERY_KEY);
          params.delete(PURCHASE_AP_PAYMENT_QUERY_KEY);
          params.delete(PURCHASE_AP_SORT_QUERY_KEY);
        });
        handleWorkspaceChange("MONTH_END", { preserveShortcut: true });
        return;
      }
      if (shortcut === "OVERDUE_AP") {
        setStatusFilter(DEFAULT_PO_STATUS_FILTER);
        setActiveKpiShortcut(shortcut);
        setApPanelPreset({
          key: presetKey,
          dueFilter: "OVERDUE",
          statementSort: "DUE_ASC",
          resetDateRange: true,
          resetPoQuery: true,
        });
        handleWorkspaceChange("SUPPLIER_AP", { preserveShortcut: true });
        return;
      }
      setStatusFilter(DEFAULT_PO_STATUS_FILTER);
      setActiveKpiShortcut(shortcut);
      setApPanelPreset({
        key: presetKey,
        dueFilter: "ALL",
        statementSort: "OUTSTANDING_DESC",
        resetDateRange: true,
        resetPoQuery: true,
      });
      handleWorkspaceChange("SUPPLIER_AP", { preserveShortcut: true });
    },
    [handleWorkspaceChange, replacePurchaseQuery],
  );

  const clearKpiShortcut = useCallback(() => {
    setActiveKpiShortcut(null);
    setApPanelPreset(null);
    setStatusFilter(DEFAULT_PO_STATUS_FILTER);
    replacePurchaseQuery((params) => {
      params.delete(PURCHASE_AP_DUE_QUERY_KEY);
      params.delete(PURCHASE_AP_PAYMENT_QUERY_KEY);
      params.delete(PURCHASE_AP_SORT_QUERY_KEY);
    });
  }, [replacePurchaseQuery]);

  const saveCurrentShortcutPreset = useCallback(() => {
    if (!activeKpiShortcut || typeof window === "undefined") {
      return;
    }
    const defaultLabel = kpiShortcutDefaultLabel(uiLocale, activeKpiShortcut);
    const input = window.prompt(t(uiLocale, "purchase.preset.promptName"), defaultLabel);
    if (input === null) {
      return;
    }
    const label = input.trim() || defaultLabel;
    setSavedPresets((current) => {
      const next = [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          label,
          shortcut: activeKpiShortcut,
          createdAt: new Date().toISOString(),
        },
        ...current,
      ];
      return next.slice(0, 6);
    });
    toast.success(t(uiLocale, "purchase.preset.saved"));
  }, [activeKpiShortcut, uiLocale]);

  const removeSavedPreset = useCallback((presetId: string) => {
    setSavedPresets((current) => current.filter((item) => item.id !== presetId));
  }, []);

  /* ── Filtered list ── */
  const filteredList = useMemo(() => {
    if (statusFilter === "ALL") return poList;
    if (statusFilter === "OPEN") {
      return poList.filter((po) => po.status !== "RECEIVED" && po.status !== "CANCELLED");
    }
    return poList.filter((po) => po.status === statusFilter);
  }, [poList, statusFilter]);
  const selectedPendingQueueSet = useMemo(
    () => new Set(selectedPendingQueueIds),
    [selectedPendingQueueIds],
  );
  const selectedPendingQueueItems = useMemo(() => {
    if (selectedPendingQueueIds.length === 0) return [] as PendingRateQueueItem[];
    const itemMap = new Map(pendingRateQueue.map((item) => [item.id, item]));
    return selectedPendingQueueIds
      .map((id) => itemMap.get(id))
      .filter((item): item is PendingRateQueueItem => Boolean(item));
  }, [pendingRateQueue, selectedPendingQueueIds]);
  const selectedPendingCurrencies = useMemo(
    () => Array.from(new Set(selectedPendingQueueItems.map((item) => item.purchaseCurrency))),
    [selectedPendingQueueItems],
  );
  const hasMixedPendingCurrencies = selectedPendingCurrencies.length > 1;
  const selectedPendingCurrency = selectedPendingCurrencies[0] ?? null;
  const sortedSelectedPendingQueueItems = useMemo(
    () => sortPendingQueueForSettlement(selectedPendingQueueItems),
    [selectedPendingQueueItems],
  );
  const bulkAllocationPreview = useMemo(() => {
    const hasStatementTotal = bulkStatementTotalInput.trim().length > 0;
    const parsedStatementTotal = Math.round(Number(bulkStatementTotalInput));
    const statementTotal =
      hasStatementTotal &&
      Number.isFinite(parsedStatementTotal) &&
      parsedStatementTotal > 0
        ? parsedStatementTotal
        : null;
    const invalidStatementTotal =
      hasStatementTotal &&
      (!Number.isFinite(parsedStatementTotal) || parsedStatementTotal <= 0);
    const totalOutstanding = sortedSelectedPendingQueueItems.reduce(
      (sum, item) => sum + Math.max(0, Math.round(item.outstandingBase)),
      0,
    );
    let remainingBudget = statementTotal ?? Number.POSITIVE_INFINITY;
    const rows = sortedSelectedPendingQueueItems.map((item) => {
      const outstanding = Math.max(0, Math.round(item.outstandingBase));
      const planned = Math.max(0, Math.min(outstanding, remainingBudget));
      if (Number.isFinite(remainingBudget)) {
        remainingBudget = Math.max(0, remainingBudget - planned);
      }
      return {
        id: item.id,
        poNumber: item.poNumber,
        dueDate: item.dueDate,
        supplierName: item.supplierName,
        outstanding,
        planned,
      };
    });
    const plannedTotal = rows.reduce((sum, row) => sum + row.planned, 0);
    return {
      hasStatementTotal,
      statementTotal,
      invalidStatementTotal,
      totalOutstanding,
      plannedTotal,
      remainingUnallocated:
        statementTotal === null ? 0 : Math.max(0, statementTotal - plannedTotal),
      outstandingAfter: Math.max(0, totalOutstanding - plannedTotal),
      rows,
    };
  }, [bulkStatementTotalInput, sortedSelectedPendingQueueItems]);

  const loadPoDetail = useCallback(
    async (
      poId: string,
      options?: {
        preferCache?: boolean;
      },
    ): Promise<PoDetailLoadResult> => {
      const preferCache = options?.preferCache ?? true;
      if (preferCache) {
        const cached = poDetailCacheRef.current.get(poId);
        if (cached) {
          return { purchaseOrder: cached, error: null };
        }
      }

      const existingRequest = poDetailPendingRef.current.get(poId);
      if (existingRequest) {
        return existingRequest;
      }

      const request = (async (): Promise<PoDetailLoadResult> => {
        try {
          const res = await authFetch(
            `/api/stock/purchase-orders/${encodeURIComponent(poId)}`,
          );
          const data = (await res.json().catch(() => null)) as
            | {
                ok?: boolean;
                message?: string;
                purchaseOrder?: unknown;
              }
            | null;

          if (!res.ok) {
            return {
              purchaseOrder: null,
              error: data?.message ?? t(uiLocale, "purchase.detail.error.loadFailed"),
            };
          }

          if (!data?.ok || !data.purchaseOrder) {
            return { purchaseOrder: null, error: t(uiLocale, "purchase.detail.error.notFound") };
          }

          const purchaseOrder = data.purchaseOrder as PurchaseOrderDetail;
          poDetailCacheRef.current.set(poId, purchaseOrder);
          return { purchaseOrder, error: null };
        } catch {
          return {
            purchaseOrder: null,
            error: t(uiLocale, "purchase.error.serverUnreachableRetry"),
          };
        } finally {
          poDetailPendingRef.current.delete(poId);
        }
      })();

      poDetailPendingRef.current.set(poId, request);
      return request;
    },
    [uiLocale],
  );

  const getCachedPoDetail = useCallback((poId: string) => {
    return poDetailCacheRef.current.get(poId) ?? null;
  }, []);

  const upsertPoDetailCache = useCallback((purchaseOrder: PurchaseOrderDetail) => {
    poDetailCacheRef.current.set(purchaseOrder.id, purchaseOrder);
  }, []);

  const invalidatePoDetailCache = useCallback((poId: string) => {
    poDetailCacheRef.current.delete(poId);
    poDetailPendingRef.current.delete(poId);
  }, []);

  const loadPurchaseOrders = useCallback(
    async (page: number, replace = false) => {
      try {
        const res = await authFetch(
          `/api/stock/purchase-orders?page=${page}&pageSize=${pageSize}`,
        );
        const data = (await res.json().catch(() => null)) as
          | {
              purchaseOrders?: PurchaseOrderListItem[];
              hasMore?: boolean;
              message?: string;
            }
          | null;

        if (!res.ok) {
          setListError(data?.message ?? t(uiLocale, "purchase.list.error.loadFailed"));
          return false;
        }

        if (!Array.isArray(data?.purchaseOrders)) {
          setListError(t(uiLocale, "purchase.list.error.invalidResponse"));
          return false;
        }

        const purchaseOrders = data.purchaseOrders;
        setPoList((prev) => (replace ? purchaseOrders : [...prev, ...purchaseOrders]));
        setPoPage(page);
        setHasMore(Boolean(data.hasMore));
        setListError(null);
        setLastUpdatedAt(new Date().toISOString());
        return true;
      } catch {
        setListError(t(uiLocale, "purchase.error.serverUnreachableRetry"));
        return false;
      }
    },
    [pageSize, uiLocale],
  );

  const loadPendingQueue = useCallback(async () => {
    setIsLoadingPendingQueue(true);
    try {
      const params = new URLSearchParams();
      if (pendingSupplierFilter.trim()) {
        params.set("supplier", pendingSupplierFilter.trim());
      }
      if (pendingReceivedFrom) {
        params.set("receivedFrom", pendingReceivedFrom);
      }
      if (pendingReceivedTo) {
        params.set("receivedTo", pendingReceivedTo);
      }
      params.set("limit", "50");

      const query = params.toString();
      const res = await authFetch(
        `/api/stock/purchase-orders/pending-rate${query ? `?${query}` : ""}`,
      );
      const data = (await res.json().catch(() => null)) as
        | {
            ok?: boolean;
            message?: string;
            queue?: PendingRateQueueItem[];
          }
        | null;

      if (!res.ok || !data?.ok) {
        setPendingQueueError(data?.message ?? t(uiLocale, "purchase.monthEnd.error.loadQueueFailed"));
        return;
      }

      setPendingRateQueue(Array.isArray(data.queue) ? data.queue : []);
      setPendingQueueError(null);
    } catch {
      setPendingQueueError(t(uiLocale, "purchase.error.serverUnreachableRetry"));
    } finally {
      setIsLoadingPendingQueue(false);
    }
  }, [pendingReceivedFrom, pendingReceivedTo, pendingSupplierFilter, uiLocale]);

  const reloadFirstPage = useCallback(async () => {
    setIsRefreshingList(true);
    try {
      await loadPurchaseOrders(1, true);
      await loadPendingQueue();
    } finally {
      setIsRefreshingList(false);
    }
  }, [loadPendingQueue, loadPurchaseOrders]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      await loadPurchaseOrders(poPage + 1, false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMore, isLoadingMore, loadPurchaseOrders, poPage]);

  useEffect(() => {
    if (!isPurchaseTabActive) return;

    const target = loadMoreRef.current;
    if (!target || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, isPurchaseTabActive, loadMore]);

  useEffect(() => {
    if (!isPurchaseTabActive) {
      return;
    }
    void loadPendingQueue();
  }, [isPurchaseTabActive, loadPendingQueue]);

  useEffect(() => {
    setSelectedPendingQueueIds((prev) =>
      prev.filter((id) => pendingRateQueue.some((item) => item.id === id)),
    );
  }, [pendingRateQueue]);

  const togglePendingQueueSelection = useCallback((poId: string) => {
    setSelectedPendingQueueIds((prev) => {
      if (prev.includes(poId)) {
        return prev.filter((id) => id !== poId);
      }
      return [...prev, poId];
    });
  }, []);

  const selectAllPendingQueue = useCallback(() => {
    setSelectedPendingQueueIds(pendingRateQueue.map((item) => item.id));
  }, [pendingRateQueue]);

  const clearPendingQueueSelection = useCallback(() => {
    setSelectedPendingQueueIds([]);
  }, []);

  const openBulkMonthEndMode = useCallback(() => {
    if (selectedPendingQueueItems.length === 0) {
      toast.error(t(uiLocale, "purchase.monthEnd.bulk.validation.selectAtLeastOne"));
      return;
    }
    if (hasMixedPendingCurrencies) {
      toast.error(t(uiLocale, "purchase.monthEnd.mixedCurrencies"));
      return;
    }
    setBulkRateInput("");
    setBulkStatementTotalInput("");
    setBulkReferenceInput("");
    setBulkNoteInput("");
    setBulkErrors([]);
    setBulkProgressText(null);
    setBulkPaidAtInput(new Date().toISOString().slice(0, 10));
    setIsBulkMonthEndMode(true);
  }, [hasMixedPendingCurrencies, selectedPendingQueueItems.length, uiLocale]);

  const submitBulkMonthEnd = useCallback(async () => {
    if (sortedSelectedPendingQueueItems.length === 0) {
      toast.error(t(uiLocale, "purchase.monthEnd.bulk.validation.selectToFinalize"));
      return;
    }
    if (hasMixedPendingCurrencies) {
      toast.error(t(uiLocale, "purchase.monthEnd.mixedCurrencies"));
      return;
    }

    const exchangeRate = Math.round(Number(bulkRateInput));
    if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
      toast.error(t(uiLocale, "purchase.monthEnd.bulk.validation.exchangeRateInvalid"));
      return;
    }

    const paymentReference = bulkReferenceInput.trim();
    if (!paymentReference) {
      toast.error(t(uiLocale, "purchase.monthEnd.bulk.validation.referenceRequired"));
      return;
    }

    const paymentNote = bulkNoteInput.trim();
    const paidAt = bulkPaidAtInput.trim();
    const hasStatementTotal = bulkStatementTotalInput.trim().length > 0;
    const parsedStatementTotal = Math.round(Number(bulkStatementTotalInput));
    if (
      hasStatementTotal &&
      (!Number.isFinite(parsedStatementTotal) || parsedStatementTotal <= 0)
    ) {
      toast.error(t(uiLocale, "purchase.monthEnd.bulk.validation.statementTotalInvalid"));
      return;
    }

    setIsBulkSubmitting(true);
    setBulkErrors([]);
    setBulkProgressText(t(uiLocale, "purchase.monthEnd.bulk.progress.start"));

    const errors: string[] = [];
    let settledCount = 0;
    let finalizedCount = 0;
    let settledAmountTotal = 0;
    let remainingStatementBudget = hasStatementTotal
      ? Math.max(0, parsedStatementTotal)
      : null;

    try {
      for (let i = 0; i < sortedSelectedPendingQueueItems.length; i += 1) {
        const item = sortedSelectedPendingQueueItems[i]!;
        setBulkProgressText(
          `${t(uiLocale, "purchase.monthEnd.bulk.progress.processing.prefix")} ${i + 1}/${sortedSelectedPendingQueueItems.length} (${item.poNumber})`,
        );

        const finalizeRes = await authFetch(
          `/api/stock/purchase-orders/${item.id}/finalize-rate`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": `po-bulk-rate-${item.id}-${Date.now()}-${i}`,
            },
            body: JSON.stringify({
              exchangeRate,
              note:
                paymentNote ||
                `${t(uiLocale, "purchase.monthEnd.bulk.noteTemplate.prefix")} ${paymentReference}`,
            }),
          },
        );
        const finalizeData = (await finalizeRes.json().catch(() => null)) as
          | { message?: string; purchaseOrder?: PurchaseOrderDetail }
          | null;
        if (!finalizeRes.ok) {
          errors.push(
            `${item.poNumber}: ${t(uiLocale, "purchase.monthEnd.bulk.error.finalizeFailed.prefix")} (${finalizeData?.message ?? t(uiLocale, "common.unknown")})`,
          );
          continue;
        }
        finalizedCount += 1;

        const detailResult = await loadPoDetail(item.id, { preferCache: false });
        if (!detailResult.purchaseOrder) {
          errors.push(
            `${item.poNumber}: ${t(uiLocale, "purchase.monthEnd.bulk.error.loadOutstandingFailed.prefix")} (${detailResult.error ?? t(uiLocale, "common.unknown")})`,
          );
          continue;
        }
        const outstandingAmount = Math.round(detailResult.purchaseOrder.outstandingBase);
        if (outstandingAmount <= 0) {
          settledCount += 1;
          continue;
        }
        const settleAmount =
          remainingStatementBudget === null
            ? outstandingAmount
            : Math.min(outstandingAmount, remainingStatementBudget);
        if (!Number.isFinite(settleAmount) || settleAmount <= 0) {
          continue;
        }

        const settleRes = await authFetch(
          `/api/stock/purchase-orders/${item.id}/settle`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": `po-bulk-settle-${item.id}-${Date.now()}-${i}`,
            },
            body: JSON.stringify({
              amountBase: settleAmount,
              paidAt: paidAt || undefined,
              paymentReference,
              paymentNote: paymentNote || undefined,
            }),
          },
        );
        const settleData = (await settleRes.json().catch(() => null)) as
          | { message?: string; purchaseOrder?: PurchaseOrderDetail }
          | null;
        if (!settleRes.ok) {
          errors.push(
            `${item.poNumber}: ${t(uiLocale, "purchase.monthEnd.bulk.error.settleFailed.prefix")} (${settleData?.message ?? t(uiLocale, "common.unknown")})`,
          );
          continue;
        }
        if (settleData?.purchaseOrder) {
          poDetailCacheRef.current.set(item.id, settleData.purchaseOrder);
        }
        if (remainingStatementBudget !== null) {
          remainingStatementBudget = Math.max(0, remainingStatementBudget - settleAmount);
        }
        settledAmountTotal += settleAmount;
        settledCount += 1;
      }

      if (finalizedCount > 0) {
        toast.success(
          `${t(uiLocale, "purchase.monthEnd.bulk.toast.finalized.prefix")} ${finalizedCount}/${sortedSelectedPendingQueueItems.length} ${t(uiLocale, "purchase.items")}`,
        );
      }
      if (settledCount > 0) {
        toast.success(
          `${t(uiLocale, "purchase.monthEnd.bulk.toast.settled.prefix")} ${settledCount}/${sortedSelectedPendingQueueItems.length} ${t(uiLocale, "purchase.items")} (${t(uiLocale, "purchase.monthEnd.bulk.toast.total.prefix")} ${fmtPrice(settledAmountTotal, storeCurrency, numberLocale)})`,
        );
      }
      if ((remainingStatementBudget ?? 0) > 0) {
        toast(
          `${t(uiLocale, "purchase.monthEnd.bulk.toast.remainingStatement.prefix")} ${fmtPrice(remainingStatementBudget ?? 0, storeCurrency, numberLocale)}`,
        );
      }
      if (errors.length > 0) {
        toast.error(
          `${t(uiLocale, "purchase.monthEnd.bulk.toast.failures.prefix")} ${errors.length} ${t(uiLocale, "purchase.items")}`,
        );
      } else {
        setSelectedPendingQueueIds([]);
        setIsBulkMonthEndMode(false);
      }

      setBulkErrors(errors);
      await reloadFirstPage();
      router.refresh();
    } catch {
      toast.error(t(uiLocale, "purchase.monthEnd.bulk.error.connectionDuringBulk"));
    } finally {
      setIsBulkSubmitting(false);
      setBulkProgressText(null);
    }
  }, [
    bulkNoteInput,
    bulkPaidAtInput,
    bulkRateInput,
    bulkStatementTotalInput,
    bulkReferenceInput,
    hasMixedPendingCurrencies,
    loadPoDetail,
    numberLocale,
    reloadFirstPage,
    router,
    sortedSelectedPendingQueueItems,
    storeCurrency,
    uiLocale,
  ]);

  /* ── Load products for item picker ── */
  const loadProducts = useCallback(async () => {
    if (productOptions.length > 0) return;
    setLoadingProducts(true);
    try {
      const res = await authFetch("/api/stock/movements");
      const data = await res.json();
      if (data.ok && data.products) {
        setProductOptions(
          data.products.map(
            (p: {
              productId: string;
              name: string;
              sku: string;
              baseUnitId: string;
              baseUnitCode: string;
              baseUnitNameTh: string;
              unitOptions?: {
                unitId: string;
                unitCode: string;
                unitNameTh: string;
                multiplierToBase: number;
              }[];
            }) => ({
              id: p.productId,
              name: p.name,
              sku: p.sku,
              baseUnitId: p.baseUnitId,
              baseUnitCode: p.baseUnitCode,
              baseUnitNameTh: p.baseUnitNameTh,
              unitOptions: Array.isArray(p.unitOptions) ? p.unitOptions : [],
            }),
          ),
        );
      }
    } catch {
      /* ignore */
    } finally {
      setLoadingProducts(false);
    }
  }, [productOptions.length]);

  /* ── Open/close ── */
  const openCreateSheet = () => {
    setSupplierName("");
    setSupplierContact("");
    setPurchaseCurrency(storeCurrency);
    setExchangeRate("");
    setIsSupplierPickerOpen(false);
    setProductSearch("");
    setIsProductPickerOpen(false);
    setItems([]);
    setShippingCost("");
    setOtherCost("");
    setOtherCostNote("");
    setNote("");
    setExpectedAt("");
    setDueDate("");
    setWizardStep(1);
    setIsCreateCloseConfirmOpen(false);
    setIsCreateOpen(true);
    loadProducts();
  };

  const forceCloseCreateSheet = useCallback(() => {
    setIsCreateCloseConfirmOpen(false);
    setIsSupplierPickerOpen(false);
    setIsCreateOpen(false);
  }, []);

  const closeCreateSheet = useCallback(() => {
    if (isSubmitting) return;
    if (hasCreateDraftChanges) {
      setIsCreateCloseConfirmOpen(true);
      return;
    }
    forceCloseCreateSheet();
  }, [forceCloseCreateSheet, hasCreateDraftChanges, isSubmitting]);

  /* ── Add item ── */
  const addItem = (product: PurchaseProductOption) => {
    if (items.some((i) => i.productId === product.id)) {
      toast.error(t(uiLocale, "purchase.items.error.duplicateProduct"));
      return;
    }
    const defaultUnit =
      product.unitOptions.find((option) => option.unitId === product.baseUnitId) ??
      product.unitOptions[0] ??
      {
        unitId: product.baseUnitId,
        unitCode: product.baseUnitCode,
        unitNameTh: product.baseUnitNameTh,
        multiplierToBase: 1,
      };
    setItems((prev) => [
      ...prev,
      {
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        unitId: defaultUnit.unitId,
        unitCode: defaultUnit.unitCode,
        unitNameTh: defaultUnit.unitNameTh,
        baseUnitCode: product.baseUnitCode,
        baseUnitNameTh: product.baseUnitNameTh,
        multiplierToBase: defaultUnit.multiplierToBase,
        qtyOrdered: "1",
        unitCostPurchase: "",
      },
    ]);
    setProductSearch("");
    setIsProductPickerOpen(false);
  };

  const removeItem = (productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  };

  const updateItem = (
    productId: string,
    field: "qtyOrdered" | "unitCostPurchase" | "unitId",
    value: string,
  ) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.productId !== productId) {
          return item;
        }
        if (field !== "unitId") {
          return { ...item, [field]: value };
        }
        const product = productOptions.find((option) => option.id === productId);
        const nextUnit =
          product?.unitOptions.find((option) => option.unitId === value) ??
          null;
        if (!nextUnit) {
          return item;
        }
        return {
          ...item,
          unitId: nextUnit.unitId,
          unitCode: nextUnit.unitCode,
          unitNameTh: nextUnit.unitNameTh,
          multiplierToBase: nextUnit.multiplierToBase,
        };
      }),
    );
  };

  /* ── Computed totals ── */
  const normalizedExchangeRate = exchangeRate.trim();
  const hasExchangeRateInput =
    normalizedExchangeRate.length > 0 && Number(normalizedExchangeRate) > 0;
  const rate = hasExchangeRateInput ? Number(normalizedExchangeRate) : 1;
  const effectiveRate = purchaseCurrency === storeCurrency ? 1 : rate;
  const itemsTotalPurchase = items.reduce(
    (sum, i) => sum + (Number(i.qtyOrdered) || 0) * (Number(i.unitCostPurchase) || 0),
    0,
  );
  const itemsTotalBase = Math.round(itemsTotalPurchase * effectiveRate);
  const shipping = Number(shippingCost) || 0;
  const other = Number(otherCost) || 0;
  const grandTotal = itemsTotalBase + shipping + other;

  /* ── Submit ── */
  const submitPO = async (receiveImmediately: boolean) => {
    if (items.length === 0) {
      toast.error(t(uiLocale, "purchase.create.validation.itemsRequired"));
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await authFetch("/api/stock/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierName: supplierName || undefined,
          supplierContact: supplierContact || undefined,
          purchaseCurrency,
          exchangeRate:
            purchaseCurrency === storeCurrency
              ? 1
              : hasExchangeRateInput
                ? rate
                : undefined,
          shippingCost: shipping,
          otherCost: other,
          otherCostNote: otherCostNote || undefined,
          note: note || undefined,
          expectedAt: expectedAt || undefined,
          dueDate: dueDate || undefined,
          receiveImmediately,
          items: items.map((i) => ({
            productId: i.productId,
            unitId: i.unitId,
            qtyOrdered: Number(i.qtyOrdered) || 1,
            unitCostPurchase: Number(i.unitCostPurchase) || 0,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.message ?? t(uiLocale, "purchase.create.error.failed"));
        return;
      }
      toast.success(
        receiveImmediately
          ? t(uiLocale, "purchase.create.toast.successReceived")
          : t(uiLocale, "purchase.create.toast.success"),
      );
      if (
        data?.purchaseOrder?.purchaseCurrency &&
        data.purchaseOrder.purchaseCurrency !== storeCurrency &&
        !data.purchaseOrder.exchangeRateLockedAt
      ) {
        toast(t(uiLocale, "purchase.create.toast.pendingRateHint"), {
          icon: "🧾",
        });
      }
      forceCloseCreateSheet();
      await reloadFirstPage();
      router.refresh();
    } catch {
      toast.error(t(uiLocale, "purchase.error.serverUnreachableRetry"));
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ── Update PO status ── */
  const updateStatus = async (
    poId: string,
    status: "ORDERED" | "SHIPPED" | "RECEIVED" | "CANCELLED",
  ) => {
    try {
      const res = await authFetch(`/api/stock/purchase-orders/${poId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.message ?? t(uiLocale, "purchase.statusUpdate.error.failed"));
        return;
      }
      toast.success(
        `${t(uiLocale, "purchase.statusUpdate.toast.success.prefix")}${statusConfig[status].label}${t(uiLocale, "purchase.statusUpdate.toast.success.suffix")}`,
      );
      invalidatePoDetailCache(poId);
      await reloadFirstPage();
      setSelectedPO(null);
      router.refresh();
    } catch {
      toast.error(t(uiLocale, "purchase.error.serverUnreachable"));
    }
  };

  /* ── Style helpers ── */
  const fieldClassName =
    "h-11 w-full min-w-0 max-w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none ring-primary focus:ring-2 disabled:bg-slate-100";

  const filteredProductOptions = productOptions.filter(
    (p) =>
      !items.some((i) => i.productId === p.id) &&
      (productSearch === "" ||
        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.sku.toLowerCase().includes(productSearch.toLowerCase())),
  );
  const visibleProductPickerOptions = useMemo(
    () => filteredProductOptions.slice(0, productSearch ? 10 : 20),
    [filteredProductOptions, productSearch],
  );
  const productOptionMap = useMemo(
    () => new Map(productOptions.map((product) => [product.id, product])),
    [productOptions],
  );
  const supplierNameOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: string[] = [];
    for (const po of poList) {
      const supplier = po.supplierName?.trim();
      if (!supplier) {
        continue;
      }
      const key = supplier.toLocaleLowerCase("en-US");
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      options.push(supplier);
      if (options.length >= 100) {
        break;
      }
    }
    return options;
  }, [poList]);
  const filteredSupplierOptions = useMemo(() => {
    const keyword = supplierName.trim().toLocaleLowerCase("en-US");
    if (!keyword) {
      return supplierNameOptions;
    }
    return supplierNameOptions.filter((name) =>
      name.toLocaleLowerCase("en-US").includes(keyword),
    );
  }, [supplierName, supplierNameOptions]);
  const visibleSupplierPickerOptions = useMemo(
    () => filteredSupplierOptions.slice(0, supplierName.trim() ? 10 : 30),
    [filteredSupplierOptions, supplierName],
  );

  /* ── Status counts for badges ── */
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: poList.length };
    for (const po of poList) {
      counts[po.status] = (counts[po.status] ?? 0) + 1;
    }
    counts.OPEN =
      (counts.DRAFT ?? 0) + (counts.ORDERED ?? 0) + (counts.SHIPPED ?? 0);
    return counts;
  }, [poList]);
  const workspaceSummary = useMemo(() => {
    const today = new Date();
    const startOfToday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    ).getTime();
    const dueSoonBoundary = startOfToday + 3 * 24 * 60 * 60 * 1000;

    let openPoCount = 0;
    let overduePoCount = 0;
    let dueSoonPoCount = 0;
    let outstandingBase = 0;

    for (const po of poList) {
      if (po.status !== "CANCELLED" && po.status !== "RECEIVED") {
        openPoCount += 1;
      }

      if (po.status !== "RECEIVED") {
        continue;
      }
      const outstanding = Math.max(0, Math.round(po.outstandingBase));
      if (outstanding <= 0) {
        continue;
      }

      outstandingBase += outstanding;
      if (!po.dueDate) {
        continue;
      }

      const dueAt = new Date(po.dueDate).getTime();
      if (!Number.isFinite(dueAt)) {
        continue;
      }
      if (dueAt < startOfToday) {
        overduePoCount += 1;
      } else if (dueAt <= dueSoonBoundary) {
        dueSoonPoCount += 1;
      }
    }

    return {
      openPoCount,
      pendingRateCount: pendingRateQueue.length,
      overduePoCount,
      dueSoonPoCount,
      outstandingBase,
    };
  }, [pendingRateQueue.length, poList]);
  const activeKpiShortcutLabel = useMemo(() => {
    if (activeKpiShortcut === "OPEN_PO") return t(uiLocale, "purchase.kpiShortcut.OPEN_PO.active");
    if (activeKpiShortcut === "PENDING_RATE") {
      return t(uiLocale, "purchase.kpiShortcut.PENDING_RATE.active");
    }
    if (activeKpiShortcut === "OVERDUE_AP") {
      return t(uiLocale, "purchase.kpiShortcut.OVERDUE_AP.active");
    }
    if (activeKpiShortcut === "OUTSTANDING_AP") {
      return t(uiLocale, "purchase.kpiShortcut.OUTSTANDING_AP.active");
    }
    return null;
  }, [activeKpiShortcut, uiLocale]);

  return (
    <div className="space-y-3">
      {/* ── Header row: title + "+" button ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{t(uiLocale, "purchase.title")}</h2>
          <p className="text-[11px] text-slate-500">
            {poList.length > 0
              ? `${poList.length.toLocaleString(numberLocale)} ${t(uiLocale, "purchase.items")}`
              : t(uiLocale, "purchase.emptyList")}
          </p>
        </div>
        {canCreate && (
          <div className="flex items-center">
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-3.5 text-sm font-medium text-white shadow-sm transition-transform active:scale-95"
              onClick={openCreateSheet}
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              {t(uiLocale, "purchase.create")}
            </button>
          </div>
        )}
      </div>
      <StockTabToolbar
        isRefreshing={isRefreshingList}
        lastUpdatedAt={lastUpdatedAt}
        onRefresh={() => {
          void reloadFirstPage();
        }}
      />
      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          {t(uiLocale, "purchase.kpi.title")}
        </p>
        <p className="mt-1 text-[11px] text-slate-500">
          {t(uiLocale, "purchase.kpi.subtitle")}
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-left">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {t(uiLocale, "purchase.kpi.openPo.title")}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900">
              {workspaceSummary.openPoCount.toLocaleString(numberLocale)}
            </p>
            <p className="text-[11px] text-slate-500">{t(uiLocale, "purchase.kpi.openPo.desc")}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-left">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {t(uiLocale, "purchase.kpi.pendingRate.title")}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900">
              {workspaceSummary.pendingRateCount.toLocaleString(numberLocale)}
            </p>
            <p className="text-[11px] text-slate-500">
              {t(uiLocale, "purchase.kpi.pendingRate.desc")}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-left">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {t(uiLocale, "purchase.kpi.overdueAp.title")}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900">
              {workspaceSummary.overduePoCount.toLocaleString(numberLocale)}
            </p>
            <p className="text-[11px] text-slate-500">
              {t(uiLocale, "purchase.kpi.overdueAp.dueSoonPrefix")}{" "}
              {workspaceSummary.dueSoonPoCount.toLocaleString(numberLocale)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-left">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {t(uiLocale, "purchase.kpi.outstanding.title")}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900">
              {fmtPrice(workspaceSummary.outstandingBase, storeCurrency, numberLocale)}
            </p>
            <p className="text-[11px] text-slate-500">
              {t(uiLocale, "purchase.kpi.outstanding.desc")}
            </p>
          </div>
        </div>
        {activeKpiShortcutLabel ? (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
            <p className="text-[11px] text-slate-600">
              {t(uiLocale, "purchase.kpi.appliedFilter")} {activeKpiShortcutLabel}
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                onClick={saveCurrentShortcutPreset}
              >
                {t(uiLocale, "purchase.kpi.savePreset")}
              </button>
              <button
                type="button"
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                onClick={clearKpiShortcut}
              >
                {t(uiLocale, "purchase.kpi.clearShortcut")}
              </button>
            </div>
          </div>
        ) : null}
        {savedPresets.length > 0 ? (
          <div className="mt-2 flex gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {savedPresets.map((preset) => (
              <div
                key={preset.id}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1"
              >
                <button
                  type="button"
                  className="text-[11px] font-medium text-slate-700 hover:text-slate-900"
                  onClick={() => applyKpiShortcut(preset.shortcut)}
                >
                  {preset.label}
                </button>
                  <button
                    type="button"
                    className="rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                    onClick={() => removeSavedPreset(preset.id)}
                    aria-label={`${t(uiLocale, "purchase.preset.deleteAriaPrefix")} ${preset.label}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="sticky top-2 z-10 rounded-2xl border border-slate-200 bg-white/95 p-2 backdrop-blur md:static md:z-auto md:bg-white md:p-2 md:backdrop-blur-0">
        <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          {t(uiLocale, "purchase.workspace.title")}
        </p>
        <div className="mt-1 flex gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {(
            [
              {
                id: "OPERATIONS" as PurchaseWorkspace,
                label: t(uiLocale, "purchase.workspace.operations.label"),
                icon: ShoppingCart,
                desc: t(uiLocale, "purchase.workspace.operations.desc"),
                badge: workspaceSummary.openPoCount,
              },
              {
                id: "MONTH_END" as PurchaseWorkspace,
                label: t(uiLocale, "purchase.workspace.monthEnd.label"),
                icon: Banknote,
                desc: t(uiLocale, "purchase.workspace.monthEnd.desc"),
                badge: workspaceSummary.pendingRateCount,
              },
              {
                id: "SUPPLIER_AP" as PurchaseWorkspace,
                label: t(uiLocale, "purchase.workspace.supplierAp.label"),
                icon: FileText,
                desc: t(uiLocale, "purchase.workspace.supplierAp.desc"),
                badge: workspaceSummary.overduePoCount,
              },
            ] as const
          ).map((workspace) => {
            const WorkspaceIcon = workspace.icon;
            const isActive = workspaceTab === workspace.id;
            return (
              <button
                key={workspace.id}
                type="button"
                className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors ${
                  isActive
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                }`}
                onClick={() => handleWorkspaceChange(workspace.id)}
              >
                <WorkspaceIcon className="h-3.5 w-3.5" />
                <span className="text-xs font-semibold">{workspace.label}</span>
                {workspace.badge > 0 ? (
                  <span
                    className={`inline-flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold ${
                      isActive
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {workspace.badge.toLocaleString(numberLocale)}
                  </span>
                ) : null}
                <span
                  className={`hidden text-[11px] sm:inline ${
                    isActive ? "text-primary-foreground/80" : "text-slate-500"
                  }`}
                >
                  {workspace.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {workspaceTab === "MONTH_END" ? (
      <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50/70 p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">
              {t(uiLocale, "purchase.monthEnd.queue.title")}
            </p>
            <p className="text-[11px] text-amber-700/90">
              {pendingRateQueue.length.toLocaleString(numberLocale)} {t(uiLocale, "purchase.items")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              window.open("/api/stock/purchase-orders/outstanding/export-csv", "_blank", "noopener,noreferrer");
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-[11px] font-medium text-amber-700 hover:bg-amber-100"
          >
            <Download className="h-3.5 w-3.5" />
            {t(uiLocale, "purchase.monthEnd.exportCsv")}
          </button>
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <div className="space-y-1">
            <label className="text-[11px] text-amber-700">{t(uiLocale, "purchase.monthEnd.filter.supplier.label")}</label>
            <input
              className="h-9 w-full rounded-lg border border-amber-200 bg-white px-2.5 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-amber-300"
              placeholder={t(uiLocale, "purchase.monthEnd.filter.supplier.placeholder")}
              value={pendingSupplierFilter}
              onChange={(event) => setPendingSupplierFilter(event.target.value)}
            />
          </div>
          <div className="space-y-1 min-w-0">
            <label className="text-[11px] text-amber-700">{t(uiLocale, "purchase.monthEnd.filter.receivedFrom.label")}</label>
            <PurchaseDatePickerField
              uiLocale={uiLocale}
              value={pendingReceivedFrom}
              onChange={setPendingReceivedFrom}
              triggerClassName="h-9 w-full rounded-lg border border-amber-200 bg-white px-2.5 text-left text-xs text-slate-900 outline-none focus:ring-2 focus:ring-amber-300 flex items-center justify-between gap-2"
              placeholder={t(uiLocale, "common.datePicker.placeholder")}
              ariaLabel={t(uiLocale, "purchase.monthEnd.filter.receivedFrom.aria")}
            />
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                className="rounded-md border border-amber-200 bg-white px-2 py-1 text-[10px] font-medium text-amber-700 hover:bg-amber-100"
                onClick={() => applyPendingQueueDateShortcut("receivedFrom", "TODAY")}
              >
                {t(uiLocale, "purchase.dateShortcut.today")}
              </button>
              <button
                type="button"
                className="rounded-md border border-amber-200 bg-white px-2 py-1 text-[10px] font-medium text-amber-700 hover:bg-amber-100"
                onClick={() => applyPendingQueueDateShortcut("receivedFrom", "PLUS_7")}
              >
                {t(uiLocale, "purchase.dateShortcut.plus7")}
              </button>
              <button
                type="button"
                className="rounded-md border border-amber-200 bg-white px-2 py-1 text-[10px] font-medium text-amber-700 hover:bg-amber-100"
                onClick={() => applyPendingQueueDateShortcut("receivedFrom", "END_OF_MONTH")}
              >
                {t(uiLocale, "purchase.dateShortcut.endOfMonth")}
              </button>
              <button
                type="button"
                className="rounded-md border border-amber-200 bg-white px-2 py-1 text-[10px] font-medium text-amber-700 hover:bg-amber-100"
                onClick={() => applyPendingQueueDateShortcut("receivedFrom", "CLEAR")}
              >
                {t(uiLocale, "purchase.dateShortcut.clear")}
              </button>
            </div>
          </div>
          <div className="space-y-1 min-w-0">
            <label className="text-[11px] text-amber-700">{t(uiLocale, "purchase.monthEnd.filter.receivedTo.label")}</label>
            <PurchaseDatePickerField
              uiLocale={uiLocale}
              value={pendingReceivedTo}
              onChange={setPendingReceivedTo}
              triggerClassName="h-9 w-full rounded-lg border border-amber-200 bg-white px-2.5 text-left text-xs text-slate-900 outline-none focus:ring-2 focus:ring-amber-300 flex items-center justify-between gap-2"
              placeholder={t(uiLocale, "common.datePicker.placeholder")}
              ariaLabel={t(uiLocale, "purchase.monthEnd.filter.receivedTo.aria")}
            />
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                className="rounded-md border border-amber-200 bg-white px-2 py-1 text-[10px] font-medium text-amber-700 hover:bg-amber-100"
                onClick={() => applyPendingQueueDateShortcut("receivedTo", "TODAY")}
              >
                {t(uiLocale, "purchase.dateShortcut.today")}
              </button>
              <button
                type="button"
                className="rounded-md border border-amber-200 bg-white px-2 py-1 text-[10px] font-medium text-amber-700 hover:bg-amber-100"
                onClick={() => applyPendingQueueDateShortcut("receivedTo", "PLUS_7")}
              >
                {t(uiLocale, "purchase.dateShortcut.plus7")}
              </button>
              <button
                type="button"
                className="rounded-md border border-amber-200 bg-white px-2 py-1 text-[10px] font-medium text-amber-700 hover:bg-amber-100"
                onClick={() => applyPendingQueueDateShortcut("receivedTo", "END_OF_MONTH")}
              >
                {t(uiLocale, "purchase.dateShortcut.endOfMonth")}
              </button>
              <button
                type="button"
                className="rounded-md border border-amber-200 bg-white px-2 py-1 text-[10px] font-medium text-amber-700 hover:bg-amber-100"
                onClick={() => applyPendingQueueDateShortcut("receivedTo", "CLEAR")}
              >
                {t(uiLocale, "purchase.dateShortcut.clear")}
              </button>
            </div>
          </div>
        </div>
        {isLoadingPendingQueue ? (
          <p className="text-xs text-amber-700">{t(uiLocale, "purchase.monthEnd.loadingQueue")}</p>
        ) : pendingQueueError ? (
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-red-600">{pendingQueueError}</p>
            <Button
              type="button"
              variant="outline"
              className="h-7 border-red-200 bg-white px-2.5 text-xs text-red-700 hover:bg-red-50"
              onClick={() => {
                void loadPendingQueue();
              }}
            >
              {t(uiLocale, "purchase.action.retry")}
            </Button>
          </div>
        ) : pendingRateQueue.length === 0 ? (
          <div className="space-y-2 rounded-lg border border-dashed border-amber-300 bg-white px-3 py-4 text-center">
            <p className="text-xs text-amber-700/90">{t(uiLocale, "purchase.monthEnd.empty.title")}</p>
            <p className="text-[11px] text-slate-500">
              {t(uiLocale, "purchase.monthEnd.empty.hint")}
            </p>
            <div className="flex justify-center gap-2">
              <button
                type="button"
                className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-100"
                onClick={() => handleWorkspaceChange("OPERATIONS")}
              >
                {t(uiLocale, "purchase.monthEnd.goOperations")}
              </button>
              {canCreate ? (
                <button
                  type="button"
                  className="rounded-md bg-amber-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-amber-700"
                  onClick={openCreateSheet}
                >
                  {t(uiLocale, "purchase.monthEnd.createPo")}
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-white px-2.5 py-2">
              <p className="text-[11px] text-amber-800">
                {t(uiLocale, "purchase.monthEnd.selected")}{" "}
                {selectedPendingQueueIds.length.toLocaleString(numberLocale)}/
                {pendingRateQueue.length.toLocaleString(numberLocale)} {t(uiLocale, "purchase.items")}
                {selectedPendingCurrency
                  ? ` · ${t(uiLocale, "purchase.monthEnd.currencyPrefix")} ${selectedPendingCurrency}`
                  : ""}
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  className="rounded-md border border-amber-200 px-2 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-50"
                  onClick={selectAllPendingQueue}
                  disabled={isBulkSubmitting}
                >
                  {t(uiLocale, "purchase.monthEnd.selectAll")}
                </button>
                <button
                  type="button"
                  className="rounded-md border border-amber-200 px-2 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-50"
                  onClick={clearPendingQueueSelection}
                  disabled={isBulkSubmitting}
                >
                  {t(uiLocale, "purchase.monthEnd.clearSelection")}
                </button>
                <button
                  type="button"
                  className="rounded-md bg-amber-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-amber-700 disabled:opacity-60"
                  onClick={openBulkMonthEndMode}
                  disabled={selectedPendingQueueIds.length === 0 || isBulkSubmitting}
                >
                  {t(uiLocale, "purchase.monthEnd.bulkAction")}
                </button>
              </div>
            </div>
            {hasMixedPendingCurrencies ? (
              <p className="text-[11px] text-red-600">
                {t(uiLocale, "purchase.monthEnd.mixedCurrencies")}
              </p>
            ) : null}
            {isBulkMonthEndMode ? (
              <div className="space-y-2 rounded-lg border border-amber-300 bg-white p-3">
                <p className="text-xs font-semibold text-amber-800">
                  {t(uiLocale, "purchase.monthEnd.bulk.panel.title")}
                </p>
                <p className="text-[11px] text-amber-700/90">
                  {t(uiLocale, "purchase.monthEnd.bulk.panel.subtitle")}
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-600">
                      {t(uiLocale, "purchase.monthEnd.bulk.field.exchangeRate.label")} (1{" "}
                      {selectedPendingCurrency ?? "-"} = ? {storeCurrency})
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      className="h-9 w-full rounded-lg border border-amber-200 bg-white px-2.5 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-amber-300"
                      value={bulkRateInput}
                      onChange={(event) => setBulkRateInput(event.target.value)}
                      placeholder="0"
                      disabled={isBulkSubmitting}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-600">
                      {t(uiLocale, "purchase.monthEnd.bulk.field.paidAt.label")}
                    </label>
                    <input
                      type="date"
                      className="po-date-input h-9 w-full rounded-lg border border-amber-200 bg-white px-2.5 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-amber-300"
                      value={bulkPaidAtInput}
                      onChange={(event) => setBulkPaidAtInput(event.target.value)}
                      disabled={isBulkSubmitting}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-600">
                      {t(uiLocale, "purchase.monthEnd.bulk.field.statementTotal.labelOptional")}
                    </label>
                    <input
                      type="number"
                      inputMode="numeric"
                      className="h-9 w-full rounded-lg border border-amber-200 bg-white px-2.5 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-amber-300"
                      value={bulkStatementTotalInput}
                      onChange={(event) => setBulkStatementTotalInput(event.target.value)}
                      placeholder="0"
                      disabled={isBulkSubmitting}
                    />
                    <p className="text-[10px] text-slate-500">
                      {t(uiLocale, "purchase.monthEnd.bulk.field.statementTotal.help")}
                    </p>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[11px] text-slate-600">
                      {t(uiLocale, "purchase.monthEnd.bulk.field.reference.labelRequired")}
                    </label>
                    <input
                      className="h-9 w-full rounded-lg border border-amber-200 bg-white px-2.5 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-amber-300"
                      value={bulkReferenceInput}
                      onChange={(event) => setBulkReferenceInput(event.target.value)}
                      placeholder={t(uiLocale, "purchase.monthEnd.bulk.field.reference.placeholder")}
                      disabled={isBulkSubmitting}
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[11px] text-slate-600">
                      {t(uiLocale, "purchase.monthEnd.bulk.field.note.labelOptional")}
                    </label>
                    <input
                      className="h-9 w-full rounded-lg border border-amber-200 bg-white px-2.5 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-amber-300"
                      value={bulkNoteInput}
                      onChange={(event) => setBulkNoteInput(event.target.value)}
                      placeholder={t(uiLocale, "purchase.monthEnd.bulk.field.note.placeholder")}
                      disabled={isBulkSubmitting}
                    />
                  </div>
                </div>
                <div className="space-y-1 rounded-md border border-amber-200 bg-amber-50/50 p-2">
                  <p className="text-[11px] font-medium text-amber-800">
                    {t(uiLocale, "purchase.monthEnd.bulk.preview.title")}
                  </p>
                  <p className="text-[11px] text-amber-800">
                    {t(uiLocale, "purchase.monthEnd.bulk.preview.selectedOutstanding.prefix")}{" "}
                    {fmtPrice(bulkAllocationPreview.totalOutstanding, storeCurrency, numberLocale)}
                    {" · "}
                    {t(uiLocale, "purchase.monthEnd.bulk.preview.willSettle.prefix")}{" "}
                    {fmtPrice(bulkAllocationPreview.plannedTotal, storeCurrency, numberLocale)}
                    {" · "}
                    {t(uiLocale, "purchase.monthEnd.bulk.preview.remainingOutstanding.prefix")}{" "}
                    {fmtPrice(bulkAllocationPreview.outstandingAfter, storeCurrency, numberLocale)}
                  </p>
                  {bulkAllocationPreview.statementTotal !== null ? (
                    <p className="text-[11px] text-amber-800">
                      {t(uiLocale, "purchase.monthEnd.bulk.preview.unmatchedStatement.prefix")}{" "}
                      {fmtPrice(
                        bulkAllocationPreview.remainingUnallocated,
                        storeCurrency,
                        numberLocale,
                      )}
                    </p>
                  ) : null}
                  {bulkAllocationPreview.invalidStatementTotal ? (
                    <p className="text-[11px] text-red-600">
                      {t(uiLocale, "purchase.monthEnd.bulk.preview.statementTotalInvalid")}
                    </p>
                  ) : null}
                  <div className="max-h-24 space-y-0.5 overflow-y-auto pr-1">
                    {bulkAllocationPreview.rows.map((row) => (
                      <p key={row.id} className="text-[11px] text-amber-800">
                        {row.poNumber}
                        {row.supplierName ? ` · ${row.supplierName}` : ""}
                        {row.dueDate
                          ? ` · ${t(uiLocale, "purchase.label.dueDate")} ${formatDate(row.dueDate, dateLocale)}`
                          : ""}
                        {" · "}
                        {t(uiLocale, "purchase.monthEnd.bulk.preview.match.prefix")}{" "}
                        {fmtPrice(row.planned, storeCurrency, numberLocale)}
                        {" / "}
                        {t(uiLocale, "purchase.monthEnd.bulk.preview.outstanding.prefix")}{" "}
                        {fmtPrice(row.outstanding, storeCurrency, numberLocale)}
                      </p>
                    ))}
                  </div>
                </div>
                {bulkProgressText ? (
                  <p className="text-[11px] text-amber-700">{bulkProgressText}</p>
                ) : null}
                {bulkErrors.length > 0 ? (
                  <div className="space-y-1 rounded-md border border-red-200 bg-red-50 p-2">
                    <p className="text-[11px] font-medium text-red-700">
                      {t(uiLocale, "purchase.monthEnd.bulk.errors.title.prefix")} (
                      {bulkErrors.length.toLocaleString(numberLocale)})
                    </p>
                    <ul className="max-h-24 list-disc space-y-0.5 overflow-y-auto pl-4 text-[11px] text-red-700">
                      {bulkErrors.map((error, index) => (
                        <li key={`${error}-${index}`}>{error}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 border-amber-200 bg-white text-xs text-amber-700 hover:bg-amber-50"
                    onClick={() => setIsBulkMonthEndMode(false)}
                    disabled={isBulkSubmitting}
                  >
                    {t(uiLocale, "common.action.cancel")}
                  </Button>
                  <Button
                    type="button"
                    className="h-9 bg-amber-600 text-xs text-white hover:bg-amber-700"
                    onClick={() => {
                      void submitBulkMonthEnd();
                    }}
                    disabled={isBulkSubmitting || hasMixedPendingCurrencies}
                  >
                    {isBulkSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      t(uiLocale, "purchase.monthEnd.bulk.cta.confirm")
                    )}
                  </Button>
                </div>
              </div>
            ) : null}
            <div className="max-h-72 space-y-1.5 overflow-y-auto">
              {pendingRateQueue.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-2 rounded-lg border border-amber-200 bg-white px-2.5 py-2"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-400"
                    checked={selectedPendingQueueSet.has(item.id)}
                    onChange={() => togglePendingQueueSelection(item.id)}
                    disabled={isBulkSubmitting}
                  />
                  <button
                    type="button"
                    className="flex flex-1 items-center justify-between text-left"
                    onClick={() => setSelectedPO(item.id)}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-slate-900">
                        {item.poNumber}
                        {item.supplierName ? ` · ${item.supplierName}` : ""}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {item.receivedAt
                          ? `${t(uiLocale, "purchase.label.receivedAt")} ${formatDate(item.receivedAt, dateLocale)}`
                          : t(uiLocale, "purchase.label.noReceivedDate")}
                        {" · "}
                        {t(uiLocale, "purchase.label.initialRate")} {item.exchangeRateInitial}{" "}
                        {storeCurrency}/{item.purchaseCurrency}
                        {item.dueDate
                          ? ` · ${t(uiLocale, "purchase.label.dueDate")} ${formatDate(item.dueDate, dateLocale)}`
                          : ""}
                        {" · "}
                        {t(uiLocale, "purchase.label.outstanding")}{" "}
                        {fmtPrice(item.outstandingBase, storeCurrency, numberLocale)}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-amber-500" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      ) : null}

      {workspaceTab === "SUPPLIER_AP" ? (
      <PurchaseApSupplierPanel
        storeCurrency={storeCurrency}
        refreshKey={lastUpdatedAt}
        preset={apPanelPreset ?? apQueryPreset}
        onFiltersChange={handleApFiltersChange}
        onAfterBulkSettle={reloadFirstPage}
        onOpenPurchaseOrder={(poId) => {
          setSelectedPO(poId);
        }}
      />
      ) : null}

      {workspaceTab === "OPERATIONS" ? (
      <>
      {listError && poList.length > 0 ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2">
          <p className="text-xs text-red-700">{listError}</p>
          <Button
            type="button"
            variant="outline"
            className="h-7 border-red-200 bg-white px-2.5 text-xs text-red-700 hover:bg-red-100"
            onClick={() => {
              void reloadFirstPage();
            }}
          >
            {t(uiLocale, "purchase.action.retry")}
          </Button>
        </div>
      ) : null}

      {/* ── Filter chips (full-width, scrollable) ── */}
      <div className="flex gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {(
          [
            { id: "ALL" as StatusFilter, label: t(uiLocale, "purchase.filter.all") },
            { id: "OPEN" as StatusFilter, label: t(uiLocale, "purchase.filter.open") },
            { id: "DRAFT" as StatusFilter, label: getPurchaseStatusLabel(uiLocale, "DRAFT") },
            { id: "ORDERED" as StatusFilter, label: getPurchaseStatusLabel(uiLocale, "ORDERED") },
            { id: "SHIPPED" as StatusFilter, label: getPurchaseStatusLabel(uiLocale, "SHIPPED") },
            { id: "RECEIVED" as StatusFilter, label: getPurchaseStatusLabel(uiLocale, "RECEIVED") },
            { id: "CANCELLED" as StatusFilter, label: getPurchaseStatusLabel(uiLocale, "CANCELLED") },
          ] as const
        ).map((f) => {
          const count = statusCounts[f.id] ?? 0;
          const isActive = statusFilter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-primary text-white"
                  : "bg-slate-100 text-slate-600 active:bg-slate-200"
              }`}
              onClick={() => {
                setStatusFilter(f.id);
                setActiveKpiShortcut(null);
                setApPanelPreset(null);
                replacePurchaseQuery((params) => {
                  params.delete(PURCHASE_AP_DUE_QUERY_KEY);
                  params.delete(PURCHASE_AP_PAYMENT_QUERY_KEY);
                  params.delete(PURCHASE_AP_SORT_QUERY_KEY);
                });
              }}
            >
              {f.label}
              {count > 0 && (
                <span
                  className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-none ${
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {count.toLocaleString(numberLocale)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── PO list ── */}
      {isRefreshingList && poList.length === 0 ? (
        <StockTabLoadingState message={t(uiLocale, "purchase.list.refreshing")} />
      ) : listError && poList.length === 0 ? (
        <StockTabErrorState
          message={listError}
          onRetry={() => {
            void reloadFirstPage();
          }}
        />
      ) : filteredList.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-12 text-center">
          <ShoppingCart className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-2 text-sm text-slate-500">
            {statusFilter === "ALL"
              ? t(uiLocale, "purchase.empty.all")
              : statusFilter === "OPEN"
                ? t(uiLocale, "purchase.empty.open")
                : t(uiLocale, "purchase.empty.status")}
          </p>
          {canCreate && (statusFilter === "ALL" || statusFilter === "OPEN") && (
            <button
              type="button"
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-transform active:scale-95"
              onClick={openCreateSheet}
            >
              <Plus className="h-4 w-4" />
              {t(uiLocale, "purchase.createNew")}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredList.map((po) => {
            const cfg = statusConfig[po.status];
            const Icon = cfg.icon;
            const isExchangeRatePending =
              po.purchaseCurrency !== storeCurrency && !po.exchangeRateLockedAt;
            const remaining =
              po.expectedAt && po.status !== "RECEIVED" && po.status !== "CANCELLED"
                ? daysUntil(po.expectedAt)
                : null;

            return (
              <button
                key={po.id}
                type="button"
                className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:bg-slate-50"
                onClick={() => setSelectedPO(po.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">
                        {po.poNumber}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${cfg.badgeClass}`}
                      >
                        <Icon className="h-3 w-3" />
                        {cfg.label}
                      </span>
                    </div>
                    {po.supplierName && (
                      <p className="mt-0.5 text-xs text-slate-500">
                        {po.supplierName} ({po.purchaseCurrency})
                      </p>
                    )}
                    {isExchangeRatePending && (
                      <p className="mt-1 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                        {t(uiLocale, "purchase.badge.pendingRate")}
                      </p>
                    )}
                    {po.status === "RECEIVED" && (
                      <p
                        className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          po.paymentStatus === "PAID"
                            ? "bg-emerald-50 text-emerald-700"
                            : po.paymentStatus === "PARTIAL"
                              ? "bg-amber-50 text-amber-700"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {po.paymentStatus === "PAID"
                          ? t(uiLocale, "purchase.paymentStatus.PAID")
                          : po.paymentStatus === "PARTIAL"
                            ? t(uiLocale, "purchase.paymentStatus.PARTIAL")
                            : t(uiLocale, "purchase.paymentStatus.UNPAID")}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-slate-500">
                      {po.itemCount.toLocaleString(numberLocale)} {t(uiLocale, "purchase.items")} ·{" "}
                      {fmtPrice(
                        po.totalCostBase + po.shippingCost + po.otherCost,
                        storeCurrency,
                        numberLocale,
                      )}
                      {po.status === "RECEIVED" ? (
                        <>
                          {" · "}
                          {t(uiLocale, "purchase.label.outstanding")}{" "}
                          {fmtPrice(po.outstandingBase, storeCurrency, numberLocale)}
                        </>
                      ) : null}
                    </p>
                  </div>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
                </div>
                <div className="mt-2">
                  <div className="space-y-1 text-[11px] text-slate-600">
                    {/* Timeline based on status */}
                    {po.status === "DRAFT" && (
                      <div>
                        {t(uiLocale, "purchase.timeline.createdAt")}{" "}
                        {formatDate(po.createdAt, dateLocale)}
                      </div>
                    )}
                    {po.status === "ORDERED" && (
                      <div>
                        {t(uiLocale, "purchase.timeline.createdAt")}{" "}
                        {formatDate(po.createdAt, dateLocale)}
                        {po.orderedAt && (
                          <>
                            {" "}
                            → {t(uiLocale, "purchase.timeline.orderedAt")}{" "}
                            {formatDate(po.orderedAt, dateLocale)}
                          </>
                        )}
                      </div>
                    )}
                    {po.status === "SHIPPED" && (
                      <div>
                        {t(uiLocale, "purchase.timeline.createdAt")}{" "}
                        {formatDate(po.createdAt, dateLocale)}
                        {po.shippedAt && (
                          <>
                            {" "}
                            → {t(uiLocale, "purchase.timeline.shippedAt")}{" "}
                            {formatDate(po.shippedAt, dateLocale)}
                          </>
                        )}
                        {po.expectedAt && (
                          <>
                            {" "}
                            → {t(uiLocale, "purchase.timeline.expectedAt")}{" "}
                            {formatDate(po.expectedAt, dateLocale)}
                          </>
                        )}
                      </div>
                    )}
                    {po.status === "RECEIVED" && (
                      <div>
                        {t(uiLocale, "purchase.timeline.createdAt")}{" "}
                        {formatDate(po.createdAt, dateLocale)}
                        {po.shippedAt && (
                          <>
                            {" "}
                            → {t(uiLocale, "purchase.timeline.shippedAt")}{" "}
                            {formatDate(po.shippedAt, dateLocale)}
                          </>
                        )}
                        {po.receivedAt && (
                          <>
                            {" "}
                            → {t(uiLocale, "purchase.timeline.receivedAt")}{" "}
                            {formatDate(po.receivedAt, dateLocale)}
                          </>
                        )}
                      </div>
                    )}
                    {po.status === "CANCELLED" && (
                      <div>
                        {t(uiLocale, "purchase.timeline.createdAt")}{" "}
                        {formatDate(po.createdAt, dateLocale)}{" "}
                        {po.cancelledAt && (
                          <>
                            ·{" "}
                            <span className="text-red-600">
                              {t(uiLocale, "purchase.timeline.cancelledAt")}{" "}
                              {formatDate(po.cancelledAt, dateLocale)}
                            </span>
                          </>
                        )}
                        {!po.cancelledAt && (
                          <>
                            ·{" "}
                            <span className="text-red-600">
                              {t(uiLocale, "purchase.status.cancelled")}
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {remaining !== null && (
                  <div className="mt-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">
                        {t(uiLocale, "purchase.progress.label")}
                      </span>
                      <span
                        className={
                          remaining <= 0
                            ? "font-medium text-red-600"
                            : remaining <= 3
                              ? "font-medium text-amber-600"
                              : "text-slate-500"
                        }
                      >
                        {remaining <= 0
                          ? t(uiLocale, "purchase.progress.overdue")
                          : `${t(uiLocale, "purchase.progress.remainingPrefix")} ${remaining.toLocaleString(numberLocale)} ${t(uiLocale, "purchase.progress.remainingSuffix")}`}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full transition-all ${
                          remaining <= 0
                            ? "bg-red-500"
                            : remaining <= 3
                              ? "bg-amber-400"
                              : "bg-emerald-400"
                        }`}
                        style={{
                          width: `${Math.min(100, Math.max(5, 100 - remaining * 5))}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </button>
            );
          })}
          {hasMore && (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-4">
              <Button
                type="button"
                variant="outline"
                className="h-9 px-4 text-xs"
                onClick={loadMore}
                disabled={isLoadingMore}
              >
                {isLoadingMore
                  ? t(uiLocale, "purchase.list.loadingMore")
                  : t(uiLocale, "purchase.list.loadMore")}
              </Button>
              <div ref={loadMoreRef} className="h-2 w-full" />
            </div>
          )}
        </div>
      )}
      </>
      ) : null}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       * SlideUpSheet — Create PO Wizard
       * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
	      <SlideUpSheet
	        isOpen={isCreateOpen}
	        onClose={closeCreateSheet}
	        title={t(uiLocale, "purchase.create")}
	        description={`${t(uiLocale, "purchase.createWizard.step.prefix")} ${wizardStep}/3`}
	        closeOnBackdrop={false}
	        disabled={isSubmitting}
	        footer={
	          <Button
	            type="button"
	            variant="outline"
	            className="h-11 w-full rounded-xl"
	            onClick={closeCreateSheet}
	            disabled={isSubmitting}
	          >
	            {t(uiLocale, "common.action.cancel")}
	          </Button>
	        }
	      >
	            {/* Step 1: Info */}
	            {wizardStep === 1 && (
	              <div className="space-y-3">
	                <div className="space-y-2">
	                  <div className="flex items-center justify-between gap-2">
	                    <label className="text-xs text-muted-foreground">
	                      {t(uiLocale, "purchase.createWizard.supplierName.labelOptional")}
	                    </label>
	                    {supplierNameOptions.length > 0 ? (
	                      <button
	                        type="button"
	                        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
	                        onClick={() => setIsSupplierPickerOpen((current) => !current)}
	                      >
	                        {isSupplierPickerOpen
	                          ? t(uiLocale, "purchase.createWizard.supplierName.toggle.hide")
	                          : t(uiLocale, "purchase.createWizard.supplierName.toggle.show")}
	                      </button>
	                    ) : null}
	                  </div>
	                  <input
	                    className={fieldClassName}
                    value={supplierName}
                    onFocus={() => {
                      if (supplierNameOptions.length > 0) {
                        setIsSupplierPickerOpen(true);
                      }
                    }}
                    onChange={(e) => {
                      setSupplierName(e.target.value);
                      if (supplierNameOptions.length > 0) {
                        setIsSupplierPickerOpen(true);
	                      }
	                    }}
	                    placeholder={t(uiLocale, "purchase.createWizard.supplierName.placeholder")}
	                  />
	                  {supplierNameOptions.length > 0 ? (
	                    <p className="text-[11px] text-slate-500">
	                      {t(uiLocale, "purchase.createWizard.supplierName.help")}
	                    </p>
	                  ) : null}
	                  {supplierNameOptions.length > 0 && (isSupplierPickerOpen || supplierName) ? (
	                    <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-200 bg-white">
	                      {visibleSupplierPickerOptions.length === 0 ? (
	                        <p className="px-3 py-2 text-xs text-slate-400">
	                          {t(uiLocale, "purchase.createWizard.supplierName.noMatches")}
	                        </p>
	                      ) : (
	                        visibleSupplierPickerOptions.map((name) => (
	                          <button
	                            key={name}
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                            onClick={() => {
                              setSupplierName(name);
                              setIsSupplierPickerOpen(false);
                            }}
                          >
                            {name}
                          </button>
                        ))
                      )}
                    </div>
                  ) : null}
	                </div>
	                <div className="space-y-2">
	                  <label className="text-xs text-muted-foreground">
	                    {t(uiLocale, "purchase.createWizard.supplierContact.labelOptional")}
	                  </label>
	                  <input
	                    className={fieldClassName}
	                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    enterKeyHint="next"
                    value={supplierContact}
                    onChange={(e) => setSupplierContact(e.target.value)}
                    placeholder="020-xxxx-xxxx"
                  />
	                </div>
	                <div className="space-y-2">
	                  <label className="text-xs text-muted-foreground">
	                    {t(uiLocale, "purchase.createWizard.purchaseCurrency.label")}
	                  </label>
	                  <div className="flex gap-2">
	                    {(["LAK", "THB", "USD"] as StoreCurrency[]).map((c) => (
	                      <button
                        key={c}
                        type="button"
                        className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                          purchaseCurrency === c
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                        onClick={() => {
                          setPurchaseCurrency(c);
                          if (c === storeCurrency) {
                            setExchangeRate("");
                          }
                        }}
                      >
                        {currencySymbol(c)} {c}
                      </button>
                    ))}
                  </div>
	                </div>
	                {purchaseCurrency !== storeCurrency && (
	                  <div className="space-y-2">
	                    <label className="text-xs text-muted-foreground">
	                      {t(uiLocale, "purchase.createWizard.exchangeRate.labelOptional")}
	                    </label>
	                    <input
	                      className={fieldClassName}
	                      type="number"
	                      inputMode="decimal"
	                      value={exchangeRate}
	                      onChange={(e) => setExchangeRate(e.target.value)}
	                      placeholder={`${t(uiLocale, "common.examplePrefix")} 600 (1 ${purchaseCurrency} = ? ${storeCurrency})`}
	                    />
	                    <p className="text-[11px] text-slate-500">
	                      {t(uiLocale, "purchase.createWizard.exchangeRate.help.prefix")}{" "}
	                      <span className="font-medium">
	                        {t(uiLocale, "purchase.action.finalizeRate")}
	                      </span>{" "}
	                      {t(uiLocale, "purchase.createWizard.exchangeRate.help.suffix")}
	                    </p>
	                  </div>
	                )}
	                <Button
	                  className="h-11 w-full rounded-xl"
                  onClick={() => {
                    setIsSupplierPickerOpen(false);
                    setWizardStep(2);
	                  }}
	                >
	                  {t(uiLocale, "common.action.next")} →
	                </Button>
	              </div>
	            )}

            {/* Step 2: Items */}
            {wizardStep === 2 && (
              <div className="space-y-3">
                {/* Product search */}
	                <div className="space-y-2">
	                  <div className="flex items-center justify-between gap-2">
	                    <label className="text-xs text-muted-foreground">
	                      {t(uiLocale, "purchase.createWizard.items.add")}
	                    </label>
	                    <button
	                      type="button"
	                      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                      onClick={() => {
                        const nextOpen = !isProductPickerOpen;
                        setIsProductPickerOpen(nextOpen);
                        if (nextOpen) {
                          void loadProducts();
                        }
	                      }}
	                    >
	                      {isProductPickerOpen
	                        ? t(uiLocale, "purchase.createWizard.items.toggle.hide")
	                        : t(uiLocale, "purchase.createWizard.items.toggle.show")}
	                    </button>
	                  </div>
	                  <input
	                    className={fieldClassName}
                    value={productSearch}
                    onFocus={() => {
                      setIsProductPickerOpen(true);
                      void loadProducts();
                    }}
                    onChange={(e) => {
	                      setProductSearch(e.target.value);
	                      setIsProductPickerOpen(true);
	                    }}
	                    placeholder={t(uiLocale, "purchase.createWizard.items.search.placeholder")}
	                  />
	                  <p className="text-[11px] text-slate-500">
	                    {t(uiLocale, "purchase.createWizard.items.search.help")}
	                  </p>
	                  {(isProductPickerOpen || productSearch) && (
	                    <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-200 bg-white">
	                      {loadingProducts ? (
	                        <p className="px-3 py-2 text-xs text-slate-400">
	                          {t(uiLocale, "common.loading")}
	                        </p>
	                      ) : visibleProductPickerOptions.length === 0 ? (
	                        <p className="px-3 py-2 text-xs text-slate-400">
	                          {productSearch
	                            ? t(uiLocale, "purchase.createWizard.items.search.noMatches")
	                            : t(uiLocale, "purchase.createWizard.items.search.empty")}
	                        </p>
	                      ) : (
	                        visibleProductPickerOptions.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                            onClick={() => addItem(p)}
                          >
                            <span className="font-medium">{p.name}</span>
                            <span className="ml-2 text-xs text-slate-400">
                              {p.sku}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

	                {/* Item list */}
	                {items.length === 0 ? (
	                  <p className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-400">
	                    {t(uiLocale, "purchase.createWizard.items.empty")}
	                  </p>
	                ) : (
	                  <div className="space-y-2">
                    {items.map((item) => (
                      <div
                        key={item.productId}
                        className="rounded-xl border border-slate-200 bg-white p-3"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-medium text-slate-900">
                              {item.productName}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {item.productSku}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="rounded-full p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                            onClick={() => removeItem(item.productId)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="mt-2 space-y-2">
                          <div>
                            <label className="text-[11px] text-slate-500">
                              {t(uiLocale, "purchase.field.purchaseUnit")}
                            </label>
                            <select
                              className="h-9 w-full rounded-lg border border-slate-200 px-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                              value={item.unitId}
                              onChange={(e) =>
                                updateItem(
                                  item.productId,
                                  "unitId",
                                  e.target.value,
                                )
                              }
                            >
                              {(productOptionMap.get(item.productId)?.unitOptions ?? []).map(
                                (option) => (
                                  <option key={option.unitId} value={option.unitId}>
                                    {getPurchaseUnitLabel(
                                      option.unitCode,
                                      option.unitNameTh,
                                    )}
                                  </option>
                                ),
                              )}
                            </select>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
	                          <div>
	                            <label className="text-[11px] text-slate-500">
	                              {t(uiLocale, "purchase.field.qty")}
	                            </label>
                            <input
                              className="h-9 w-full rounded-lg border border-slate-200 px-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                              type="number"
                              inputMode="numeric"
                              value={item.qtyOrdered}
                              onChange={(e) =>
                                updateItem(
                                  item.productId,
                                  "qtyOrdered",
                                  e.target.value,
                                )
                              }
                            />
                          </div>
	                          <div>
	                            <label className="text-[11px] text-slate-500">
	                              {t(uiLocale, "purchase.field.unitPrice.prefix")}
	                              {currencySymbol(purchaseCurrency)}
	                            </label>
                            <input
                              className="h-9 w-full rounded-lg border border-slate-200 px-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                              type="number"
                              inputMode="numeric"
                              value={item.unitCostPurchase}
                              placeholder="0"
                              onChange={(e) =>
                                updateItem(
                                  item.productId,
                                  "unitCostPurchase",
                                  e.target.value,
                                )
                              }
                            />
                          </div>
                        </div>
                        </div>
                        <p className="mt-2 text-[11px] text-slate-500">
                          {t(uiLocale, "purchase.field.baseQty")} ={" "}
                          {(
                            (Number(item.qtyOrdered) || 0) * item.multiplierToBase
                          ).toLocaleString(numberLocale)}{" "}
                          {item.baseUnitCode}
                        </p>
                        <p className="mt-1 text-right text-xs text-slate-500">
                          ={" "}
                          {fmtPrice(
                            Math.round(
                              (Number(item.qtyOrdered) || 0) *
                                (Number(item.unitCostPurchase) || 0) *
                                effectiveRate,
                            ),
                            storeCurrency,
                            numberLocale,
                          )}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

	                <div className="flex gap-2">
	                  <Button
	                    variant="outline"
	                    className="h-11 flex-1 rounded-xl"
	                    onClick={() => setWizardStep(1)}
	                  >
	                    ← {t(uiLocale, "nav.back")}
	                  </Button>
	                  <Button
	                    className="h-11 flex-1 rounded-xl"
	                    onClick={() => setWizardStep(3)}
	                    disabled={items.length === 0}
	                  >
	                    {t(uiLocale, "common.action.next")} →
	                  </Button>
	                </div>
	              </div>
	            )}

            {/* Step 3: Costs + Summary */}
            {wizardStep === 3 && (
              <div className="space-y-3">
	                <div className="grid grid-cols-2 gap-3">
	                  <div className="space-y-2">
	                    <label className="text-xs text-muted-foreground">
	                      {t(uiLocale, "purchase.field.shippingCost.label")} ({currencySymbol(storeCurrency)})
	                    </label>
                    <input
                      className={fieldClassName}
                      type="number"
                      inputMode="numeric"
                      value={shippingCost}
                      placeholder="0"
                      onChange={(e) => setShippingCost(e.target.value)}
                    />
                  </div>
	                  <div className="space-y-2">
	                    <label className="text-xs text-muted-foreground">
	                      {t(uiLocale, "purchase.field.otherCost.label")} ({currencySymbol(storeCurrency)})
	                    </label>
                    <input
                      className={fieldClassName}
                      type="number"
                      inputMode="numeric"
                      value={otherCost}
                      placeholder="0"
                      onChange={(e) => setOtherCost(e.target.value)}
                    />
                  </div>
                </div>
	                {Number(otherCost) > 0 && (
	                  <div className="space-y-2">
	                    <label className="text-xs text-muted-foreground">
	                      {t(uiLocale, "purchase.field.otherCostNote.label")}
	                    </label>
                    <input
	                      className={fieldClassName}
	                      value={otherCostNote}
	                      onChange={(e) => setOtherCostNote(e.target.value)}
	                      placeholder={`${t(uiLocale, "common.examplePrefix")} ${t(uiLocale, "purchase.field.otherCostNote.placeholderExample")}`}
	                    />
	                  </div>
	                )}
	                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
	                  <div className="space-y-2 min-w-0">
	                    <label className="text-xs text-muted-foreground">
	                      {t(uiLocale, "purchase.createWizard.expectedAt.labelOptional")}
	                    </label>
                    <PurchaseDatePickerField
                      uiLocale={uiLocale}
	                      value={expectedAt}
	                      onChange={setExpectedAt}
	                      triggerClassName={`${fieldClassName} flex items-center justify-between gap-2 text-left`}
	                      ariaLabel={t(uiLocale, "purchase.createWizard.expectedAt.aria")}
	                    />
	                    <p className="text-[11px] text-slate-500">
	                      {t(uiLocale, "purchase.createWizard.expectedAt.help")}
	                    </p>
                    <div className="flex flex-wrap gap-1.5">
	                      <button
                        type="button"
                        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                        onClick={() => applyCreateDateShortcut("expectedAt", "TODAY")}
	                      >
	                        {t(uiLocale, "purchase.dateShortcut.today")}
	                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                        onClick={() => applyCreateDateShortcut("expectedAt", "PLUS_7")}
	                      >
	                        {t(uiLocale, "purchase.dateShortcut.plus7")}
	                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                        onClick={() => applyCreateDateShortcut("expectedAt", "END_OF_MONTH")}
	                      >
	                        {t(uiLocale, "purchase.dateShortcut.endOfMonth")}
	                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                        onClick={() => applyCreateDateShortcut("expectedAt", "CLEAR")}
	                      >
	                        {t(uiLocale, "purchase.dateShortcut.clear")}
	                      </button>
                    </div>
                  </div>
	                  <div className="space-y-2 min-w-0">
	                    <label className="text-xs text-muted-foreground">
	                      {t(uiLocale, "purchase.createWizard.dueDate.label")}
	                    </label>
                    <PurchaseDatePickerField
                      uiLocale={uiLocale}
	                      value={dueDate}
	                      onChange={setDueDate}
	                      triggerClassName={`${fieldClassName} flex items-center justify-between gap-2 text-left`}
	                      ariaLabel={t(uiLocale, "purchase.createWizard.dueDate.aria")}
	                    />
	                    <p className="text-[11px] text-slate-500">
	                      {t(uiLocale, "purchase.createWizard.dueDate.help")}
	                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                        onClick={() => applyCreateDateShortcut("dueDate", "TODAY")}
	                      >
	                        {t(uiLocale, "purchase.dateShortcut.today")}
	                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                        onClick={() => applyCreateDateShortcut("dueDate", "PLUS_7")}
	                      >
	                        {t(uiLocale, "purchase.dateShortcut.plus7")}
	                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                        onClick={() => applyCreateDateShortcut("dueDate", "END_OF_MONTH")}
	                      >
	                        {t(uiLocale, "purchase.dateShortcut.endOfMonth")}
	                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                        onClick={() => applyCreateDateShortcut("dueDate", "CLEAR")}
	                      >
	                        {t(uiLocale, "purchase.dateShortcut.clear")}
	                      </button>
                    </div>
                  </div>
                </div>
	                <div className="space-y-2">
	                  <label className="text-xs text-muted-foreground">
	                    {t(uiLocale, "purchase.createWizard.note.labelOptional")}
	                  </label>
	                  <input
	                    className={fieldClassName}
	                    value={note}
	                    onChange={(e) => setNote(e.target.value)}
	                    placeholder={t(uiLocale, "purchase.createWizard.note.placeholder")}
	                  />
	                </div>

                {/* Summary */}
	                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
	                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
	                    {t(uiLocale, "purchase.createWizard.summary.title")}
	                  </p>
	                  {purchaseCurrency !== storeCurrency && !hasExchangeRateInput && (
	                    <p className="mt-1 text-[11px] text-amber-700">
	                      {t(uiLocale, "purchase.createWizard.summary.pendingRateHint")}
	                    </p>
	                  )}
	                  <div className="mt-2 space-y-1 text-sm">
	                    <div className="flex justify-between">
	                      <span className="text-slate-600">
	                        {t(uiLocale, "purchase.summary.products")} ({items.length}{" "}
	                        {t(uiLocale, "purchase.items")})
	                      </span>
                        <CurrencyAmountStack
                          primaryAmount={
                            purchaseCurrency === storeCurrency
                              ? itemsTotalBase
                              : itemsTotalPurchase
                          }
                          primaryCurrency={
                            purchaseCurrency === storeCurrency
                              ? storeCurrency
                              : purchaseCurrency
                          }
                          secondaryAmount={
                            purchaseCurrency === storeCurrency ? null : itemsTotalBase
                          }
                          secondaryCurrency={
                            purchaseCurrency === storeCurrency ? null : storeCurrency
                          }
                          numberLocale={numberLocale}
                        />
	                    </div>
	                    {shipping > 0 && (
	                      <div className="flex justify-between">
	                        <span className="text-slate-600">
	                          {t(uiLocale, "purchase.summary.shipping")}
	                        </span>
	                        <span>{fmtPrice(shipping, storeCurrency, numberLocale)}</span>
	                      </div>
	                    )}
	                    {other > 0 && (
	                      <div className="flex justify-between">
	                        <span className="text-slate-600">
	                          {t(uiLocale, "purchase.summary.other")}
	                        </span>
	                        <span>{fmtPrice(other, storeCurrency, numberLocale)}</span>
	                      </div>
	                    )}
	                    <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold">
	                      <span>{t(uiLocale, "purchase.summary.total")}</span>
	                      <span>{fmtPrice(grandTotal, storeCurrency, numberLocale)}</span>
	                    </div>
	                  </div>
	                </div>

                {/* Action buttons */}
	                <Button
	                  variant="outline"
	                  className="h-11 w-full rounded-xl"
	                  onClick={() => setWizardStep(2)}
	                  disabled={isSubmitting}
	                >
	                  ← {t(uiLocale, "nav.back")}
	                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    className="h-11 rounded-xl text-xs"
                    onClick={() => submitPO(false)}
                    disabled={isSubmitting}
	                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileText className="mr-1 h-3.5 w-3.5" />
                    )}
	                    {t(uiLocale, "purchase.createWizard.cta.saveDraft")}
	                  </Button>
                  <Button
                    className="h-11 rounded-xl bg-emerald-600 text-xs text-white hover:bg-emerald-700"
                    onClick={() => submitPO(true)}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                    )}
	                    {t(uiLocale, "purchase.createWizard.cta.receiveNow")}
	                  </Button>
	                </div>
                <Button
                  className="h-11 w-full rounded-xl"
	                  onClick={async () => {
	                    if (items.length === 0) {
	                      toast.error(t(uiLocale, "purchase.create.validation.itemsRequired"));
	                      return;
	                    }
                    setIsSubmitting(true);
                    try {
                      const res = await authFetch("/api/stock/purchase-orders", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          supplierName: supplierName || undefined,
                          supplierContact: supplierContact || undefined,
                          purchaseCurrency,
                          exchangeRate:
                            purchaseCurrency === storeCurrency
                              ? 1
                              : hasExchangeRateInput
                                ? rate
                                : undefined,
                          shippingCost: shipping,
                          otherCost: other,
                          otherCostNote: otherCostNote || undefined,
                          note: note || undefined,
                          expectedAt: expectedAt || undefined,
                          dueDate: dueDate || undefined,
                          receiveImmediately: false,
                          items: items.map((i) => ({
                            productId: i.productId,
                            unitId: i.unitId,
                            qtyOrdered: Number(i.qtyOrdered) || 1,
                            unitCostPurchase: Number(i.unitCostPurchase) || 0,
                          })),
                        }),
                      });
	                      const data = await res.json();
	                      if (!res.ok) {
	                        toast.error(data?.message ?? t(uiLocale, "purchase.create.error.failed"));
	                        return;
	                      }
                      // Now set it to ORDERED
                      const poId = data.purchaseOrder.id;
                      await authFetch(`/api/stock/purchase-orders/${poId}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ status: "ORDERED" }),
                      });
	                      toast.success(t(uiLocale, "purchase.create.toast.successOrdered"));
	                      forceCloseCreateSheet();
	                      await reloadFirstPage();
	                      router.refresh();
	                    } catch {
	                      toast.error(t(uiLocale, "purchase.error.serverUnreachable"));
	                    } finally {
	                      setIsSubmitting(false);
	                    }
	                  }}
	                  disabled={isSubmitting}
	                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Package className="mr-1 h-3.5 w-3.5" />
                  )}
	                  {t(uiLocale, "purchase.createWizard.cta.confirmOrder")}
	                </Button>
	              </div>
	            )}
	      </SlideUpSheet>

	      {isCreateOpen && isCreateCloseConfirmOpen ? (
	        <div className="fixed inset-0 z-[90] flex items-center justify-center px-4">
	          <button
	            type="button"
	            aria-label={t(uiLocale, "purchase.createWizard.closeConfirm.backdropAria")}
	            className="absolute inset-0 bg-slate-900/55"
	            onClick={() => setIsCreateCloseConfirmOpen(false)}
	          />
	          <div
	            role="dialog"
	            aria-modal="true"
	            aria-label={t(uiLocale, "purchase.createWizard.closeConfirm.dialogAria")}
	            className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"
	          >
	            <p className="text-sm font-semibold text-slate-900">
	              {t(uiLocale, "purchase.createWizard.closeConfirm.title")}
	            </p>
	            <p className="mt-2 text-xs text-slate-600">
	              {t(uiLocale, "purchase.createWizard.closeConfirm.description")}
	            </p>
	            <div className="mt-4 grid grid-cols-2 gap-2">
	              <Button
	                type="button"
	                variant="outline"
	                className="h-9 rounded-lg text-xs"
	                onClick={() => setIsCreateCloseConfirmOpen(false)}
	              >
	                {t(uiLocale, "purchase.createWizard.closeConfirm.cta.backToEdit")}
	              </Button>
	              <Button
	                type="button"
	                className="h-9 rounded-lg bg-red-600 text-xs text-white hover:bg-red-700"
	                onClick={forceCloseCreateSheet}
	              >
	                {t(uiLocale, "purchase.createWizard.closeConfirm.cta.discard")}
	              </Button>
	            </div>
	          </div>
	        </div>
	      ) : null}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       * PO Detail Sheet (quick actions)
       * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <PODetailSheet
        poId={selectedPO}
        storeCurrency={storeCurrency}
        storeLogoUrl={storeLogoUrl}
        pdfConfig={pdfConfig}
        productOptions={productOptions}
        loadProducts={loadProducts}
        getCachedPoDetail={getCachedPoDetail}
        loadPoDetail={loadPoDetail}
        onCacheUpdate={upsertPoDetailCache}
        onRefreshList={reloadFirstPage}
        onClose={() => setSelectedPO(null)}
        onUpdateStatus={updateStatus}
      />
    </div>
  );
}

/* ── PO Detail Sheet ── */
function PODetailSheet({
  poId,
  storeCurrency,
  storeLogoUrl,
  pdfConfig,
  productOptions,
  loadProducts,
  getCachedPoDetail,
  loadPoDetail,
  onCacheUpdate,
  onRefreshList,
  onClose,
  onUpdateStatus,
}: {
  poId: string | null;
  storeCurrency: StoreCurrency;
  storeLogoUrl?: string | null;
  pdfConfig?: Partial<PoPdfConfig>;
  productOptions: PurchaseProductOption[];
  loadProducts: () => Promise<void>;
  getCachedPoDetail: (poId: string) => PurchaseOrderDetail | null;
  loadPoDetail: (
    poId: string,
    options?: {
      preferCache?: boolean;
    },
  ) => Promise<PoDetailLoadResult>;
  onCacheUpdate: (purchaseOrder: PurchaseOrderDetail) => void;
  onRefreshList: () => Promise<void>;
  onClose: () => void;
  onUpdateStatus: (
    poId: string,
    status: "ORDERED" | "SHIPPED" | "RECEIVED" | "CANCELLED",
  ) => void;
}) {
  const router = useRouter();
  const uiLocale = useUiLocale();
  const dateLocale = uiLocaleToDateLocale(uiLocale);
  const numberLocale = dateLocale;
  const statusConfig = useMemo(() => getPurchaseStatusConfig(uiLocale), [uiLocale]);
  const productOptionMap = useMemo(
    () => new Map(productOptions.map((product) => [product.id, product])),
    [productOptions],
  );

  const [po, setPo] = useState<PurchaseOrderDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isFinalizeRateMode, setIsFinalizeRateMode] = useState(false);
  const [isFinalizingRate, setIsFinalizingRate] = useState(false);
  const [finalRateInput, setFinalRateInput] = useState("");
  const [finalRateNoteInput, setFinalRateNoteInput] = useState("");
  const [isSettleMode, setIsSettleMode] = useState(false);
  const [isSettlingPayment, setIsSettlingPayment] = useState(false);
  const [isApplyExtraCostMode, setIsApplyExtraCostMode] = useState(false);
  const [isApplyingExtraCost, setIsApplyingExtraCost] = useState(false);
  const [extraCostShippingInput, setExtraCostShippingInput] = useState("");
  const [extraCostOtherInput, setExtraCostOtherInput] = useState("");
  const [extraCostOtherNoteInput, setExtraCostOtherNoteInput] = useState("");
  const [reversingPaymentId, setReversingPaymentId] = useState<string | null>(null);
  const [settleAmountInput, setSettleAmountInput] = useState("");
  const [settlePaidAtInput, setSettlePaidAtInput] = useState("");
  const [settleReferenceInput, setSettleReferenceInput] = useState("");
  const [settleNoteInput, setSettleNoteInput] = useState("");
  const [editForm, setEditForm] = useState({
    supplierName: "",
    supplierContact: "",
    purchaseCurrency: storeCurrency,
    exchangeRate: "1",
    shippingCost: "0",
    otherCost: "0",
    otherCostNote: "",
    note: "",
    expectedAt: "",
    dueDate: "",
    trackingInfo: "",
    items: [] as DraftPurchaseItem[],
  });

  const getEditDateShortcutValue = useCallback(
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

  const applyEditDateShortcut = useCallback(
    (
      field: "expectedAt" | "dueDate",
      shortcut: "TODAY" | "PLUS_7" | "END_OF_MONTH" | "CLEAR",
    ) => {
      const value = getEditDateShortcutValue(shortcut);
      setEditForm((prev) => ({
        ...prev,
        [field]: value,
      }));
    },
    [getEditDateShortcutValue],
  );

  const refreshDetail = useCallback(
    async (targetPoId: string, keepExisting: boolean): Promise<void> => {
      const result = await loadPoDetail(targetPoId, { preferCache: false });
      if (result.purchaseOrder) {
        setPo(result.purchaseOrder);
        setDetailError(null);
        return;
      }
	      if (!keepExisting) {
	        setPo(null);
	        setDetailError(result.error ?? t(uiLocale, "purchase.detail.error.loadFailed"));
	      }
	    },
	    [loadPoDetail, uiLocale],
	  );

  useEffect(() => {
    if (!poId) {
      setLoading(false);
      setPo(null);
      setDetailError(null);
      setIsEditMode(false);
      setIsFinalizeRateMode(false);
      setIsSettleMode(false);
      setIsApplyExtraCostMode(false);
      setFinalRateInput("");
      setFinalRateNoteInput("");
      setSettleAmountInput("");
      setSettlePaidAtInput("");
      setSettleReferenceInput("");
      setSettleNoteInput("");
      setExtraCostShippingInput("");
      setExtraCostOtherInput("");
      setExtraCostOtherNoteInput("");
      setReversingPaymentId(null);
      return;
    }

    let cancelled = false;
    const cached = getCachedPoDetail(poId);
    setIsEditMode(false);
    setIsFinalizeRateMode(false);
    setIsSettleMode(false);
    setIsApplyExtraCostMode(false);
    setReversingPaymentId(null);
    setDetailError(null);

    if (cached) {
      setPo(cached);
      setLoading(false);
      void loadPoDetail(poId, { preferCache: false }).then((result) => {
        if (cancelled || !result.purchaseOrder) return;
        setPo(result.purchaseOrder);
        setDetailError(null);
      });
      return () => {
        cancelled = true;
      };
    }

    setPo(null);
    setLoading(true);
    void loadPoDetail(poId).then((result) => {
      if (cancelled) return;
      if (result.purchaseOrder) {
        setPo(result.purchaseOrder);
        setDetailError(null);
	      } else {
	        setPo(null);
	        setDetailError(result.error ?? t(uiLocale, "purchase.detail.error.loadFailed"));
	      }
	      setLoading(false);
	    });

    return () => {
      cancelled = true;
    };
	  }, [getCachedPoDetail, loadPoDetail, poId, uiLocale]);

  const poPurchaseCurrency = useMemo(
    () => parseStoreCurrency(po?.purchaseCurrency, storeCurrency),
    [po?.purchaseCurrency, storeCurrency],
  );
  const poItemsTotalPurchase = useMemo(
    () =>
      po
        ? po.items.reduce(
            (sum, item) => sum + item.unitCostPurchase * item.qtyOrdered,
            0,
          )
        : 0,
    [po],
  );

  const handleStatusChange = async (
    newStatus: "ORDERED" | "SHIPPED" | "RECEIVED" | "CANCELLED",
  ) => {
    if (!po) return;
    setUpdating(true);
    await onUpdateStatus(po.id, newStatus);
    setUpdating(false);
  };

  const retryLoadDetail = useCallback(async () => {
    if (!poId) return;
    setLoading(true);
    setDetailError(null);
    await refreshDetail(poId, false);
    setLoading(false);
  }, [poId, refreshDetail]);

  const startFinalizeRate = useCallback(() => {
    if (!po) return;
    setFinalRateInput(
      po.exchangeRate > 1 || po.purchaseCurrency === storeCurrency
        ? String(po.exchangeRate)
        : "",
    );
    setFinalRateNoteInput("");
    setIsFinalizeRateMode(true);
  }, [po, storeCurrency]);

  const submitFinalizeRate = useCallback(async () => {
    if (!po) return;
	    const nextRate = Number(finalRateInput);
	    if (!Number.isFinite(nextRate) || nextRate <= 0) {
	      toast.error(t(uiLocale, "purchase.detail.finalizeRate.validation.invalidExchangeRate"));
	      return;
	    }

    setIsFinalizingRate(true);
    try {
      const res = await authFetch(
        `/api/stock/purchase-orders/${po.id}/finalize-rate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": `po-rate-lock-${po.id}-${Date.now()}`,
          },
          body: JSON.stringify({
            exchangeRate: nextRate,
            note: finalRateNoteInput || undefined,
          }),
        },
      );
      const data = (await res.json().catch(() => null)) as
        | {
            message?: string;
            purchaseOrder?: PurchaseOrderDetail;
          }
        | null;
	      if (!res.ok) {
	        toast.error(data?.message ?? t(uiLocale, "purchase.detail.finalizeRate.error.failed"));
	        return;
	      }

      const updatedPo = data?.purchaseOrder;
      if (updatedPo) {
        setPo(updatedPo);
        onCacheUpdate(updatedPo);
      }
	      setIsFinalizeRateMode(false);
	      setFinalRateNoteInput("");
	      toast.success(t(uiLocale, "purchase.detail.finalizeRate.toast.success"));
	      await onRefreshList();
	      router.refresh();
	    } catch {
	      toast.error(t(uiLocale, "purchase.error.serverUnreachable"));
	    } finally {
	      setIsFinalizingRate(false);
	    }
	  }, [
	    finalRateInput,
	    finalRateNoteInput,
	    onCacheUpdate,
	    onRefreshList,
	    po,
	    router,
	    uiLocale,
	  ]);

  const startSettlePayment = useCallback(() => {
    if (!po) return;
    const today = new Date().toISOString().slice(0, 10);
    setSettleAmountInput(String(Math.max(0, po.outstandingBase)));
    setSettlePaidAtInput(today);
    setSettleReferenceInput("");
    setSettleNoteInput("");
    setIsSettleMode(true);
  }, [po]);

	  const submitSettlePayment = useCallback(async () => {
	    if (!po) return;
	    const amountBase = Math.round(Number(settleAmountInput));
	    if (!Number.isFinite(amountBase) || amountBase <= 0) {
	      toast.error(t(uiLocale, "purchase.detail.settle.validation.amountInvalid"));
	      return;
	    }
	    if (amountBase > po.outstandingBase) {
	      toast.error(t(uiLocale, "purchase.detail.settle.validation.amountTooHigh"));
	      return;
	    }
    setIsSettlingPayment(true);
    try {
      const res = await authFetch(`/api/stock/purchase-orders/${po.id}/settle`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `po-settle-${po.id}-${Date.now()}`,
        },
        body: JSON.stringify({
          amountBase,
          paidAt: settlePaidAtInput || undefined,
          paymentReference: settleReferenceInput || undefined,
          paymentNote: settleNoteInput || undefined,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | {
            message?: string;
            purchaseOrder?: PurchaseOrderDetail;
          }
        | null;

	      if (!res.ok) {
	        toast.error(data?.message ?? t(uiLocale, "purchase.detail.settle.error.failed"));
	        return;
	      }

      const updatedPo = data?.purchaseOrder;
      if (updatedPo) {
        setPo(updatedPo);
        onCacheUpdate(updatedPo);
	      }
	      setIsSettleMode(false);
	      toast.success(t(uiLocale, "purchase.detail.settle.toast.success"));
	      await onRefreshList();
	      router.refresh();
	    } catch {
	      toast.error(t(uiLocale, "purchase.error.serverUnreachable"));
	    } finally {
	      setIsSettlingPayment(false);
	    }
	  }, [
	    onCacheUpdate,
	    onRefreshList,
	    po,
	    router,
	    settleAmountInput,
	    settleNoteInput,
	    settlePaidAtInput,
	    settleReferenceInput,
	    uiLocale,
	  ]);

  const startApplyExtraCost = useCallback(() => {
    if (!po) return;
    setExtraCostShippingInput(String(Math.max(0, po.shippingCost)));
    setExtraCostOtherInput(String(Math.max(0, po.otherCost)));
    setExtraCostOtherNoteInput(po.otherCostNote ?? "");
    setIsApplyExtraCostMode(true);
  }, [po]);

  const submitApplyExtraCost = useCallback(async () => {
    if (!po) return;
    const shippingCost = Math.round(Number(extraCostShippingInput));
    const otherCost = Math.round(Number(extraCostOtherInput));

	    if (!Number.isFinite(shippingCost) || shippingCost < 0) {
	      toast.error(t(uiLocale, "purchase.detail.extraCost.validation.shippingInvalid"));
	      return;
	    }
	    if (!Number.isFinite(otherCost) || otherCost < 0) {
	      toast.error(t(uiLocale, "purchase.detail.extraCost.validation.otherInvalid"));
	      return;
	    }

    setIsApplyingExtraCost(true);
    try {
      const res = await authFetch(
        `/api/stock/purchase-orders/${po.id}/apply-extra-cost`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": `po-extra-cost-${po.id}-${Date.now()}`,
          },
          body: JSON.stringify({
            shippingCost,
            otherCost,
            otherCostNote: extraCostOtherNoteInput || undefined,
          }),
        },
      );
      const data = (await res.json().catch(() => null)) as
        | {
            message?: string;
            purchaseOrder?: PurchaseOrderDetail;
          }
        | null;
	      if (!res.ok) {
	        toast.error(data?.message ?? t(uiLocale, "purchase.detail.extraCost.error.failed"));
	        return;
	      }
      if (data?.purchaseOrder) {
        setPo(data.purchaseOrder);
        onCacheUpdate(data.purchaseOrder);
	      }
	      setIsApplyExtraCostMode(false);
	      toast.success(t(uiLocale, "purchase.detail.extraCost.toast.success"));
	      await onRefreshList();
	      router.refresh();
	    } catch {
	      toast.error(t(uiLocale, "purchase.error.serverUnreachable"));
	    } finally {
	      setIsApplyingExtraCost(false);
	    }
	  }, [
	    extraCostOtherInput,
	    extraCostOtherNoteInput,
	    extraCostShippingInput,
	    onCacheUpdate,
	    onRefreshList,
	    po,
	    router,
	    uiLocale,
	  ]);

  const reversePayment = useCallback(
    async (paymentId: string) => {
      if (!po) return;
      setReversingPaymentId(paymentId);
      try {
        const res = await authFetch(
          `/api/stock/purchase-orders/${po.id}/payments/${paymentId}/reverse`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": `po-payment-reverse-${paymentId}-${Date.now()}`,
            },
            body: JSON.stringify({}),
          },
        );
        const data = (await res.json().catch(() => null)) as
          | {
              message?: string;
              purchaseOrder?: PurchaseOrderDetail;
            }
          | null;
	        if (!res.ok) {
	          toast.error(data?.message ?? t(uiLocale, "purchase.detail.reversePayment.error.failed"));
	          return;
	        }
        if (data?.purchaseOrder) {
          setPo(data.purchaseOrder);
          onCacheUpdate(data.purchaseOrder);
        }
	        toast.success(t(uiLocale, "purchase.detail.reversePayment.toast.success"));
	        await onRefreshList();
	        router.refresh();
	      } catch {
	        toast.error(t(uiLocale, "purchase.error.serverUnreachable"));
	      } finally {
	        setReversingPaymentId(null);
	      }
	    },
	    [onCacheUpdate, onRefreshList, po, router, uiLocale],
	  );

  const canEditPO =
    po?.status === "DRAFT" || po?.status === "ORDERED" || po?.status === "SHIPPED";
  const canPrintPO = po?.status === "ORDERED" || po?.status === "SHIPPED" || po?.status === "RECEIVED" || po?.status === "CANCELLED";
  const isDraftEditable = po?.status === "DRAFT";
  const isExchangeRatePending =
    po?.purchaseCurrency !== storeCurrency && !po?.exchangeRateLockedAt;
  const canFinalizeExchangeRate =
    po?.status === "RECEIVED" && isExchangeRatePending;
  const canSettlePayment =
    po?.status === "RECEIVED" && (po?.outstandingBase ?? 0) > 0;
  const canApplyExtraCost =
    po?.status === "RECEIVED" && po?.paymentStatus !== "PAID";
  const extraCostShippingPreview = Math.max(
    0,
    Math.round(Number(extraCostShippingInput) || 0),
  );
  const extraCostOtherPreview = Math.max(
    0,
    Math.round(Number(extraCostOtherInput) || 0),
  );
  const extraCostGrandTotalPreview = po
    ? po.totalCostBase + extraCostShippingPreview + extraCostOtherPreview
    : 0;
  const extraCostOutstandingPreview = po
    ? extraCostGrandTotalPreview - po.totalPaidBase
    : 0;

  const startEdit = () => {
    if (!po) return;
    void loadProducts();
    setEditForm({
      supplierName: po.supplierName ?? "",
      supplierContact: po.supplierContact ?? "",
      purchaseCurrency: (po.purchaseCurrency as StoreCurrency) ?? storeCurrency,
      exchangeRate: String(po.exchangeRate ?? 1),
      shippingCost: String(po.shippingCost ?? 0),
      otherCost: String(po.otherCost ?? 0),
      otherCostNote: po.otherCostNote ?? "",
      note: po.note ?? "",
      expectedAt: po.expectedAt ? po.expectedAt.slice(0, 10) : "",
      dueDate: po.dueDate ? po.dueDate.slice(0, 10) : "",
      trackingInfo: po.trackingInfo ?? "",
      items: po.items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        productSku: item.productSku,
        unitId: item.unitId,
        unitCode: item.purchaseUnitCode,
        unitNameTh: item.purchaseUnitNameTh,
        baseUnitCode: item.baseUnitCode,
        baseUnitNameTh: item.baseUnitNameTh,
        multiplierToBase: item.multiplierToBase,
        qtyOrdered: String(item.qtyOrdered),
        unitCostPurchase: String(item.unitCostPurchase),
      })),
    });
    setIsEditMode(true);
  };

	  const saveEdit = async () => {
	    if (!po) return;
	    if (isDraftEditable && editForm.items.length === 0) {
	      toast.error(t(uiLocale, "purchase.create.validation.itemsRequired"));
	      return;
	    }

    setIsSavingEdit(true);
    try {
      const editRateValue = Number(editForm.exchangeRate);
      const hasEditRate =
        editForm.exchangeRate.trim().length > 0 && Number.isFinite(editRateValue) && editRateValue > 0;
      const payload = isDraftEditable
        ? {
            supplierName: editForm.supplierName || undefined,
            supplierContact: editForm.supplierContact || undefined,
            purchaseCurrency: editForm.purchaseCurrency,
            exchangeRate:
              editForm.purchaseCurrency === storeCurrency
                ? 1
                : hasEditRate
                  ? editRateValue
                  : undefined,
            shippingCost: Number(editForm.shippingCost) || 0,
            otherCost: Number(editForm.otherCost) || 0,
            otherCostNote: editForm.otherCostNote || undefined,
            note: editForm.note || undefined,
            expectedAt: editForm.expectedAt || undefined,
            dueDate: editForm.dueDate || undefined,
            trackingInfo: editForm.trackingInfo || undefined,
            items: editForm.items.map((item) => ({
              productId: item.productId,
              unitId: item.unitId,
              qtyOrdered: Number(item.qtyOrdered) || 1,
              unitCostPurchase: Number(item.unitCostPurchase) || 0,
            })),
          }
        : {
            note: editForm.note || undefined,
            expectedAt: editForm.expectedAt || undefined,
            dueDate: editForm.dueDate || undefined,
            trackingInfo: editForm.trackingInfo || undefined,
          };

      const res = await authFetch(`/api/stock/purchase-orders/${po.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
	      const data = await res.json();
	      if (!res.ok) {
	        toast.error(data?.message ?? t(uiLocale, "purchase.detail.edit.error.failed"));
	        return;
	      }

      const updatedPo = data.purchaseOrder as PurchaseOrderDetail;
	      setPo(updatedPo);
	      onCacheUpdate(updatedPo);
	      setIsEditMode(false);
	      toast.success(t(uiLocale, "purchase.detail.edit.toast.success"));
	      router.refresh();
	    } catch {
	      toast.error(t(uiLocale, "purchase.error.serverUnreachable"));
	    } finally {
	      setIsSavingEdit(false);
	    }
	  };

  const isOpen = poId !== null;

  return (
	    <SlideUpSheet
	      isOpen={isOpen}
	      onClose={onClose}
	      title={po?.poNumber ?? t(uiLocale, "purchase.detail.title")}
	      disabled={
	        updating ||
	        isSavingEdit ||
	        isFinalizingRate ||
        isSettlingPayment ||
        isApplyingExtraCost ||
        reversingPaymentId !== null
      }
    >
      <div className="space-y-4">
          {loading ? (
            <div className="space-y-3">
              <div className="animate-pulse space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="h-3 w-28 rounded bg-slate-200" />
                <div className="h-3 w-4/5 rounded bg-slate-200" />
              </div>
              <div className="animate-pulse space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="h-3 w-16 rounded bg-slate-200" />
                <div className="h-3 w-full rounded bg-slate-200" />
                <div className="h-3 w-3/4 rounded bg-slate-200" />
              </div>
            </div>
          ) : po ? (
            <>
              {/* Status + timeline */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {(() => {
                    const cfg = statusConfig[po.status as PurchaseOrderListItem["status"]];
                    const Icon = cfg?.icon ?? FileText;
                    return (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${cfg?.badgeClass ?? "bg-slate-100 text-slate-600"}`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {cfg?.label ?? po.status}
                      </span>
                    );
                  })()}
                  {po.supplierName && (
                    <span className="text-xs text-slate-500">
                      · {po.supplierName}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {canSettlePayment &&
                    !isEditMode &&
                    !isSettleMode &&
                    !isFinalizeRateMode &&
                    !isApplyExtraCostMode && (
                    <Button
                      variant="outline"
                      className="h-8 rounded-lg border-emerald-300 px-2.5 text-xs text-emerald-700 hover:bg-emerald-50"
                      onClick={startSettlePayment}
	                      disabled={updating || isSettlingPayment || isExchangeRatePending}
	                      title={
	                        isExchangeRatePending
	                          ? t(uiLocale, "purchase.detail.settle.tooltip.requiresFinalRate")
	                          : undefined
	                      }
	                    >
	                      <Banknote className="mr-1 h-3.5 w-3.5" />
	                      {t(uiLocale, "purchase.action.settlePayment")}
	                    </Button>
	                  )}
                  {canApplyExtraCost &&
                    !isEditMode &&
                    !isSettleMode &&
                    !isFinalizeRateMode &&
                    !isApplyExtraCostMode && (
                    <Button
                      variant="outline"
                      className="h-8 rounded-lg border-sky-300 px-2.5 text-xs text-sky-700 hover:bg-sky-50"
                      onClick={startApplyExtraCost}
	                      disabled={updating || isApplyingExtraCost}
	                    >
	                      {t(uiLocale, "purchase.action.applyExtraCost")}
	                    </Button>
	                  )}
                  {canFinalizeExchangeRate &&
                    !isEditMode &&
                    !isSettleMode &&
                    !isFinalizeRateMode &&
                    !isApplyExtraCostMode && (
                    <Button
                      variant="outline"
                      className="h-8 rounded-lg border-amber-300 px-2.5 text-xs text-amber-700 hover:bg-amber-50"
	                      onClick={startFinalizeRate}
	                      disabled={updating || isFinalizingRate}
	                    >
	                      {t(uiLocale, "purchase.action.finalizeRate")}
	                    </Button>
	                  )}
                  {canEditPO &&
                    !isEditMode &&
                    !isSettleMode &&
                    !isFinalizeRateMode &&
                    !isApplyExtraCostMode && (
                    <Button
                      variant="outline"
                      className="h-8 rounded-lg px-2.5 text-xs"
                      onClick={startEdit}
	                      disabled={updating}
	                    >
	                      <Pencil className="mr-1 h-3.5 w-3.5" />
	                      {t(uiLocale, "purchase.action.edit")}
	                    </Button>
	                  )}
                </div>
              </div>

              {canPrintPO && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    disabled={isGeneratingPdf}
                    onClick={async () => {
                      if (!po) return;
                      setIsGeneratingPdf(true);
                      try {
                        const { generatePoPdf } = await import("@/lib/pdf/generate-po-pdf");
                        const pdfData: POPdfData = {
                          poNumber: po.poNumber,
                          status: po.status,
                          supplierName: po.supplierName,
                          supplierContact: po.supplierContact,
                          purchaseCurrency: po.purchaseCurrency,
                          exchangeRate: po.exchangeRate,
                          shippingCost: po.shippingCost,
                          otherCost: po.otherCost,
                          otherCostNote: po.otherCostNote,
                          note: po.note,
                          createdByName: po.createdByName,
                          createdAt: po.createdAt,
                          orderedAt: po.orderedAt,
                          shippedAt: po.shippedAt,
                          receivedAt: po.receivedAt,
                          expectedAt: po.expectedAt,
                          trackingInfo: po.trackingInfo,
                          totalCostBase: po.totalCostBase,
                          storeLogoUrl: storeLogoUrl,
                          items: po.items.map((item) => ({
                            productName: item.productName,
                            productSku: item.productSku,
                            qtyOrdered: item.qtyOrdered,
                            purchaseUnitCode: item.purchaseUnitCode,
                            qtyBaseOrdered: item.qtyBaseOrdered,
                            baseUnitCode: item.baseUnitCode,
                            unitCostPurchase: item.unitCostPurchase,
                            unitCostBase: item.unitCostBase,
                          })),
                        };
	                        const blob = await generatePoPdf(pdfData, storeCurrency, pdfConfig);
	                        const { downloadBlob } = await import("@/lib/pdf/share-or-download");
	                        downloadBlob(blob, `${po.poNumber}.pdf`);
	                        toast.success(t(uiLocale, "purchase.pdf.toast.downloaded"));
	                      } catch {
	                        toast.error(t(uiLocale, "purchase.pdf.toast.generateFailed"));
	                      } finally {
	                        setIsGeneratingPdf(false);
	                      }
                    }}
                  >
                    {isGeneratingPdf ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    PDF
                  </button>
                  {canNativeShare() && (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      disabled={isGeneratingPdf}
                      onClick={async () => {
                        if (!po) return;
                        setIsGeneratingPdf(true);
                        try {
                          const { generatePoPdf } = await import("@/lib/pdf/generate-po-pdf");
                          const pdfData: POPdfData = {
                            poNumber: po.poNumber,
                            status: po.status,
                            supplierName: po.supplierName,
                            supplierContact: po.supplierContact,
                            purchaseCurrency: po.purchaseCurrency,
                            exchangeRate: po.exchangeRate,
                            shippingCost: po.shippingCost,
                            otherCost: po.otherCost,
                            otherCostNote: po.otherCostNote,
                            note: po.note,
                            createdByName: po.createdByName,
                            createdAt: po.createdAt,
                            orderedAt: po.orderedAt,
                            shippedAt: po.shippedAt,
                            receivedAt: po.receivedAt,
                            expectedAt: po.expectedAt,
                            trackingInfo: po.trackingInfo,
                            totalCostBase: po.totalCostBase,
                            storeLogoUrl: storeLogoUrl,
                          items: po.items.map((item) => ({
                              productName: item.productName,
                              productSku: item.productSku,
                              qtyOrdered: item.qtyOrdered,
                              purchaseUnitCode: item.purchaseUnitCode,
                              qtyBaseOrdered: item.qtyBaseOrdered,
                              baseUnitCode: item.baseUnitCode,
                              unitCostPurchase: item.unitCostPurchase,
                              unitCostBase: item.unitCostBase,
                            })),
                          };
	                          const blob = await generatePoPdf(pdfData, storeCurrency, pdfConfig);
	                          const { shareOrDownload } = await import("@/lib/pdf/share-or-download");
	                          const result = await shareOrDownload(
	                            blob,
	                            `${po.poNumber}.pdf`,
	                            `${t(uiLocale, "purchase.title")} ${po.poNumber}`,
	                          );
	                          if (result === "downloaded") toast.success(t(uiLocale, "purchase.pdf.toast.downloaded"));
	                        } catch {
	                          toast.error(t(uiLocale, "purchase.pdf.toast.shareFailed"));
	                        } finally {
	                          setIsGeneratingPdf(false);
	                        }
                      }}
	                    >
	                      <Share2 className="h-3.5 w-3.5" />
	                      {t(uiLocale, "purchase.pdf.action.share")}
	                    </button>
	                  )}
                </div>
              )}

	              {po.purchaseCurrency !== storeCurrency && (
	                <div
	                  className={`rounded-xl border px-3 py-2 text-xs ${
	                    isExchangeRatePending
                      ? "border-amber-200 bg-amber-50 text-amber-800"
                      : "border-emerald-200 bg-emerald-50 text-emerald-800"
	                  }`}
	                >
	                  <p className="font-medium">
	                    {t(uiLocale, "purchase.detail.fx.referenceRate.prefix")} 1{" "}
	                    {po.purchaseCurrency} = {po.exchangeRate} {storeCurrency}
	                  </p>
	                  <p className="mt-1">
	                    {t(uiLocale, "purchase.detail.fx.initialRate.prefix")} 1{" "}
	                    {po.purchaseCurrency} = {po.exchangeRateInitial} {storeCurrency}
	                  </p>
	                  {isExchangeRatePending ? (
	                    <p className="mt-1">
	                      {t(uiLocale, "purchase.detail.fx.status.pending")}
	                    </p>
	                  ) : (
	                    <p className="mt-1">
	                      {t(uiLocale, "purchase.detail.fx.status.locked.prefix")}
	                      {po.exchangeRateLockedAt
	                        ? `${t(uiLocale, "purchase.detail.fx.lockedAt.prefix")} ${formatDate(po.exchangeRateLockedAt, dateLocale)}`
	                        : ""}
	                      {po.exchangeRate !== po.exchangeRateInitial
	                        ? `${t(uiLocale, "purchase.detail.fx.delta.prefix")} ${po.exchangeRate - po.exchangeRateInitial > 0 ? "+" : ""}${po.exchangeRate - po.exchangeRateInitial}`
	                        : ""}
	                      {po.exchangeRateLockNote ? ` · ${po.exchangeRateLockNote}` : ""}
	                    </p>
	                  )}
	                </div>
	              )}

              {po.status === "RECEIVED" && (
                <div
                  className={`rounded-xl border px-3 py-2 text-xs ${
                    po.paymentStatus === "PAID"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : po.paymentStatus === "PARTIAL"
                        ? "border-amber-200 bg-amber-50 text-amber-800"
                      : "border-slate-200 bg-slate-50 text-slate-700"
	                  }`}
	                >
	                  <p className="font-medium">
	                    {t(uiLocale, "purchase.detail.payment.status.prefix")}{" "}
	                    {po.paymentStatus === "PAID"
	                      ? t(uiLocale, "purchase.detail.payment.status.PAID")
	                      : po.paymentStatus === "PARTIAL"
	                        ? t(uiLocale, "purchase.detail.payment.status.PARTIAL")
	                        : t(uiLocale, "purchase.detail.payment.status.UNPAID")}
	                  </p>
	                  <p className="mt-1">
	                    {t(uiLocale, "purchase.detail.payment.paidPrefix")}{" "}
	                    {fmtPrice(po.totalPaidBase, storeCurrency, numberLocale)} ·{" "}
	                    {t(uiLocale, "purchase.detail.payment.outstandingPrefix")}{" "}
	                    {fmtPrice(po.outstandingBase, storeCurrency, numberLocale)}
	                  </p>
	                  {po.paymentStatus === "PAID" || po.paymentStatus === "PARTIAL" ? (
	                    <p className="mt-1">
	                      {po.paidAt
	                        ? `${t(uiLocale, "purchase.detail.payment.paidAt.prefix")} ${formatDate(po.paidAt, dateLocale)}`
	                        : t(uiLocale, "purchase.detail.payment.paidRecorded")}
	                      {po.paidByName
	                        ? ` · ${t(uiLocale, "stock.movement.by.prefix")} ${po.paidByName}`
	                        : ""}
	                      {po.paymentReference
	                        ? `${t(uiLocale, "purchase.detail.payment.reference.prefix")} ${po.paymentReference}`
	                        : ""}
	                      {po.paymentNote ? ` · ${po.paymentNote}` : ""}
	                    </p>
	                  ) : (
	                    <p className="mt-1">
	                      {isExchangeRatePending
	                        ? t(uiLocale, "purchase.detail.payment.pendingRateBlocker")
	                        : t(uiLocale, "purchase.detail.payment.readyToSettleHint")}
	                    </p>
	                  )}
	                </div>
	              )}

	              {isFinalizeRateMode && (
	                <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
	                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">
	                    {t(uiLocale, "purchase.detail.finalizeRate.title")}
	                  </p>
	                  <div className="space-y-1">
	                    <label className="text-[11px] text-amber-700">
	                      {t(uiLocale, "purchase.detail.finalizeRate.field.exchangeRate.label")} (1{" "}
	                      {po.purchaseCurrency} = ? {storeCurrency})
	                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
	                      className="h-9 w-full rounded-lg border border-amber-200 bg-white px-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-300"
	                      value={finalRateInput}
	                      onChange={(event) => setFinalRateInput(event.target.value)}
	                      placeholder={`${t(uiLocale, "common.examplePrefix")} 670`}
	                    />
	                  </div>
	                  <div className="space-y-1">
	                    <label className="text-[11px] text-amber-700">
	                      {t(uiLocale, "purchase.detail.finalizeRate.field.note.labelOptional")}
	                    </label>
	                    <input
	                      className="h-9 w-full rounded-lg border border-amber-200 bg-white px-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-300"
	                      value={finalRateNoteInput}
	                      onChange={(event) => setFinalRateNoteInput(event.target.value)}
	                      placeholder={`${t(uiLocale, "common.examplePrefix")} ${t(uiLocale, "purchase.detail.finalizeRate.field.note.placeholderExample")}`}
	                    />
	                  </div>
	                  <p className="text-[11px] text-amber-700/90">
	                    {t(uiLocale, "purchase.detail.finalizeRate.help")}
	                  </p>
	                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 border-amber-200 bg-white text-xs text-amber-700 hover:bg-amber-100"
	                      onClick={() => setIsFinalizeRateMode(false)}
	                      disabled={isFinalizingRate}
	                    >
	                      {t(uiLocale, "common.action.cancel")}
	                    </Button>
                    <Button
                      type="button"
                      className="h-9 bg-amber-600 text-xs text-white hover:bg-amber-700"
                      onClick={() => {
                        void submitFinalizeRate();
                      }}
                      disabled={isFinalizingRate}
                    >
	                      {isFinalizingRate ? (
	                        <Loader2 className="h-4 w-4 animate-spin" />
	                      ) : (
	                        t(uiLocale, "purchase.detail.finalizeRate.cta.confirm")
	                      )}
	                    </Button>
	                  </div>
	                </div>
	              )}

	              {isSettleMode && (
	                <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
	                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
	                    {t(uiLocale, "purchase.detail.settle.title")}
	                  </p>
	                  <div className="space-y-1">
	                    <label className="text-[11px] text-emerald-700">
	                      {t(uiLocale, "purchase.detail.settle.field.amount.label")} ({storeCurrency})
	                    </label>
                    <input
                      type="number"
                      inputMode="numeric"
                      className="h-9 w-full rounded-lg border border-emerald-200 bg-white px-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-300"
                      value={settleAmountInput}
                      onChange={(event) => setSettleAmountInput(event.target.value)}
	                    />
	                    <p className="text-[11px] text-emerald-700/90">
	                      {t(uiLocale, "purchase.detail.settle.field.outstandingHint.prefix")}{" "}
	                      {fmtPrice(po.outstandingBase, storeCurrency, numberLocale)}
	                    </p>
	                  </div>
	                  <div className="space-y-1">
	                    <label className="text-[11px] text-emerald-700">
	                      {t(uiLocale, "purchase.detail.settle.field.paidAt.label")}
	                    </label>
                    <input
                      type="date"
                      className="po-date-input h-9 w-full rounded-lg border border-emerald-200 bg-white px-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-300"
                      value={settlePaidAtInput}
                      onChange={(event) => setSettlePaidAtInput(event.target.value)}
                    />
                  </div>
	                  <div className="space-y-1">
	                    <label className="text-[11px] text-emerald-700">
	                      {t(uiLocale, "purchase.detail.settle.field.reference.labelOptional")}
	                    </label>
                    <input
                      className="h-9 w-full rounded-lg border border-emerald-200 bg-white px-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-300"
	                      value={settleReferenceInput}
	                      onChange={(event) => setSettleReferenceInput(event.target.value)}
	                      placeholder={`${t(uiLocale, "common.examplePrefix")} ${t(uiLocale, "purchase.detail.settle.field.reference.placeholderExample")}`}
	                    />
	                  </div>
	                  <div className="space-y-1">
	                    <label className="text-[11px] text-emerald-700">
	                      {t(uiLocale, "purchase.detail.settle.field.note.labelOptional")}
	                    </label>
                    <input
                      className="h-9 w-full rounded-lg border border-emerald-200 bg-white px-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-300"
                      value={settleNoteInput}
                      onChange={(event) => setSettleNoteInput(event.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 border-emerald-200 bg-white text-xs text-emerald-700 hover:bg-emerald-100"
	                      onClick={() => setIsSettleMode(false)}
	                      disabled={isSettlingPayment}
	                    >
	                      {t(uiLocale, "common.action.cancel")}
	                    </Button>
                    <Button
                      type="button"
                      className="h-9 bg-emerald-600 text-xs text-white hover:bg-emerald-700"
                      onClick={() => {
                        void submitSettlePayment();
                      }}
                      disabled={isSettlingPayment}
                    >
	                      {isSettlingPayment ? (
	                        <Loader2 className="h-4 w-4 animate-spin" />
	                      ) : (
	                        t(uiLocale, "purchase.detail.settle.cta.confirm")
	                      )}
	                    </Button>
	                  </div>
	                </div>
	              )}

	              {isApplyExtraCostMode && (
	                <div className="space-y-3 rounded-xl border border-sky-200 bg-sky-50 p-3">
	                  <p className="text-xs font-semibold uppercase tracking-wider text-sky-700">
	                    {t(uiLocale, "purchase.detail.extraCost.title")}
	                  </p>
	                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
	                    <div className="space-y-1">
	                      <label className="text-[11px] text-sky-700">
	                        {t(uiLocale, "purchase.field.shippingCost.label")} ({storeCurrency})
	                      </label>
                      <input
                        type="number"
                        inputMode="numeric"
                        className="h-9 w-full rounded-lg border border-sky-200 bg-white px-2.5 text-sm outline-none focus:ring-2 focus:ring-sky-300"
                        value={extraCostShippingInput}
                        onChange={(event) => setExtraCostShippingInput(event.target.value)}
                      />
                    </div>
	                    <div className="space-y-1">
	                      <label className="text-[11px] text-sky-700">
	                        {t(uiLocale, "purchase.field.otherCost.label")} ({storeCurrency})
	                      </label>
                      <input
                        type="number"
                        inputMode="numeric"
                        className="h-9 w-full rounded-lg border border-sky-200 bg-white px-2.5 text-sm outline-none focus:ring-2 focus:ring-sky-300"
                        value={extraCostOtherInput}
                        onChange={(event) => setExtraCostOtherInput(event.target.value)}
                      />
                    </div>
                  </div>
	                  <div className="space-y-1">
	                    <label className="text-[11px] text-sky-700">
	                      {t(uiLocale, "purchase.field.otherCostNote.labelOptional")}
	                    </label>
                    <input
                      className="h-9 w-full rounded-lg border border-sky-200 bg-white px-2.5 text-sm outline-none focus:ring-2 focus:ring-sky-300"
	                      value={extraCostOtherNoteInput}
	                      onChange={(event) => setExtraCostOtherNoteInput(event.target.value)}
	                      placeholder={`${t(uiLocale, "common.examplePrefix")} ${t(uiLocale, "purchase.detail.extraCost.field.otherCostNote.placeholderExample")}`}
	                    />
	                  </div>
	                  <p className="text-[11px] text-sky-700/90">
	                    {t(uiLocale, "purchase.detail.extraCost.preview.newTotalPrefix")}{" "}
	                    {fmtPrice(extraCostGrandTotalPreview, storeCurrency, numberLocale)} ·{" "}
	                    {t(uiLocale, "purchase.detail.extraCost.preview.newOutstandingPrefix")}{" "}
	                    {fmtPrice(Math.max(0, extraCostOutstandingPreview), storeCurrency, numberLocale)}
	                  </p>
	                  <p className="text-[11px] text-sky-700/90">
	                    {t(uiLocale, "purchase.detail.extraCost.help")}
	                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 border-sky-200 bg-white text-xs text-sky-700 hover:bg-sky-100"
	                      onClick={() => setIsApplyExtraCostMode(false)}
	                      disabled={isApplyingExtraCost}
	                    >
	                      {t(uiLocale, "common.action.cancel")}
	                    </Button>
                    <Button
                      type="button"
                      className="h-9 bg-sky-600 text-xs text-white hover:bg-sky-700"
                      onClick={() => {
                        void submitApplyExtraCost();
                      }}
                      disabled={isApplyingExtraCost}
                    >
	                      {isApplyingExtraCost ? (
	                        <Loader2 className="h-4 w-4 animate-spin" />
	                      ) : (
	                        t(uiLocale, "purchase.detail.extraCost.cta.confirm")
	                      )}
	                    </Button>
	                  </div>
	                </div>
	              )}

	              {po.status === "RECEIVED" && po.paymentEntries.length > 0 && (
	                <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
	                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
	                    {t(uiLocale, "purchase.detail.payments.title")}
	                  </p>
                  <div className="space-y-2">
                    {po.paymentEntries.map((entry) => {
                      const isReversed = po.paymentEntries.some(
                        (item) => item.reversedPaymentId === entry.id,
                      );
                      return (
                        <div
                          key={entry.id}
                          className="rounded-lg border border-slate-200 bg-slate-50 p-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
	                              <p className="text-xs font-medium text-slate-700">
	                                {entry.entryType === "PAYMENT"
	                                  ? t(uiLocale, "purchase.detail.payments.entryType.PAYMENT")
	                                  : t(uiLocale, "purchase.detail.payments.entryType.REVERSAL")}
	                                {" · "}
	                                {entry.paidAt ? formatDate(entry.paidAt, dateLocale) : "-"}
	                              </p>
	                              <p className="text-[11px] text-slate-500">
	                                {entry.createdByName
	                                  ? `${t(uiLocale, "stock.movement.by.prefix")} ${entry.createdByName}`
	                                  : t(uiLocale, "purchase.detail.payments.bySystem")}
	                                {entry.reference
	                                  ? `${t(uiLocale, "purchase.detail.payment.reference.prefix")} ${entry.reference}`
	                                  : ""}
	                                {entry.note ? ` · ${entry.note}` : ""}
	                              </p>
                            </div>
                            <div className="text-right">
                              <p
                                className={`text-sm font-semibold ${
                                  entry.entryType === "PAYMENT"
                                    ? "text-emerald-700"
                                    : "text-red-600"
                                }`}
                              >
                                {entry.entryType === "PAYMENT" ? "+" : "-"}
                                {fmtPrice(entry.amountBase, storeCurrency, numberLocale)}
                              </p>
                              {entry.entryType === "PAYMENT" && !isReversed ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="mt-1 h-7 border-red-200 px-2 text-[11px] text-red-700 hover:bg-red-50"
                                  onClick={() => {
                                    void reversePayment(entry.id);
                                  }}
                                  disabled={reversingPaymentId === entry.id}
                                >
	                                  {reversingPaymentId === entry.id ? (
	                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
	                                  ) : (
	                                    t(uiLocale, "purchase.detail.reversePayment.cta.label")
	                                  )}
	                                </Button>
	                              ) : null}
	                              {entry.entryType === "PAYMENT" && isReversed ? (
	                                <p className="mt-1 text-[10px] text-slate-500">
	                                  {t(uiLocale, "purchase.detail.reversePayment.badge.reversed")}
	                                </p>
	                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

	              {isEditMode && (
	                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
	                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
	                    {t(uiLocale, "purchase.detail.edit.title")}
	                  </p>

                  {isDraftEditable && (
                    <>
	                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
	                        <div className="space-y-1">
	                          <label className="text-[11px] text-slate-500">
	                            {t(uiLocale, "purchase.detail.edit.field.supplierName.label")}
	                          </label>
                          <input
                            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                            value={editForm.supplierName}
                            onChange={(e) =>
                              setEditForm((prev) => ({
                                ...prev,
                                supplierName: e.target.value,
                              }))
                            }
                          />
                        </div>
	                        <div className="space-y-1">
	                          <label className="text-[11px] text-slate-500">
	                            {t(uiLocale, "purchase.detail.edit.field.supplierContact.label")}
	                          </label>
                          <input
                            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                            type="tel"
                            inputMode="tel"
                            autoComplete="tel"
                            enterKeyHint="next"
                            value={editForm.supplierContact}
                            onChange={(e) =>
                              setEditForm((prev) => ({
                                ...prev,
                                supplierContact: e.target.value,
                              }))
                            }
                          />
                        </div>
                      </div>

	                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
	                        <div className="space-y-1">
	                          <label className="text-[11px] text-slate-500">
	                            {t(uiLocale, "purchase.detail.edit.field.purchaseCurrency.label")}
	                          </label>
                          <select
                            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                            value={editForm.purchaseCurrency}
                            onChange={(e) =>
                              setEditForm((prev) => ({
                                ...prev,
                                purchaseCurrency: e.target.value as StoreCurrency,
                              }))
                            }
                          >
                            <option value="LAK">LAK</option>
                            <option value="THB">THB</option>
                            <option value="USD">USD</option>
                          </select>
                        </div>
	                        <div className="space-y-1">
	                          <label className="text-[11px] text-slate-500">
	                            {t(uiLocale, "purchase.detail.edit.field.exchangeRate.label")}
	                          </label>
                          <input
                            type="number"
                            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                            value={editForm.exchangeRate}
                            onChange={(e) =>
                              setEditForm((prev) => ({
                                ...prev,
                                exchangeRate: e.target.value,
                              }))
                            }
                          />
	                          {editForm.purchaseCurrency !== storeCurrency && (
	                            <p className="text-[10px] text-slate-500">
	                              {t(uiLocale, "purchase.detail.edit.field.exchangeRate.helpPendingRate")}
	                            </p>
	                          )}
	                        </div>
	                      </div>

	                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
	                        <div className="space-y-1">
	                          <label className="text-[11px] text-slate-500">
	                            {t(uiLocale, "purchase.field.shippingCost.label")}
	                          </label>
                          <input
                            type="number"
                            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                            value={editForm.shippingCost}
                            onChange={(e) =>
                              setEditForm((prev) => ({
                                ...prev,
                                shippingCost: e.target.value,
                              }))
                            }
                          />
                        </div>
	                        <div className="space-y-1">
	                          <label className="text-[11px] text-slate-500">
	                            {t(uiLocale, "purchase.field.otherCost.label")}
	                          </label>
                          <input
                            type="number"
                            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                            value={editForm.otherCost}
                            onChange={(e) =>
                              setEditForm((prev) => ({
                                ...prev,
                                otherCost: e.target.value,
                              }))
                            }
                          />
                        </div>
                      </div>

	                      <div className="space-y-1">
	                        <label className="text-[11px] text-slate-500">
	                          {t(uiLocale, "purchase.field.otherCostNote.label")}
	                        </label>
                        <input
                          className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                          value={editForm.otherCostNote}
                          onChange={(e) =>
                            setEditForm((prev) => ({
                              ...prev,
                              otherCostNote: e.target.value,
                            }))
                          }
                        />
                      </div>

	                      <div className="space-y-2">
	                        <p className="text-[11px] text-slate-500">
	                          {t(uiLocale, "purchase.detail.edit.items.title")}
	                        </p>
                        {editForm.items.map((item, index) => (
                          <div
                            key={`${item.productId}-${index}`}
                            className="rounded-lg border border-slate-200 bg-white p-2"
                          >
                            <p className="text-xs font-medium text-slate-700">
                              {item.productName}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              {item.productSku}
                            </p>
                            <div className="mt-1 space-y-2">
                              <select
                                className="h-8 w-full rounded-md border border-slate-200 px-2 text-xs outline-none focus:ring-2 focus:ring-primary"
                                value={item.unitId}
                                onChange={(e) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    items: prev.items.map((x, i) => {
                                      if (i !== index) return x;
                                      const product = productOptionMap.get(x.productId);
                                      const nextUnit =
                                        product?.unitOptions.find(
                                          (option) => option.unitId === e.target.value,
                                        ) ?? null;
                                      if (!nextUnit) return x;
                                      return {
                                        ...x,
                                        unitId: nextUnit.unitId,
                                        unitCode: nextUnit.unitCode,
                                        unitNameTh: nextUnit.unitNameTh,
                                        multiplierToBase: nextUnit.multiplierToBase,
                                      };
                                    }),
                                  }))
                                }
                              >
                                {(productOptionMap.get(item.productId)?.unitOptions ?? []).map(
                                  (option) => (
                                    <option key={option.unitId} value={option.unitId}>
                                      {getPurchaseUnitLabel(
                                        option.unitCode,
                                        option.unitNameTh,
                                      )}
                                    </option>
                                  ),
                                )}
                              </select>
                              <div className="grid grid-cols-2 gap-2">
                              <input
                                type="number"
                                className="h-8 w-full rounded-md border border-slate-200 px-2 text-xs outline-none focus:ring-2 focus:ring-primary"
                                value={item.qtyOrdered}
                                onChange={(e) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    items: prev.items.map((x, i) =>
                                      i === index
                                        ? { ...x, qtyOrdered: e.target.value }
                                        : x,
                                    ),
                                  }))
                                }
                              />
                              <input
                                type="number"
                                className="h-8 w-full rounded-md border border-slate-200 px-2 text-xs outline-none focus:ring-2 focus:ring-primary"
                                value={item.unitCostPurchase}
                                onChange={(e) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    items: prev.items.map((x, i) =>
                                      i === index
                                        ? { ...x, unitCostPurchase: e.target.value }
                                        : x,
                                    ),
                                  }))
                                }
                              />
                            </div>
                            </div>
                            <p className="mt-1 text-[10px] text-slate-500">
                              {t(uiLocale, "purchase.field.baseQty")} ={" "}
                              {(
                                (Number(item.qtyOrdered) || 0) * item.multiplierToBase
                              ).toLocaleString(numberLocale)}{" "}
                              {item.baseUnitCode}
                            </p>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

	                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
	                    <div className="space-y-1 min-w-0">
	                      <label className="text-[11px] text-slate-500">
	                        {t(uiLocale, "purchase.detail.edit.field.expectedAt.label")}
	                      </label>
	                      <PurchaseDatePickerField
                        uiLocale={uiLocale}
                        value={editForm.expectedAt}
                        onChange={(nextValue) =>
                          setEditForm((prev) => ({ ...prev, expectedAt: nextValue }))
	                        }
	                        triggerClassName="h-9 w-full min-w-0 max-w-full rounded-lg border border-slate-200 bg-white px-2.5 text-left text-base sm:text-sm outline-none focus:ring-2 focus:ring-primary"
	                        ariaLabel={t(uiLocale, "purchase.detail.edit.field.expectedAt.aria")}
	                      />
                      <div className="flex max-w-full flex-wrap gap-1.5 pt-1">
                        <button
                          type="button"
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-50"
                          onClick={() => applyEditDateShortcut("expectedAt", "TODAY")}
	                        >
	                          {t(uiLocale, "purchase.dateShortcut.today")}
	                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-50"
                          onClick={() => applyEditDateShortcut("expectedAt", "PLUS_7")}
	                        >
	                          {t(uiLocale, "purchase.dateShortcut.plus7")}
	                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-50"
                          onClick={() => applyEditDateShortcut("expectedAt", "END_OF_MONTH")}
	                        >
	                          {t(uiLocale, "purchase.dateShortcut.endOfMonth")}
	                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-50"
                          onClick={() => applyEditDateShortcut("expectedAt", "CLEAR")}
	                        >
	                          {t(uiLocale, "purchase.dateShortcut.clear")}
	                        </button>
                      </div>
                    </div>
	                    <div className="space-y-1 min-w-0">
	                      <label className="text-[11px] text-slate-500">
	                        {t(uiLocale, "purchase.detail.edit.field.dueDate.label")}
	                      </label>
	                      <PurchaseDatePickerField
                        uiLocale={uiLocale}
                        value={editForm.dueDate}
                        onChange={(nextValue) =>
                          setEditForm((prev) => ({ ...prev, dueDate: nextValue }))
	                        }
	                        triggerClassName="h-9 w-full min-w-0 max-w-full rounded-lg border border-slate-200 bg-white px-2.5 text-left text-base sm:text-sm outline-none focus:ring-2 focus:ring-primary"
	                        ariaLabel={t(uiLocale, "purchase.detail.edit.field.dueDate.aria")}
	                      />
                      <div className="flex max-w-full flex-wrap gap-1.5 pt-1">
                        <button
                          type="button"
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-50"
                          onClick={() => applyEditDateShortcut("dueDate", "TODAY")}
	                        >
	                          {t(uiLocale, "purchase.dateShortcut.today")}
	                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-50"
                          onClick={() => applyEditDateShortcut("dueDate", "PLUS_7")}
	                        >
	                          {t(uiLocale, "purchase.dateShortcut.plus7")}
	                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-50"
                          onClick={() => applyEditDateShortcut("dueDate", "END_OF_MONTH")}
	                        >
	                          {t(uiLocale, "purchase.dateShortcut.endOfMonth")}
	                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-50"
                          onClick={() => applyEditDateShortcut("dueDate", "CLEAR")}
	                        >
	                          {t(uiLocale, "purchase.dateShortcut.clear")}
	                        </button>
                      </div>
                    </div>
	                    <div className="space-y-1 min-w-0">
	                      <label className="text-[11px] text-slate-500">
	                        {t(uiLocale, "purchase.detail.edit.field.tracking.label")}
	                      </label>
                      <input
                        className="h-9 w-full min-w-0 max-w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                        value={editForm.trackingInfo}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            trackingInfo: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>

	                  <div className="space-y-1">
	                    <label className="text-[11px] text-slate-500">
	                      {t(uiLocale, "purchase.detail.edit.field.note.label")}
	                    </label>
                    <input
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                      value={editForm.note}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          note: e.target.value,
                        }))
                      }
                    />
                  </div>

	                  <div className="grid grid-cols-2 gap-2">
	                    <Button
	                      variant="outline"
	                      className="h-10 rounded-lg"
	                      onClick={() => setIsEditMode(false)}
	                      disabled={isSavingEdit}
	                    >
	                      {t(uiLocale, "common.action.cancel")}
	                    </Button>
                    <Button
                      className="h-10 rounded-lg"
                      onClick={saveEdit}
                      disabled={isSavingEdit}
                    >
	                      {isSavingEdit ? (
	                        <Loader2 className="h-4 w-4 animate-spin" />
	                      ) : (
	                        t(uiLocale, "purchase.detail.edit.cta.save")
	                      )}
	                    </Button>
	                  </div>
                </div>
              )}

	              {/* Timeline */}
	              <div className="space-y-1.5 text-xs">
	                {po.createdAt && (
	                  <div className="flex items-center gap-2 text-slate-600">
	                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
	                    {formatDate(po.createdAt, dateLocale)}{" "}
	                    {t(uiLocale, "purchase.detail.timeline.created")}
	                    {po.createdByName
	                      ? `${t(uiLocale, "purchase.detail.timeline.by.prefix")} ${po.createdByName}`
	                      : ""}
	                  </div>
	                )}
	                {po.orderedAt && (
	                  <div className="flex items-center gap-2 text-slate-600">
	                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
	                    {formatDate(po.orderedAt, dateLocale)}{" "}
	                    {t(uiLocale, "purchase.detail.timeline.ordered")}
	                  </div>
	                )}
	                {po.shippedAt && (
	                  <div className="flex items-center gap-2 text-slate-600">
	                    <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
	                    {formatDate(po.shippedAt, dateLocale)}{" "}
	                    {t(uiLocale, "purchase.detail.timeline.shipped")}
	                    {po.trackingInfo ? ` (${po.trackingInfo})` : ""}
	                  </div>
	                )}
	                {po.receivedAt && (
	                  <div className="flex items-center gap-2 text-slate-600">
	                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
	                    {formatDate(po.receivedAt, dateLocale)}{" "}
	                    {t(uiLocale, "purchase.detail.timeline.received")}
	                  </div>
	                )}
	                {po.paidAt && (
	                  <div className="flex items-center gap-2 text-slate-600">
	                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-700" />
	                    {formatDate(po.paidAt, dateLocale)}{" "}
	                    {t(uiLocale, "purchase.detail.timeline.paid")}
	                    {po.paidByName
	                      ? `${t(uiLocale, "purchase.detail.timeline.by.prefix")} ${po.paidByName}`
	                      : ""}
	                  </div>
	                )}
                {po.expectedAt &&
                  po.status !== "RECEIVED" &&
	                  po.status !== "CANCELLED" && (
	                    <div className="flex items-center gap-2 text-slate-500">
	                      <span className="h-1.5 w-1.5 rounded-full border border-slate-300 bg-white" />
	                      {t(uiLocale, "purchase.detail.timeline.expected.prefix")}{" "}
	                      {formatDate(po.expectedAt, dateLocale)}
	                    </div>
	                  )}
	                {po.dueDate && po.outstandingBase > 0 && (
	                  <div className="flex items-center gap-2 text-slate-500">
	                    <span className="h-1.5 w-1.5 rounded-full border border-slate-300 bg-white" />
	                    {t(uiLocale, "purchase.detail.timeline.dueDate.prefix")}{" "}
	                    {formatDate(po.dueDate, dateLocale)}
	                  </div>
	                )}
	              </div>

	              {/* Items */}
	              <div className="space-y-1.5">
	                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
	                  {t(uiLocale, "purchase.detail.items.title")} ({po.items.length})
	                </p>
                {po.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">
                        {item.productName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {item.qtyOrdered}{" "}
                        {getPurchaseUnitLabel(
                          item.purchaseUnitCode,
                          item.purchaseUnitNameTh,
                        )}{" "}
                        ·{" "}
                        {fmtPrice(
                          item.unitCostPurchase,
                          poPurchaseCurrency,
                          numberLocale,
                        )}
                        /{getPurchaseUnitLabel(item.purchaseUnitCode, item.purchaseUnitNameTh)}
                        <span className="ml-1">
                          ({item.qtyBaseOrdered.toLocaleString(numberLocale)}{" "}
                          {item.baseUnitCode})
                        </span>
                        {poPurchaseCurrency !== storeCurrency ? (
                          <span className="ml-1 text-slate-400">
                            ≈ {fmtPrice(item.unitCostBase, storeCurrency, numberLocale)}/
                            {item.baseUnitCode}
                          </span>
                        ) : null}
                        {item.qtyReceived > 0 &&
                          item.qtyReceived !== item.qtyOrdered && (
                            <span className="ml-1 text-amber-600">
                              {t(uiLocale, "purchase.detail.items.receivedQty.prefix")}{" "}
                              {item.qtyReceived}{" "}
                              {getPurchaseUnitLabel(
                                item.purchaseUnitCode,
                                item.purchaseUnitNameTh,
                              )}{" "}
                              / {item.qtyBaseReceived.toLocaleString(numberLocale)}{" "}
                              {item.baseUnitCode}
                              {t(uiLocale, "purchase.detail.items.receivedQty.suffix")}
                            </span>
                          )}
                      </p>
                    </div>
                    <CurrencyAmountStack
                      primaryAmount={
                        poPurchaseCurrency === storeCurrency
                          ? item.unitCostBase * item.qtyBaseOrdered
                          : item.unitCostPurchase * item.qtyOrdered
                      }
                      primaryCurrency={
                        poPurchaseCurrency === storeCurrency
                          ? storeCurrency
                          : poPurchaseCurrency
                      }
                      secondaryAmount={
                        poPurchaseCurrency === storeCurrency
                          ? null
                          : item.unitCostBase * item.qtyBaseOrdered
                      }
                      secondaryCurrency={
                        poPurchaseCurrency === storeCurrency ? null : storeCurrency
                      }
                      numberLocale={numberLocale}
                    />
                  </div>
                ))}
              </div>

	              {/* Cost summary */}
	              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
	                <div className="flex justify-between">
	                  <span className="text-slate-600">
	                    {t(uiLocale, "purchase.summary.products")}
	                  </span>
                    <CurrencyAmountStack
                      primaryAmount={
                        poPurchaseCurrency === storeCurrency
                          ? po.totalCostBase
                          : poItemsTotalPurchase
                      }
                      primaryCurrency={
                        poPurchaseCurrency === storeCurrency
                          ? storeCurrency
                          : poPurchaseCurrency
                      }
                      secondaryAmount={
                        poPurchaseCurrency === storeCurrency ? null : po.totalCostBase
                      }
                      secondaryCurrency={
                        poPurchaseCurrency === storeCurrency ? null : storeCurrency
                      }
                      numberLocale={numberLocale}
                    />
	                </div>
	                {po.shippingCost > 0 && (
	                  <div className="flex justify-between">
	                    <span className="text-slate-600">
	                      {t(uiLocale, "purchase.summary.shipping")}
	                    </span>
	                    <span>{fmtPrice(po.shippingCost, storeCurrency, numberLocale)}</span>
	                  </div>
	                )}
	                {po.otherCost > 0 && (
	                  <div className="flex justify-between">
	                    <span className="text-slate-600">
	                      {t(uiLocale, "purchase.summary.other")}
	                    </span>
	                    <span>{fmtPrice(po.otherCost, storeCurrency, numberLocale)}</span>
	                  </div>
	                )}
	                <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold">
	                  <span>{t(uiLocale, "purchase.summary.totalShort")}</span>
	                  <span>
	                    {fmtPrice(
	                      po.totalCostBase + po.shippingCost + po.otherCost,
                      storeCurrency,
                      numberLocale,
                    )}
                  </span>
                </div>
              </div>

              {po.note && (
                <p className="text-xs text-slate-500">📝 {po.note}</p>
              )}

              {/* Action buttons by status */}
              {!isEditMode && (
                <>
	                  {po.status === "DRAFT" && (
	                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        className="h-11 rounded-xl border-red-200 text-xs text-red-600 hover:bg-red-50"
	                        onClick={() => handleStatusChange("CANCELLED")}
	                        disabled={updating}
	                      >
	                        {t(uiLocale, "purchase.status.cancelled")}
	                      </Button>
                      <Button
                        className="h-11 rounded-xl text-xs"
                        onClick={() => handleStatusChange("ORDERED")}
                        disabled={updating}
                      >
	                        {updating ? (
	                          <Loader2 className="h-4 w-4 animate-spin" />
	                        ) : (
	                          t(uiLocale, "purchase.detail.statusCta.ordered")
	                        )}
	                      </Button>
	                    </div>
	                  )}
                  {po.status === "ORDERED" && (
                    <div className="space-y-2">
                      <Button
                        className="h-11 w-full rounded-xl text-xs"
                        onClick={() => handleStatusChange("SHIPPED")}
                        disabled={updating}
                      >
                        {updating ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
	                          <>
	                            <Truck className="mr-1 h-3.5 w-3.5" />
	                            {t(uiLocale, "purchase.detail.statusCta.shipped")}
	                          </>
	                        )}
	                      </Button>
                      <Button
                        className="h-11 w-full rounded-xl bg-emerald-600 text-xs hover:bg-emerald-700"
                        onClick={() => handleStatusChange("RECEIVED")}
                        disabled={updating}
                      >
                        {updating ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
	                          <>
	                            <Package className="mr-1 h-3.5 w-3.5" />
	                            {t(uiLocale, "purchase.detail.statusCta.received")}
	                          </>
	                        )}
	                      </Button>
                    </div>
                  )}
                  {po.status === "SHIPPED" && (
                    <div className="space-y-2">
                      <Button
                        className="h-11 w-full rounded-xl bg-emerald-600 text-xs hover:bg-emerald-700"
                        onClick={() => handleStatusChange("RECEIVED")}
                        disabled={updating}
                      >
                        {updating ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
	                          <>
	                            <Package className="mr-1 h-3.5 w-3.5" />
	                            {t(uiLocale, "purchase.detail.statusCta.received")}
	                          </>
	                        )}
	                      </Button>
                      <Button
                        variant="outline"
                        className="h-11 w-full rounded-xl border-red-200 text-xs text-red-600 hover:bg-red-50"
	                        onClick={() => handleStatusChange("CANCELLED")}
	                        disabled={updating}
	                      >
	                        {t(uiLocale, "purchase.status.cancelled")}
	                      </Button>
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
	            <div className="space-y-3 py-8 text-center">
	              <p className="text-sm text-slate-400">
	                {detailError ?? t(uiLocale, "purchase.detail.error.notFound")}
	              </p>
	              {poId && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 px-3 text-xs"
                  onClick={() => {
                    void retryLoadDetail();
                  }}
	                >
	                  {t(uiLocale, "purchase.action.retry")}
	                </Button>
	              )}
	            </div>
          )}
      </div>
    </SlideUpSheet>
  );
}
