"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronUp, ScanBarcode, Search, X } from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { SlideUpSheet } from "@/components/ui/slide-up-sheet";
import { BarcodeScannerPanel } from "@/components/app/barcode-scanner-panel";
import {
  StockTabEmptyState,
  StockTabErrorState,
  StockTabLoadingState,
  StockTabToolbar,
} from "@/components/app/stock-tab-feedback";
import { authFetch } from "@/lib/auth/client-token";
import { uiLocaleToDateLocale } from "@/lib/i18n/locales";
import { t, type MessageKey } from "@/lib/i18n/messages";
import { useUiLocale } from "@/lib/i18n/use-ui-locale";
import type {
  InventoryMovementView,
  StockProductOption,
} from "@/lib/inventory/queries";
import type { ProductListItem } from "@/lib/products/service";

type StockRecordingFormProps = {
  initialProducts: StockProductOption[];
  canCreate: boolean;
  canAdjust: boolean;
  canInbound: boolean;
  canUpdateCost: boolean;
};

type MovementType = "IN" | "ADJUST" | "RETURN";
type AdjustMode = "INCREASE" | "DECREASE";
type SearchResultProduct = ProductListItem & {
  stock?: { onHand: number; available: number; reserved: number };
};
const RECORDING_MOVEMENT_QUERY_KEY = "recordingType";
const RECORDING_PRODUCT_QUERY_KEY = "recordingProductId";

const movementLabelKey: Record<MovementType, MessageKey> = {
  IN: "stock.movementType.IN",
  ADJUST: "stock.movementType.ADJUST",
  RETURN: "stock.movementType.RETURN",
};

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

function parseMovementTypeQuery(value: string | null): MovementType | null {
  if (value === "IN" || value === "ADJUST" || value === "RETURN") {
    return value;
  }
  return null;
}

export function StockRecordingForm({
  initialProducts,
  canCreate,
  canAdjust,
  canInbound,
  canUpdateCost,
}: StockRecordingFormProps) {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const rawSearchParams = useSearchParams();
  const searchParams = useMemo(
    () => rawSearchParams ?? new URLSearchParams(),
    [rawSearchParams],
  );
  const uiLocale = useUiLocale();
  const numberLocale = uiLocaleToDateLocale(uiLocale);
  const isRecordingTabActive = searchParams.get("tab") === "recording";
  const movementTypeFromQuery = parseMovementTypeQuery(
    searchParams.get(RECORDING_MOVEMENT_QUERY_KEY),
  );
  const productIdFromQuery =
    searchParams.get(RECORDING_PRODUCT_QUERY_KEY)?.trim() ?? "";
  const [productItems, setProductItems] = useState(initialProducts);
  const [recentMovements, setRecentMovements] = useState<InventoryMovementView[]>([]);
  const [isRefreshingData, setIsRefreshingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(
    initialProducts.length > 0 ? new Date().toISOString() : null,
  );

  const movementTypeOptions = useMemo(() => {
    const options: MovementType[] = [];
    if (canInbound) {
      options.push("IN", "RETURN");
    }
    if (canAdjust) {
      options.push("ADJUST");
    }
    return options;
  }, [canAdjust, canInbound]);

  const [productId, setProductId] = useState<string>(productIdFromQuery);
  const [movementType, setMovementType] = useState<MovementType>(() => {
    if (
      movementTypeFromQuery &&
      movementTypeOptions.includes(movementTypeFromQuery)
    ) {
      return movementTypeFromQuery;
    }
    return movementTypeOptions[0] ?? "IN";
  });
  const [unitId, setUnitId] = useState<string>("");
  const [qty, setQty] = useState<string>("1");
  const [adjustMode, setAdjustMode] = useState<AdjustMode>("INCREASE");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResultProduct[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [productPickerQuery, setProductPickerQuery] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [showScannerPermission, setShowScannerPermission] = useState(false);
  const [hasSeenScannerPermission, setHasSeenScannerPermission] = useState(false);
  const [isUsageGuideOpen, setIsUsageGuideOpen] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const loadedUnitOptionProductIdsRef = useRef<Set<string>>(
    new Set(
      initialProducts
        .filter((product) => product.unitOptions.length > 1)
        .map((product) => product.productId),
    ),
  );
  const loadingUnitOptionProductIdsRef = useRef<Set<string>>(new Set());
  const isInitialRecordingLoading = isRefreshingData && productItems.length === 0;

  const fetchProductUnitOptions = useCallback(async (prodId: string) => {
    if (!prodId) {
      return;
    }
    if (loadedUnitOptionProductIdsRef.current.has(prodId)) {
      return;
    }
    if (loadingUnitOptionProductIdsRef.current.has(prodId)) {
      return;
    }

    loadingUnitOptionProductIdsRef.current.add(prodId);
    try {
      const res = await authFetch(
        `/api/stock/products?productId=${encodeURIComponent(prodId)}&includeUnitOptions=true&page=1&pageSize=1`,
        { cache: "no-store" },
      );
      const data = (await res.json().catch(() => null)) as
        | {
            ok?: boolean;
            products?: StockProductOption[];
          }
        | null;

      if (!res.ok || !data?.ok || !Array.isArray(data.products) || data.products.length === 0) {
        return;
      }

      const nextProduct = data.products[0]!;
      loadedUnitOptionProductIdsRef.current.add(prodId);
      setProductItems((prev) => {
        const existingIndex = prev.findIndex((item) => item.productId === prodId);
        if (existingIndex === -1) {
          return [nextProduct, ...prev];
        }

        return prev.map((item) => (item.productId === prodId ? nextProduct : item));
      });
    } finally {
      loadingUnitOptionProductIdsRef.current.delete(prodId);
    }
  }, []);

  useEffect(() => {
    if (initialProducts.length === 0) {
      return;
    }
    if (productItems.length === 0) {
      setProductItems(initialProducts);
      setLastUpdatedAt(new Date().toISOString());
    }
  }, [initialProducts, productItems.length]);

  useEffect(() => {
    if (productItems.length === 0) {
      setProductId("");
      setUnitId("");
      return;
    }

    const matchedProduct = productItems.find((item) => item.productId === productId);
    if (!matchedProduct) {
      if (productId) {
        return;
      }
      setProductId(productItems[0].productId);
      setUnitId(productItems[0].unitOptions[0]?.unitId ?? "");
      return;
    }

    const matchedUnit = matchedProduct.unitOptions.find((item) => item.unitId === unitId);
    if (!matchedUnit) {
      setUnitId(matchedProduct.unitOptions[0]?.unitId ?? "");
    }
  }, [productId, productItems, unitId]);

  useEffect(() => {
    const seen = window.localStorage.getItem("scanner-permission-seen") === "1";
    setHasSeenScannerPermission(seen);
  }, []);

  useEffect(() => {
    if (movementTypeOptions.length === 0) {
      return;
    }
    if (!movementTypeOptions.includes(movementType)) {
      setMovementType(movementTypeOptions[0]);
    }
  }, [movementType, movementTypeOptions]);

  useEffect(() => {
    if (!isRecordingTabActive) {
      return;
    }

    const nextMovementType = parseMovementTypeQuery(
      searchParams.get(RECORDING_MOVEMENT_QUERY_KEY),
    );
    if (nextMovementType && movementTypeOptions.includes(nextMovementType)) {
      setMovementType((current) => (current === nextMovementType ? current : nextMovementType));
    }

    const nextProductId = searchParams.get(RECORDING_PRODUCT_QUERY_KEY)?.trim() ?? "";
    if (!nextProductId) {
      return;
    }

    setProductId((current) => (current === nextProductId ? current : nextProductId));
  }, [
    movementTypeOptions,
    isRecordingTabActive,
    searchParams,
  ]);

  useEffect(() => {
    if (!isRecordingTabActive) {
      return;
    }
    if (!productId) {
      return;
    }
    void fetchProductUnitOptions(productId);
  }, [fetchProductUnitOptions, isRecordingTabActive, productId]);

  useEffect(() => {
    if (!isRecordingTabActive) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    const defaultMovementType = movementTypeOptions[0] ?? "IN";
    let changed = false;

    if (movementType === defaultMovementType) {
      if (params.has(RECORDING_MOVEMENT_QUERY_KEY)) {
        params.delete(RECORDING_MOVEMENT_QUERY_KEY);
        changed = true;
      }
    } else if (params.get(RECORDING_MOVEMENT_QUERY_KEY) !== movementType) {
      params.set(RECORDING_MOVEMENT_QUERY_KEY, movementType);
      changed = true;
    }

    if (productId) {
      if (params.get(RECORDING_PRODUCT_QUERY_KEY) !== productId) {
        params.set(RECORDING_PRODUCT_QUERY_KEY, productId);
        changed = true;
      }
    } else if (params.has(RECORDING_PRODUCT_QUERY_KEY)) {
      params.delete(RECORDING_PRODUCT_QUERY_KEY);
      changed = true;
    }

    if (!changed) {
      return;
    }

    const nextQuery = params.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
      scroll: false,
    });
  }, [
    isRecordingTabActive,
    movementType,
    movementTypeOptions,
    pathname,
    productId,
    router,
    searchParams,
  ]);

  const selectedProduct = useMemo(
    () => productItems.find((item) => item.productId === productId),
    [productId, productItems],
  );
  const currentStock = useMemo(
    () =>
      selectedProduct
        ? {
            onHand: selectedProduct.onHand,
            reserved: selectedProduct.reserved,
            available: selectedProduct.available,
          }
        : null,
    [selectedProduct],
  );

  const selectedUnit = selectedProduct?.unitOptions.find((unit) => unit.unitId === unitId);

  const filteredProductItems = useMemo(() => {
    const query = productPickerQuery.trim().toLowerCase();
    if (!query) {
      return productItems;
    }
    return productItems.filter((item) => {
      return (
        item.name.toLowerCase().includes(query) ||
        item.sku.toLowerCase().includes(query)
      );
    });
  }, [productItems, productPickerQuery]);

  const qtyBasePreview = useMemo(() => {
    const qtyNumber = Number(qty);
    if (!selectedUnit || !Number.isFinite(qtyNumber) || qtyNumber <= 0) {
      return null;
    }

    const computed = qtyNumber * selectedUnit.multiplierToBase;
    const rounded = Math.round(computed);
    if (Math.abs(computed - rounded) > 1e-9) {
      return null;
    }

    if (movementType === "ADJUST" && adjustMode === "DECREASE") {
      return -rounded;
    }

    return rounded;
  }, [adjustMode, movementType, qty, selectedUnit]);

  const handleSearch = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setSearchResults([]);
        setShowSearchDropdown(false);
        return;
      }

      setIsSearching(true);
      try {
        const res = await authFetch(
          `/api/products/search?q=${encodeURIComponent(query)}&includeStock=true`,
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.products || []);
          setShowSearchDropdown(true);
        }
      } catch {
        toast.error(t(uiLocale, "stock.recording.toast.searchFailed"));
      } finally {
        setIsSearching(false);
      }
    },
    [uiLocale],
  );

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      handleSearch(searchQuery);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, handleSearch]);

  const refreshRecordingData = useCallback(async () => {
    setIsRefreshingData(true);
    try {
      const res = await authFetch("/api/stock/movements");
      const data = (await res.json().catch(() => null)) as
        | {
            ok?: boolean;
            products?: StockProductOption[];
            message?: string;
          }
        | null;

      if (!res.ok) {
        setDataError(data?.message ?? t(uiLocale, "stock.recording.error.loadTabFailed"));
        return;
      }

      if (!data?.ok || !Array.isArray(data.products)) {
        setDataError(t(uiLocale, "stock.recording.error.invalidProductData"));
        return;
      }

      setProductItems(data.products);
      loadedUnitOptionProductIdsRef.current = new Set(
        data.products.map((product) => product.productId),
      );
      setDataError(null);
      setLastUpdatedAt(new Date().toISOString());
    } catch {
      setDataError(t(uiLocale, "stock.error.serverUnreachableRetry"));
    } finally {
      setIsRefreshingData(false);
    }
  }, [uiLocale]);

  const quickPresets = useMemo(() => {
    const presets: {
      id: string;
      labelKey: MessageKey;
      movementType: MovementType;
      adjustMode?: AdjustMode;
      noteTemplateKey: MessageKey;
    }[] = [];

    if (canInbound) {
      presets.push({
        id: "inbound",
        labelKey: "stock.recording.preset.inbound",
        movementType: "IN",
        noteTemplateKey: "stock.recording.noteTemplate.inbound",
      });
    }

    if (canAdjust) {
      presets.push({
        id: "adjust",
        labelKey: "stock.recording.preset.adjust",
        movementType: "ADJUST",
        adjustMode: "INCREASE",
        noteTemplateKey: "stock.recording.noteTemplate.adjustStockTake",
      });
      presets.push({
        id: "waste",
        labelKey: "stock.recording.preset.waste",
        movementType: "ADJUST",
        adjustMode: "DECREASE",
        noteTemplateKey: "stock.recording.noteTemplate.waste",
      });
    }

    return presets;
  }, [canAdjust, canInbound]);

  const applyPreset = useCallback(
    (preset: {
      movementType: MovementType;
      adjustMode?: AdjustMode;
      noteTemplateKey: MessageKey;
    }) => {
      setMovementType(preset.movementType);
      if (preset.adjustMode) {
        setAdjustMode(preset.adjustMode);
      }
      setNote(t(uiLocale, preset.noteTemplateKey));
    },
    [uiLocale],
  );

  const buildIdempotencyKey = () => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `stock-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  const focusQtyInput = useCallback(() => {
    window.setTimeout(() => {
      document.getElementById("stock-qty")?.focus();
    }, 100);
  }, []);

  const applySelectedProduct = useCallback(
    (nextProductId: string, nextBaseUnitId: string) => {
      setProductId(nextProductId);
      setUnitId(nextBaseUnitId);
      setSearchQuery("");
      setShowSearchDropdown(false);
      setShowProductPicker(false);
      setProductPickerQuery("");
      focusQtyInput();
    },
    [focusQtyInput],
  );

  const selectProductFromSearch = (product: SearchResultProduct) => {
    const exists = productItems.find((item) => item.productId === product.id);
    if (!exists) {
      const unitOptions = product.conversions.map((conv) => ({
        unitId: conv.unitId,
        unitCode: conv.unitCode,
        unitNameTh: conv.unitNameTh,
        multiplierToBase: conv.multiplierToBase,
      }));

      const nextProduct: StockProductOption = {
        productId: product.id,
        sku: product.sku,
        barcode: product.barcode ?? null,
        name: product.name,
        baseUnitId: product.baseUnitId,
        baseUnitCode: product.baseUnitCode,
        baseUnitNameTh: product.baseUnitNameTh || product.baseUnitCode,
        unitOptions,
        active: product.active,
        onHand: product.stock?.onHand ?? 0,
        reserved: product.stock?.reserved ?? 0,
        available: product.stock?.available ?? 0,
        outStockThreshold: product.outStockThreshold ?? null,
        lowStockThreshold: product.lowStockThreshold ?? null,
      };
      setProductItems((prev) => [nextProduct, ...prev]);
      loadedUnitOptionProductIdsRef.current.add(product.id);
    }
    applySelectedProduct(product.id, product.baseUnitId);
  };

  const selectProductFromPicker = useCallback(
    (product: StockProductOption) => {
      applySelectedProduct(product.productId, product.baseUnitId);
    },
    [applySelectedProduct],
  );

  const jumpToPurchaseTab = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("tab", "purchase");
    router.push(`?${params.toString()}`);
  }, [router]);

  const jumpToProductCost = useCallback(() => {
    if (!selectedProduct) {
      return;
    }

    const params = new URLSearchParams();
    params.set("status", "all");
    params.set("q", selectedProduct.sku?.trim() ? selectedProduct.sku : selectedProduct.name);
    router.push(`/products?${params.toString()}`);
  }, [router, selectedProduct]);

  const handleBarcodeResult = async (barcode: string) => {
    setShowScanner(false);
    setIsSearching(true);

    try {
      const res = await authFetch(
        `/api/products/search?q=${encodeURIComponent(barcode)}&includeStock=true`,
      );
      if (res.ok) {
        const data = await res.json();
        const products = data.products || [];

        const exactMatch = products.find(
          (p: ProductListItem) => p.barcode?.toLowerCase() === barcode.toLowerCase(),
        );

        if (exactMatch) {
          selectProductFromSearch(exactMatch);
          toast.success(`${t(uiLocale, "stock.recording.toast.foundProduct.prefix")} ${exactMatch.name}`);
        } else if (products.length > 0) {
          selectProductFromSearch(products[0]);
          toast.success(`${t(uiLocale, "stock.recording.toast.foundProduct.prefix")} ${products[0].name}`);
        } else {
          toast.error(t(uiLocale, "stock.recording.toast.barcodeNotFound"));
        }
      }
    } catch {
      toast.error(t(uiLocale, "stock.recording.toast.searchFailed"));
    } finally {
      setIsSearching(false);
    }
  };

  const openScanner = () => {
    if (hasSeenScannerPermission) {
      setShowScanner(true);
    } else {
      setShowScannerPermission(true);
    }
  };

  const submitMovement = async () => {
    if (!canCreate) {
      setErrorMessage(t(uiLocale, "stock.recording.error.noPermission"));
      return;
    }

    if (!productId) {
      setErrorMessage(t(uiLocale, "stock.recording.error.selectProduct"));
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const response = await authFetch("/api/stock/movements", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": buildIdempotencyKey(),
      },
      body: JSON.stringify({
        productId,
        movementType,
        unitId,
        qty,
        adjustMode,
        note,
      }),
    });

    const data = (await response.json().catch(() => null)) as
      | {
          message?: string;
        }
      | null;

    if (!response.ok) {
      setErrorMessage(data?.message ?? t(uiLocale, "stock.recording.error.createFailed"));
      setLoading(false);
      return;
    }

    if (selectedProduct && qtyBasePreview !== null) {
      const now = new Date().toISOString();
      const movementTypeForView: InventoryMovementView["type"] =
        movementType === "IN"
          ? "IN"
          : movementType === "RETURN"
            ? "RETURN"
            : "ADJUST";

      setRecentMovements((previous) => [
        {
          id: `local-${Date.now()}`,
          productId: selectedProduct.productId,
          productSku: selectedProduct.sku,
          productBarcode: selectedProduct.barcode ?? null,
          productName: selectedProduct.name,
          type: movementTypeForView,
          qtyBase: qtyBasePreview,
          note: note.trim() ? note.trim() : null,
          createdAt: now,
          createdByName: t(uiLocale, "common.actor.you"),
        },
        ...previous.slice(0, 4), // เก็บแค่ 5 รายการล่าสุด
      ]);

      // อัปเดตสต็อกปัจจุบันหลังบันทึก
      setProductItems((prev) =>
        prev.map((item) =>
          item.productId === selectedProduct.productId
            ? {
                ...item,
                onHand: item.onHand + qtyBasePreview,
                available: item.available + qtyBasePreview,
              }
            : item,
        ),
      );
    }

    setSuccessMessage(t(uiLocale, "stock.recording.success.saved"));
    setNote("");
    setQty("1");
    setLastUpdatedAt(new Date().toISOString());
    setLoading(false);
  };

  if (isInitialRecordingLoading) {
    return (
      <section className="space-y-4">
        <StockTabLoadingState variant="recording" />
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <StockTabToolbar
        title={t(uiLocale, "stock.tabs.recording.mobile")}
        isRefreshing={isRefreshingData}
        lastUpdatedAt={lastUpdatedAt}
        onRefresh={() => {
          void refreshRecordingData();
        }}
      />

      <article className="rounded-xl border bg-white p-3 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">
              {t(uiLocale, "stock.recording.help.title")}
            </p>
            {!isUsageGuideOpen ? (
              <p className="mt-0.5 truncate text-xs text-slate-600">
                {t(uiLocale, "stock.recording.help.subtitle")}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setIsUsageGuideOpen((current) => !current)}
            aria-expanded={isUsageGuideOpen}
            aria-controls="stock-recording-help-details"
            className="inline-flex shrink-0 items-center gap-1 rounded-md border bg-white px-2 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
          >
            {isUsageGuideOpen
              ? t(uiLocale, "stock.recording.help.toggle.hide")
              : t(uiLocale, "stock.recording.help.toggle.show")}
            {isUsageGuideOpen ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>
        </div>

        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-2 text-xs">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-medium leading-snug text-amber-900 sm:min-w-0 sm:truncate">
              {t(uiLocale, "stock.recording.hint.purchaseTab.title")}
            </p>
            <Button
              type="button"
              variant="outline"
              className="h-7 self-start border-amber-200 bg-white px-2 text-[11px] text-amber-800 hover:bg-amber-100 sm:shrink-0 sm:self-auto"
              onClick={jumpToPurchaseTab}
            >
              {t(uiLocale, "stock.recording.hint.purchaseTab.cta")}
            </Button>
          </div>
          {isUsageGuideOpen ? (
            <p className="mt-1 text-amber-800">
              {t(uiLocale, "stock.recording.hint.purchaseTab.description")}
            </p>
          ) : null}
        </div>

        <div id="stock-recording-help-details">
          {isUsageGuideOpen ? (
            <div className="mt-2 space-y-2">
              <p className="text-xs text-slate-700">
                {t(uiLocale, "stock.recording.help.subtitle")}
              </p>
              <ul className="space-y-1 text-xs text-slate-700">
                <li>{t(uiLocale, "stock.recording.help.bullet.stockTake")}</li>
                <li>{t(uiLocale, "stock.recording.help.bullet.returnFromCustomer")}</li>
                <li>{t(uiLocale, "stock.recording.help.bullet.transferBetweenBranches")}</li>
                <li>{t(uiLocale, "stock.recording.help.bullet.freeSample")}</li>
              </ul>
            </div>
          ) : null}
        </div>
      </article>

      {quickPresets.length > 0 ? (
        <article className="space-y-2 rounded-xl border bg-white p-3 shadow-sm">
          <p className="text-xs font-medium text-slate-700">
            {t(uiLocale, "stock.recording.presets.title")}
          </p>
          <div className="flex flex-wrap gap-2">
            {quickPresets.map((preset) => (
              <Button
                key={preset.id}
                type="button"
                variant="outline"
                className="h-8 rounded-full px-3 text-xs"
                onClick={() => applyPreset(preset)}
                disabled={loading}
              >
                {t(uiLocale, preset.labelKey)}
              </Button>
            ))}
          </div>
        </article>
      ) : null}

      {dataError && productItems.length === 0 ? (
        <StockTabErrorState
          message={dataError}
          onRetry={() => {
            void refreshRecordingData();
          }}
        />
      ) : productItems.length === 0 ? (
        <StockTabEmptyState
          title={t(uiLocale, "stock.recording.empty.title")}
          description={t(uiLocale, "stock.recording.empty.description")}
        />
      ) : null}

      {productItems.length > 0 ? (
        <article className="space-y-3 rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold">{t(uiLocale, "stock.recording.form.title")}</h2>

        <div className="space-y-2">
          <label className="text-xs text-muted-foreground" htmlFor="stock-product-search">
            {t(uiLocale, "stock.recording.form.field.product")}
          </label>

          <div className="relative">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  ref={searchInputRef}
                  id="stock-product-search"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => {
                    if (searchQuery.trim() && searchResults.length > 0) {
                      setShowSearchDropdown(true);
                    }
                  }}
                  placeholder={t(uiLocale, "stock.recording.search.placeholder")}
                  className="h-10 w-full rounded-md border pl-9 pr-9 text-sm outline-none ring-primary focus:ring-2"
                  disabled={loading}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setShowSearchDropdown(false);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                {isSearching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </div>
                )}
              </div>

              <Button
                type="button"
                variant="outline"
                className="h-10 w-10 p-0"
                onClick={openScanner}
                disabled={loading}
              >
                <ScanBarcode className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-2 flex">
              <Button
                type="button"
                variant="outline"
                className="h-9 w-full text-xs sm:ml-auto sm:w-auto sm:px-3"
                onClick={() => setShowProductPicker(true)}
                disabled={loading || productItems.length === 0}
              >
                {t(uiLocale, "stock.recording.productPicker.open.prefix")} (
                {productItems.length.toLocaleString(numberLocale)})
              </Button>
            </div>

            {showSearchDropdown && searchResults.length > 0 && (
              <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border bg-white shadow-lg">
                {searchResults.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => selectProductFromSearch(product)}
                    className="flex w-full items-start gap-2 border-b p-3 text-left transition-colors hover:bg-slate-50 last:border-b-0"
                  >
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">{product.sku}</p>
                      <p className="text-sm font-medium">{product.name}</p>
                      {product.barcode && (
                        <p className="text-xs text-slate-500">
                          {t(uiLocale, "products.label.barcode")}: {product.barcode}
                        </p>
                      )}
                      {product.stock && (
                        <p className="mt-1 text-xs text-blue-600">
                          {t(uiLocale, "stock.recording.searchResult.stock.prefix")}{" "}
                          {product.stock.onHand.toLocaleString(numberLocale)} {product.baseUnitCode}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedProduct && (
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <p className="font-medium text-slate-900">{selectedProduct.name}</p>
              <p className="text-xs text-slate-600">
                {t(uiLocale, "products.label.sku")}: {selectedProduct.sku}
              </p>
            </div>
          )}

          {selectedProduct && currentStock !== null && (
            <div className="rounded-lg bg-blue-50 p-3 text-sm">
              <p className="font-medium text-blue-900">
                {t(uiLocale, "stock.recording.currentStock.title")}
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-blue-700">{t(uiLocale, "stock.recording.currentStock.onHand")}</p>
                  <p className="font-semibold text-blue-900">
                    {currentStock.onHand.toLocaleString(numberLocale)}
                  </p>
                </div>
                <div>
                  <p className="text-blue-700">{t(uiLocale, "stock.recording.currentStock.reserved")}</p>
                  <p className="font-semibold text-blue-900">
                    {currentStock.reserved.toLocaleString(numberLocale)}
                  </p>
                </div>
                <div>
                  <p className="text-blue-700">{t(uiLocale, "stock.recording.currentStock.available")}</p>
                  <p className={`font-semibold ${currentStock.available < 0 ? "text-red-600" : "text-blue-900"}`}>
                    {currentStock.available.toLocaleString(numberLocale)}
                  </p>
                </div>
              </div>

              {qtyBasePreview !== null && (
                <div className="mt-2 border-t border-blue-200 pt-2">
                  <p className="text-blue-700">{t(uiLocale, "stock.recording.currentStock.afterThis")}</p>
                  <p className={`font-semibold ${(currentStock.onHand + qtyBasePreview) < 0 ? "text-red-600" : "text-emerald-600"}`}>
                    {(currentStock.onHand + qtyBasePreview).toLocaleString(numberLocale)} {selectedProduct.baseUnitCode}
                    {" "}
                    ({qtyBasePreview > 0 ? "+" : ""}{qtyBasePreview.toLocaleString(numberLocale)})
                  </p>
                </div>
              )}
            </div>
          )}

        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground" htmlFor="stock-type">
              {t(uiLocale, "stock.recording.form.field.type")}
            </label>
            <select
              id="stock-type"
              value={movementType}
              onChange={(event) => setMovementType(event.target.value as MovementType)}
              className="h-10 w-full rounded-md border px-3 text-sm outline-none ring-primary focus:ring-2"
              disabled={loading || movementTypeOptions.length === 0}
            >
              {movementTypeOptions.map((type) => (
                <option key={type} value={type}>
                  {t(uiLocale, movementLabelKey[type])}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground" htmlFor="stock-unit">
              {t(uiLocale, "stock.recording.form.field.unit")}
            </label>
            <select
              id="stock-unit"
              value={unitId}
              onChange={(event) => setUnitId(event.target.value)}
              className="h-10 w-full rounded-md border px-3 text-sm outline-none ring-primary focus:ring-2"
              disabled={loading || !selectedProduct}
            >
              {selectedProduct?.unitOptions.map((unit) => (
                <option key={unit.unitId} value={unit.unitId}>
                  {unit.unitCode} ({unit.unitNameTh})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Warning for IN type */}
        {movementType === "IN" && (
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              className="h-7 px-2 text-[11px]"
              onClick={jumpToProductCost}
              disabled={!selectedProduct || !canUpdateCost}
              title={t(uiLocale, "stock.recording.action.editCostInProducts")}
            >
              {t(uiLocale, "stock.recording.action.editCostInProducts")}
            </Button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground" htmlFor="stock-qty">
              {t(uiLocale, "stock.recording.form.field.qty")}
            </label>
            <input
              id="stock-qty"
              type="number"
              min={0.001}
              step={0.001}
              value={qty}
              onChange={(event) => setQty(event.target.value)}
              className="h-10 w-full rounded-md border px-3 text-sm outline-none ring-primary focus:ring-2"
              disabled={loading}
            />
          </div>

          {movementType === "ADJUST" ? (
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground" htmlFor="stock-adjust-mode">
                {t(uiLocale, "stock.recording.form.field.adjustMode")}
              </label>
              <select
                id="stock-adjust-mode"
                value={adjustMode}
                onChange={(event) => setAdjustMode(event.target.value as AdjustMode)}
                className="h-10 w-full rounded-md border px-3 text-sm outline-none ring-primary focus:ring-2"
              disabled={loading}
              >
                <option value="INCREASE">{t(uiLocale, "stock.recording.form.adjustMode.increase")}</option>
                <option value="DECREASE">{t(uiLocale, "stock.recording.form.adjustMode.decrease")}</option>
              </select>
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="text-xs text-muted-foreground" htmlFor="stock-note">
            {t(uiLocale, "stock.recording.form.field.noteOptional")}
          </label>
          <textarea
            id="stock-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="min-h-20 w-full rounded-md border px-3 py-2 text-sm outline-none ring-primary focus:ring-2"
            disabled={loading}
            placeholder={t(uiLocale, "stock.recording.form.note.placeholder")}
          />
        </div>

        <p className="text-xs text-blue-700">
          {selectedUnit && qtyBasePreview !== null
            ? `${t(uiLocale, "stock.recording.form.preview.prefix")} ${qtyBasePreview.toLocaleString(numberLocale)} ${selectedProduct?.baseUnitCode ?? t(uiLocale, "stock.recording.form.preview.fallbackBaseUnit")}`
            : t(uiLocale, "stock.recording.form.preview.invalidQty")}
        </p>

        {successMessage && <p className="text-sm text-emerald-700">{successMessage}</p>}
        {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
        {dataError && productItems.length > 0 ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
            <p className="text-xs text-red-700">{dataError}</p>
            <Button
              type="button"
              variant="outline"
              className="h-7 border-red-200 bg-white px-2.5 text-xs text-red-700 hover:bg-red-100"
              onClick={() => {
                void refreshRecordingData();
              }}
            >
              {t(uiLocale, "stock.feedback.retry")}
            </Button>
          </div>
        ) : null}

        <div className="sticky bottom-0 z-20 -mx-4 border-t border-slate-200 bg-white/95 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] pt-3 shadow-[0_-8px_20px_-18px_rgba(15,23,42,0.45)] supports-[backdrop-filter]:bg-white/85 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-0 sm:shadow-none">
          <Button
            className="h-11 w-full"
            onClick={submitMovement}
            disabled={loading || !canCreate || !productId}
          >
            {loading
              ? t(uiLocale, "stock.recording.form.submit.saving")
              : t(uiLocale, "stock.recording.form.submit")}
          </Button>
        </div>
        </article>
      ) : null}

      {/* รายการที่บันทึกเมื่อสักครู่ */}
      {recentMovements.length > 0 && (
        <article className="space-y-3 rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">{t(uiLocale, "stock.recording.recent.title")}</h2>
            <button
              type="button"
              onClick={() => {
                const params = new URLSearchParams(window.location.search);
                params.set("tab", "history");
                router.push(`?${params.toString()}`);
              }}
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              {t(uiLocale, "stock.recording.recent.viewAll")}
            </button>
          </div>

          <div className="space-y-2">
            {recentMovements.slice(0, 5).map((movement) => (
              <div key={movement.id} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">{movement.productSku}</p>
                    <p className="text-sm font-medium">{movement.productName}</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs ${movementBadgeClass[movement.type]}`}>
                    {t(uiLocale, movementTypeLabelKeyMap[movement.type])}
                  </span>
                </div>

                <p className="mt-2 text-sm">
                  {t(uiLocale, "stock.movement.baseQty.label")}{" "}
                  {movement.qtyBase.toLocaleString(numberLocale)}
                </p>

                {movement.note && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t(uiLocale, "stock.movement.note.prefix")} {movement.note}
                  </p>
                )}

                <p className="mt-1 text-xs text-muted-foreground">
                  {t(uiLocale, "stock.movement.by.prefix")} {movement.createdByName ?? "-"} •{" "}
                  {new Date(movement.createdAt).toLocaleString(numberLocale)}
                </p>
              </div>
            ))}
          </div>
        </article>
      )}

      <SlideUpSheet
        isOpen={showProductPicker}
        onClose={() => setShowProductPicker(false)}
        title={t(uiLocale, "stock.recording.productPicker.title")}
        description={`${productItems.length.toLocaleString(numberLocale)} ${t(uiLocale, "stock.recording.productPicker.description.suffix")}`}
      >
        <div className="space-y-3">
          <input
            type="text"
            value={productPickerQuery}
            onChange={(event) => setProductPickerQuery(event.target.value)}
            className="h-10 w-full rounded-lg border px-3 text-sm outline-none ring-primary focus:ring-2"
            placeholder={t(uiLocale, "stock.recording.productPicker.search.placeholder")}
          />

          <div className="max-h-[56dvh] space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1">
            {filteredProductItems.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-slate-500">
                {t(uiLocale, "stock.recording.productPicker.empty")}
              </p>
            ) : (
              filteredProductItems.map((item) => (
                <button
                  key={item.productId}
                  type="button"
                  className={`w-full rounded-md px-3 py-2 text-left transition-colors ${
                    item.productId === productId
                      ? "bg-blue-50 text-blue-900 ring-1 ring-blue-200"
                      : "hover:bg-slate-50"
                  }`}
                  onClick={() => selectProductFromPicker(item)}
                >
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-slate-500">{item.sku}</p>
                  <p className="text-xs text-slate-500">
                    {t(uiLocale, "stock.recording.productPicker.onHand.prefix")}{" "}
                    {item.onHand.toLocaleString(numberLocale)} {item.baseUnitCode}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      </SlideUpSheet>

      {/* Scanner Permission Sheet */}
      <SlideUpSheet
        isOpen={showScannerPermission}
        onClose={() => setShowScannerPermission(false)}
        title={t(uiLocale, "products.scannerPermission.title")}
        description={t(uiLocale, "products.scannerPermission.description")}
      >
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            <p className="font-medium text-slate-700">{t(uiLocale, "products.scannerPermission.whyTitle")}</p>
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
                window.localStorage.setItem("scanner-permission-seen", "1");
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

      {/* Scanner Sheet */}
      <SlideUpSheet
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        title={t(uiLocale, "products.scanner.title")}
        description={t(uiLocale, "products.scanner.description")}
      >
        <div className="p-4">
          <BarcodeScannerPanel
            isOpen={showScanner}
            onResult={handleBarcodeResult}
            onClose={() => setShowScanner(false)}
            cameraSelectId="stock-recording-barcode-scanner-camera-select"
          />
        </div>
      </SlideUpSheet>
    </section>
  );
}
