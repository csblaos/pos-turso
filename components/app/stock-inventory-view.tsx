"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpDown,
  ChevronDown,
  ListFilter,
  LoaderCircle,
  Package,
  ScanBarcode,
  Search,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { usePathname, useSearchParams } from "next/navigation";

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
import { t } from "@/lib/i18n/messages";
import { useUiLocale } from "@/lib/i18n/use-ui-locale";
import type { StockProductOption } from "@/lib/inventory/queries";
import type { CategoryItem, ProductListItem } from "@/lib/products/service";

type StockInventoryViewProps = {
  products: StockProductOption[];
  categories: CategoryItem[];
  storeOutStockThreshold: number;
  storeLowStockThreshold: number;
  pageSize: number;
  initialHasMore: boolean;
};

type FilterOption = "all" | "low" | "out";
type SortOption = "name" | "sku" | "stock-low" | "stock-high";

const SCANNER_PERMISSION_STORAGE_KEY = "scanner-permission-seen";
const INVENTORY_Q_QUERY_KEY = "inventoryQ";
const INVENTORY_FILTER_QUERY_KEY = "inventoryFilter";
const INVENTORY_SORT_QUERY_KEY = "inventorySort";
const INVENTORY_CATEGORY_QUERY_KEY = "inventoryCategoryId";
const INVENTORY_LIST_SKELETON_COUNT = 3;

function parseInventoryFilter(value: string | null): FilterOption | null {
  if (value === "all" || value === "low" || value === "out") {
    return value;
  }
  return null;
}

function parseInventorySort(value: string | null): SortOption | null {
  if (
    value === "name" ||
    value === "sku" ||
    value === "stock-low" ||
    value === "stock-high"
  ) {
    return value;
  }
  return null;
}

function mergeUniqueProducts(
  prev: StockProductOption[],
  incoming: StockProductOption[],
) {
  const existingIds = new Set(prev.map((item) => item.productId));
  const merged = [...prev];
  for (const item of incoming) {
    if (!existingIds.has(item.productId)) {
      merged.push(item);
      existingIds.add(item.productId);
    }
  }
  return merged;
}

function buildInventoryFetchKey(params: {
  categoryId: string;
  query: string;
}) {
  return `${params.categoryId}::${params.query.trim().toLowerCase()}`;
}

export function StockInventoryView({
  products,
  categories,
  storeOutStockThreshold,
  storeLowStockThreshold,
  pageSize,
  initialHasMore,
}: StockInventoryViewProps) {
  const pathname = usePathname() ?? "/";
  const rawSearchParams = useSearchParams();
  const searchParams = useMemo(
    () => rawSearchParams ?? new URLSearchParams(),
    [rawSearchParams],
  );
  const uiLocale = useUiLocale();
  const numberLocale = uiLocaleToDateLocale(uiLocale);
  const tabQuery = searchParams.get("tab");
  const isInventoryTabActive = tabQuery === null || tabQuery === "inventory";
  const searchQueryFromUrl = searchParams.get(INVENTORY_Q_QUERY_KEY)?.trim() ?? "";
  const filterFromUrl =
    parseInventoryFilter(searchParams.get(INVENTORY_FILTER_QUERY_KEY)) ?? "all";
  const sortByFromUrl =
    parseInventorySort(searchParams.get(INVENTORY_SORT_QUERY_KEY)) ?? "name";
  const categoryIdFromUrl =
    searchParams.get(INVENTORY_CATEGORY_QUERY_KEY)?.trim() ?? "";

  const [productItems, setProductItems] = useState(products);
  const [productPage, setProductPage] = useState(1);
  const [hasMoreProducts, setHasMoreProducts] = useState(initialHasMore);
  const [isRefreshingData, setIsRefreshingData] = useState(false);
  const [isInventoryQueryLoading, setIsInventoryQueryLoading] = useState(false);
  const [isLoadingMoreProducts, setIsLoadingMoreProducts] = useState(false);
  const [isSearchingByBarcode, setIsSearchingByBarcode] = useState(false);
  const [pendingScannedBarcode, setPendingScannedBarcode] = useState<string | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(
    products.length > 0 ? new Date().toISOString() : null,
  );
  const inventorySearchStickyRef = useRef<HTMLDivElement | null>(null);
  const inventoryResultsRef = useRef<HTMLDivElement | null>(null);
  const [isInventorySearchStickyStuck, setIsInventorySearchStickyStuck] = useState(false);

  const [searchQuery, setSearchQuery] = useState(searchQueryFromUrl);
  const [searchQueryForUrlSync, setSearchQueryForUrlSync] = useState(searchQueryFromUrl);
  const [filter, setFilter] = useState<FilterOption>(filterFromUrl);
  const [sortBy, setSortBy] = useState<SortOption>(sortByFromUrl);
  const [selectedCategoryId, setSelectedCategoryId] = useState(categoryIdFromUrl);
  const [showScanner, setShowScanner] = useState(false);
  const [showScannerPermission, setShowScannerPermission] = useState(false);
  const [hasSeenScannerPermission, setHasSeenScannerPermission] = useState(false);
  const lastFetchedInventoryKeyRef = useRef(
    buildInventoryFetchKey({
      categoryId: categoryIdFromUrl,
      query: searchQueryFromUrl,
    }),
  );
  const inventoryQueryRequestIdRef = useRef(0);
  const hasActiveInventorySearchQuery = searchQuery.trim().length > 0;
  const isInventoryCompactSearchMode =
    hasActiveInventorySearchQuery && isInventorySearchStickyStuck;
  const hasPendingInventorySearchInput = searchQuery.trim() !== searchQueryForUrlSync;
  const isInventoryQueryPending = hasPendingInventorySearchInput || isInventoryQueryLoading;
  const shouldShowInventoryListSkeleton =
    (isRefreshingData || isInventoryQueryLoading) && productItems.length === 0;

  useEffect(() => {
    setProductItems(products);
    setProductPage(1);
    setHasMoreProducts(initialHasMore);
    lastFetchedInventoryKeyRef.current = buildInventoryFetchKey({
      categoryId: categoryIdFromUrl,
      query: searchQueryFromUrl,
    });
    if (products.length > 0) {
      setLastUpdatedAt(new Date().toISOString());
    }
  }, [categoryIdFromUrl, initialHasMore, products, searchQueryFromUrl]);

  useEffect(() => {
    const seen = window.localStorage.getItem(SCANNER_PERMISSION_STORAGE_KEY) === "1";
    setHasSeenScannerPermission(seen);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchQueryForUrlSync(searchQuery.trim());
    }, 250);
    return () => {
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

  useEffect(() => {
    if (!isInventoryTabActive) {
      return;
    }

    setSearchQuery((prev) => (prev === searchQueryFromUrl ? prev : searchQueryFromUrl));
    setSearchQueryForUrlSync((prev) =>
      prev === searchQueryFromUrl ? prev : searchQueryFromUrl,
    );
    setFilter((prev) => (prev === filterFromUrl ? prev : filterFromUrl));
    setSortBy((prev) => (prev === sortByFromUrl ? prev : sortByFromUrl));
    setSelectedCategoryId((prev) =>
      prev === categoryIdFromUrl ? prev : categoryIdFromUrl,
    );
  }, [
    isInventoryTabActive,
    searchQueryFromUrl,
    filterFromUrl,
    sortByFromUrl,
    categoryIdFromUrl,
  ]);

  useEffect(() => {
    if (!selectedCategoryId) {
      return;
    }

    const exists = categories.some((category) => category.id === selectedCategoryId);
    if (!exists) {
      setSelectedCategoryId("");
    }
  }, [categories, selectedCategoryId]);

  useEffect(() => {
    if (!isInventoryTabActive) {
      return;
    }

    const params = new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : searchParams.toString(),
    );
    let changed = false;

    if (searchQueryForUrlSync) {
      if (params.get(INVENTORY_Q_QUERY_KEY) !== searchQueryForUrlSync) {
        params.set(INVENTORY_Q_QUERY_KEY, searchQueryForUrlSync);
        changed = true;
      }
    } else if (params.has(INVENTORY_Q_QUERY_KEY)) {
      params.delete(INVENTORY_Q_QUERY_KEY);
      changed = true;
    }

    if (filter === "all") {
      if (params.has(INVENTORY_FILTER_QUERY_KEY)) {
        params.delete(INVENTORY_FILTER_QUERY_KEY);
        changed = true;
      }
    } else if (params.get(INVENTORY_FILTER_QUERY_KEY) !== filter) {
      params.set(INVENTORY_FILTER_QUERY_KEY, filter);
      changed = true;
    }

    if (sortBy === "name") {
      if (params.has(INVENTORY_SORT_QUERY_KEY)) {
        params.delete(INVENTORY_SORT_QUERY_KEY);
        changed = true;
      }
    } else if (params.get(INVENTORY_SORT_QUERY_KEY) !== sortBy) {
      params.set(INVENTORY_SORT_QUERY_KEY, sortBy);
      changed = true;
    }

    if (selectedCategoryId) {
      if (params.get(INVENTORY_CATEGORY_QUERY_KEY) !== selectedCategoryId) {
        params.set(INVENTORY_CATEGORY_QUERY_KEY, selectedCategoryId);
        changed = true;
      }
    } else if (params.has(INVENTORY_CATEGORY_QUERY_KEY)) {
      params.delete(INVENTORY_CATEGORY_QUERY_KEY);
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
    filter,
    isInventoryTabActive,
    pathname,
    searchParams,
    searchQueryForUrlSync,
    selectedCategoryId,
    sortBy,
  ]);

  const resolveThresholds = useCallback(
    (product: StockProductOption) => {
      const outThreshold = product.outStockThreshold ?? storeOutStockThreshold;
      const lowThreshold = Math.max(
        product.lowStockThreshold ?? storeLowStockThreshold,
        outThreshold,
      );

      return { outThreshold, lowThreshold };
    },
    [storeLowStockThreshold, storeOutStockThreshold],
  );

  const filteredAndSortedProducts = useMemo(() => {
    let items = [...productItems];

    if (filter === "low") {
      items = items.filter((p) => {
        const { outThreshold, lowThreshold } = resolveThresholds(p);
        return p.available > outThreshold && p.available <= lowThreshold;
      });
    } else if (filter === "out") {
      items = items.filter((p) => {
        const { outThreshold } = resolveThresholds(p);
        return p.available <= outThreshold;
      });
    }

    items.sort((a, b) => {
      switch (sortBy) {
        case "sku":
          return a.sku.localeCompare(b.sku, uiLocale);
        case "name":
          return a.name.localeCompare(b.name, uiLocale);
        case "stock-low":
          return a.available - b.available;
        case "stock-high":
          return b.available - a.available;
        default:
          return 0;
      }
    });

    return items;
  }, [filter, productItems, resolveThresholds, sortBy, uiLocale]);

  const stats = useMemo(() => {
    let low = 0;
    let out = 0;
    let good = 0;

    productItems.forEach((product) => {
      const { outThreshold, lowThreshold } = resolveThresholds(product);
      if (product.available <= outThreshold) {
        out += 1;
      } else if (product.available <= lowThreshold) {
        low += 1;
      } else {
        good += 1;
      }
    });

    return { low, out, good };
  }, [productItems, resolveThresholds]);

  const highlightProduct = useCallback((productId: string) => {
    window.setTimeout(() => {
      const element = document.getElementById(`product-${productId}`);
      if (!element) {
        return;
      }
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.classList.add("ring-2", "ring-primary");
      window.setTimeout(() => {
        element.classList.remove("ring-2", "ring-primary");
      }, 2000);
    }, 100);
  }, []);

  const fetchStockProductsPage = useCallback(
    async (
      page: number,
      options?: {
        categoryId?: string;
        query?: string;
      },
    ) => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      const categoryId = options?.categoryId ?? selectedCategoryId;
      const query = options?.query ?? searchQueryForUrlSync;
      if (categoryId) {
        params.set("categoryId", categoryId);
      }
      if (query.trim()) {
        params.set("q", query.trim());
      }

      const res = await authFetch(`/api/stock/products?${params.toString()}`);
      const data = (await res.json().catch(() => null)) as
        | {
            products?: StockProductOption[];
            hasMore?: boolean;
            message?: string;
            page?: number;
          }
        | null;

      if (!res.ok) {
        throw new Error(data?.message ?? t(uiLocale, "stock.inventory.error.loadFailed"));
      }

      if (!Array.isArray(data?.products)) {
        throw new Error(t(uiLocale, "stock.inventory.error.invalidData"));
      }

      return {
        products: data.products,
        hasMore: Boolean(data.hasMore),
        page: Number(data.page ?? page),
      };
    },
    [pageSize, searchQueryForUrlSync, selectedCategoryId, uiLocale],
  );

  const refreshInventoryData = useCallback(async () => {
    const requestId = ++inventoryQueryRequestIdRef.current;
    const currentFetchKey = buildInventoryFetchKey({
      categoryId: selectedCategoryId,
      query: searchQueryForUrlSync,
    });
    setIsRefreshingData(true);
    try {
      const next = await fetchStockProductsPage(1, {
        categoryId: selectedCategoryId,
        query: searchQueryForUrlSync,
      });
      if (requestId !== inventoryQueryRequestIdRef.current) {
        return;
      }
      setProductItems(next.products);
      setProductPage(next.page);
      setHasMoreProducts(next.hasMore);
      setDataError(null);
      lastFetchedInventoryKeyRef.current = currentFetchKey;
      setLastUpdatedAt(new Date().toISOString());
    } catch (error) {
      if (requestId !== inventoryQueryRequestIdRef.current) {
        return;
      }
      const message =
        error instanceof Error ? error.message : t(uiLocale, "stock.error.serverUnreachableRetry");
      setDataError(message);
    } finally {
      if (requestId === inventoryQueryRequestIdRef.current) {
        setIsRefreshingData(false);
      }
    }
  }, [fetchStockProductsPage, searchQueryForUrlSync, selectedCategoryId, uiLocale]);

  useEffect(() => {
    if (!isInventoryTabActive) {
      return;
    }
    const nextFetchKey = buildInventoryFetchKey({
      categoryId: selectedCategoryId,
      query: searchQueryForUrlSync,
    });
    if (lastFetchedInventoryKeyRef.current === nextFetchKey) {
      return;
    }

    const requestId = ++inventoryQueryRequestIdRef.current;
    let isCancelled = false;

    setIsInventoryQueryLoading(true);
    setDataError(null);

    void (async () => {
      try {
        const next = await fetchStockProductsPage(1, {
          categoryId: selectedCategoryId,
          query: searchQueryForUrlSync,
        });
        if (isCancelled || requestId !== inventoryQueryRequestIdRef.current) {
          return;
        }
        setProductItems(next.products);
        setProductPage(next.page);
        setHasMoreProducts(next.hasMore);
        setDataError(null);
        lastFetchedInventoryKeyRef.current = nextFetchKey;
        setLastUpdatedAt(new Date().toISOString());
      } catch (error) {
        if (isCancelled || requestId !== inventoryQueryRequestIdRef.current) {
          return;
        }
        const message =
          error instanceof Error
            ? error.message
            : t(uiLocale, "stock.inventory.error.loadFailed");
        setDataError(message);
      } finally {
        if (!isCancelled && requestId === inventoryQueryRequestIdRef.current) {
          setIsInventoryQueryLoading(false);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [
    fetchStockProductsPage,
    isInventoryTabActive,
    searchQueryForUrlSync,
    selectedCategoryId,
    uiLocale,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const updateStuckState = () => {
      const stickyEl = inventorySearchStickyRef.current;
      if (!stickyEl) {
        return;
      }

      const style = window.getComputedStyle(stickyEl);
      if (style.position !== "sticky") {
        setIsInventorySearchStickyStuck(false);
        return;
      }

      const topPx = Number.parseFloat(style.top || "0") || 0;
      const nextStuck = stickyEl.getBoundingClientRect().top <= topPx + 0.5;
      setIsInventorySearchStickyStuck((prev) => (prev === nextStuck ? prev : nextStuck));
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

  useEffect(() => {
    if (!hasActiveInventorySearchQuery || !isInventorySearchStickyStuck) {
      return;
    }

    let rafId = 0;
    rafId = window.requestAnimationFrame(() => {
      const stickyEl = inventorySearchStickyRef.current;
      const resultsEl = inventoryResultsRef.current;
      if (!stickyEl || !resultsEl) {
        return;
      }

      const stickyBottom = stickyEl.getBoundingClientRect().bottom;
      const resultsTop = resultsEl.getBoundingClientRect().top;
      const desiredTop = stickyBottom + 8;
      const delta = resultsTop - desiredTop;

      if (delta < -4) {
        window.scrollBy({
          top: delta,
          left: 0,
          behavior: "auto",
        });
      }
    });

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [
    filteredAndSortedProducts.length,
    hasActiveInventorySearchQuery,
    isInventorySearchStickyStuck,
  ]);

  const loadMoreProducts = useCallback(
    async (options?: { silent?: boolean }) => {
      if (isLoadingMoreProducts || isInventoryQueryPending || !hasMoreProducts) {
        return false;
      }

      const currentFetchKey = buildInventoryFetchKey({
        categoryId: selectedCategoryId,
        query: searchQueryForUrlSync,
      });
      setIsLoadingMoreProducts(true);
      try {
        const nextPage = productPage + 1;
        const next = await fetchStockProductsPage(nextPage, {
          categoryId: selectedCategoryId,
          query: searchQueryForUrlSync,
        });
        if (currentFetchKey !== lastFetchedInventoryKeyRef.current) {
          return false;
        }
        setProductItems((prev) => mergeUniqueProducts(prev, next.products));
        setProductPage(next.page);
        setHasMoreProducts(next.hasMore);
        setLastUpdatedAt(new Date().toISOString());
        return true;
      } catch (error) {
        if (!options?.silent) {
          const message =
            error instanceof Error
              ? error.message
              : t(uiLocale, "stock.inventory.error.loadMoreFailed");
          toast.error(message);
        }
        return false;
      } finally {
        setIsLoadingMoreProducts(false);
      }
    },
    [
      fetchStockProductsPage,
      hasMoreProducts,
      isInventoryQueryPending,
      isLoadingMoreProducts,
      productPage,
      searchQueryForUrlSync,
      selectedCategoryId,
      uiLocale,
    ],
  );

  const resolveProductFromBarcode = useCallback(async (barcode: string) => {
    const res = await authFetch(
      `/api/products/search?q=${encodeURIComponent(barcode)}&includeStock=true`,
    );
    const data = (await res.json().catch(() => null)) as
      | {
          products?: ProductListItem[];
        }
      | null;

    if (!res.ok || !Array.isArray(data?.products)) {
      return null;
    }

    const exactMatch = data.products.find(
      (item) => item.barcode?.toLowerCase() === barcode.toLowerCase(),
    );
    return exactMatch ?? data.products[0] ?? null;
  }, []);

  const handleBarcodeResult = useCallback(
    async (barcode: string) => {
      setShowScanner(false);
      const trimmed = barcode.trim();
      if (!trimmed) {
        return;
      }

      setFilter("all");
      setSearchQuery(trimmed);
      setSearchQueryForUrlSync(trimmed);
      setPendingScannedBarcode(trimmed);
      setIsSearchingByBarcode(true);
      try {
        const matchedProduct = await resolveProductFromBarcode(trimmed);
        if (!matchedProduct) {
          setPendingScannedBarcode(null);
          setIsSearchingByBarcode(false);
          toast.error(t(uiLocale, "stock.recording.toast.barcodeNotFound"));
          return;
        }

        if (
          selectedCategoryId &&
          matchedProduct.categoryId &&
          matchedProduct.categoryId !== selectedCategoryId
        ) {
          setPendingScannedBarcode(null);
          setIsSearchingByBarcode(false);
          toast(
            `${t(uiLocale, "stock.recording.toast.foundProduct.prefix")} ${matchedProduct.name} ${t(uiLocale, "stock.inventory.toast.notInSelectedCategory.suffix")}`,
          );
          return;
        }
      } catch {
        setPendingScannedBarcode(null);
        setIsSearchingByBarcode(false);
        toast.error(t(uiLocale, "stock.inventory.toast.searchBarcodeFailed"));
      }
    },
    [
      resolveProductFromBarcode,
      selectedCategoryId,
      uiLocale,
    ],
  );

  useEffect(() => {
    if (!pendingScannedBarcode || isInventoryQueryPending) {
      return;
    }

    const matchedProduct = productItems.find(
      (item) => item.barcode?.toLowerCase() === pendingScannedBarcode.toLowerCase(),
    );

    if (matchedProduct) {
      toast.success(
        `${t(uiLocale, "stock.recording.toast.foundProduct.prefix")} ${matchedProduct.name}`,
      );
      highlightProduct(matchedProduct.productId);
    } else {
      toast.error(t(uiLocale, "stock.recording.toast.barcodeNotFound"));
    }

    setPendingScannedBarcode(null);
    setIsSearchingByBarcode(false);
  }, [
    highlightProduct,
    isInventoryQueryPending,
    pendingScannedBarcode,
    productItems,
    uiLocale,
  ]);

  const openScanner = () => {
    if (hasSeenScannerPermission) {
      setShowScanner(true);
    } else {
      setShowScannerPermission(true);
    }
  };
  const clearInventorySearch = () => {
    setPendingScannedBarcode(null);
    setSearchQuery("");
    setSearchQueryForUrlSync("");
  };

  return (
    <section className="space-y-2">
      <StockTabToolbar
        title={t(uiLocale, "stock.tabs.inventory.mobile")}
        isRefreshing={isRefreshingData}
        lastUpdatedAt={lastUpdatedAt}
        onRefresh={() => {
          void refreshInventoryData();
        }}
      />

      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => setFilter("out")}
          className={`rounded-lg border p-3 text-left transition-colors ${
            filter === "out"
              ? "border-red-300 bg-red-50"
              : "bg-white hover:bg-slate-50"
          }`}
        >
          <p className="text-xs text-slate-600">{t(uiLocale, "stock.inventory.stat.out")}</p>
          <p className="text-2xl font-bold text-red-600">{stats.out}</p>
        </button>

        <button
          type="button"
          onClick={() => setFilter("low")}
          className={`rounded-lg border p-3 text-left transition-colors ${
            filter === "low"
              ? "border-amber-300 bg-amber-50"
              : "bg-white hover:bg-slate-50"
          }`}
        >
          <p className="text-xs text-slate-600">{t(uiLocale, "stock.inventory.stat.low")}</p>
          <p className="text-2xl font-bold text-amber-600">{stats.low}</p>
        </button>

        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`rounded-lg border p-3 text-left transition-colors ${
            filter === "all"
              ? "border-emerald-300 bg-emerald-50"
              : "bg-white hover:bg-slate-50"
          }`}
        >
          <p className="text-xs text-slate-600">{t(uiLocale, "common.filter.all")}</p>
          <p className="text-2xl font-bold text-emerald-600">
            {productItems.length.toLocaleString(numberLocale)}
          </p>
        </button>
      </div>

      <div
        ref={inventorySearchStickyRef}
        className={`sticky top-[3.8rem] z-10 transition-[margin,padding,background-color,box-shadow,border-color] ${
          isInventorySearchStickyStuck
            ? "-mx-4 border-y border-slate-200 bg-white px-4 py-2 shadow-sm supports-[backdrop-filter]:bg-white md:-mx-6 md:px-6 min-[1200px]:-mx-8 min-[1200px]:px-8"
            : "px-0 py-2"
        }`}
      >
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t(uiLocale, "stock.inventory.search.placeholder")}
              className="h-10 w-full rounded-md border pl-9 pr-9 text-sm outline-none focus:border-blue-300"
            />
            {isInventoryQueryPending ? (
              <LoaderCircle className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
            ) : searchQuery ? (
              <button
                type="button"
                onClick={clearInventorySearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <Button
            type="button"
            variant="outline"
            className="h-10 w-10 shrink-0 p-0"
            onClick={openScanner}
            disabled={isSearchingByBarcode}
          >
            <ScanBarcode className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <article className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div
            className={`relative flex min-w-0 flex-1 items-center rounded-xl border transition-colors sm:flex-none ${
              selectedCategoryId
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <ListFilter className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-current/70" />
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="h-10 w-full appearance-none rounded-xl bg-transparent py-2 pl-8 pr-8 text-sm font-medium outline-none ring-blue-500 focus:ring-1 sm:min-w-[10rem] sm:w-auto"
            >
              <option value="">{t(uiLocale, "stock.inventory.category.all")}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 h-3.5 w-3.5 text-current/60" />
          </div>

          <div className="relative flex min-w-0 flex-1 items-center rounded-xl border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50 sm:flex-none">
            <ArrowUpDown className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-current/70" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="h-10 w-full appearance-none rounded-xl bg-transparent py-2 pl-8 pr-8 text-sm font-medium outline-none ring-blue-500 focus:ring-1 sm:min-w-[9rem] sm:w-auto"
            >
              <option value="name">{t(uiLocale, "stock.inventory.sort.name")}</option>
              <option value="sku">{t(uiLocale, "products.label.sku")}</option>
              <option value="stock-low">{t(uiLocale, "stock.inventory.sort.stockLow")}</option>
              <option value="stock-high">{t(uiLocale, "stock.inventory.sort.stockHigh")}</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 h-3.5 w-3.5 text-current/60" />
          </div>
        </div>

        <p className="mt-2 text-xs text-slate-500">
          {t(uiLocale, "stock.inventory.summary.showing.prefix")}{" "}
          {filteredAndSortedProducts.length.toLocaleString(numberLocale)}{" "}
          {t(uiLocale, "stock.inventory.summary.showing.middle")}{" "}
          {productItems.length.toLocaleString(numberLocale)}{" "}
          {t(uiLocale, "stock.inventory.summary.showing.suffix")}
        </p>
      </article>

      {shouldShowInventoryListSkeleton ? (
        <div className="space-y-2">
          {Array.from({ length: INVENTORY_LIST_SKELETON_COUNT }).map((_, index) => (
            <article
              key={`inventory-loading-${index}`}
              className="rounded-xl border bg-white p-4 shadow-sm"
            >
              <div className="animate-pulse space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-20 rounded bg-slate-200" />
                    <div className="h-4 w-40 rounded bg-slate-200" />
                    <div className="h-3 w-24 rounded bg-slate-100" />
                  </div>
                  <div className="h-6 w-16 rounded-full bg-slate-200" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="h-20 rounded-lg bg-slate-100" />
                  <div className="h-20 rounded-lg bg-slate-100" />
                  <div className="h-20 rounded-lg bg-slate-100" />
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : dataError && productItems.length === 0 ? (
        <StockTabErrorState
          message={dataError}
          onRetry={() => {
            void refreshInventoryData();
          }}
        />
      ) : productItems.length === 0 ? (
        <StockTabEmptyState
          title={t(uiLocale, "stock.inventory.empty.title")}
          description={t(uiLocale, "stock.inventory.empty.description")}
        />
      ) : (
        <>
          <div
            ref={inventoryResultsRef}
            className={`space-y-2 transition-opacity ${
              isInventoryQueryPending ? "opacity-60" : "opacity-100"
            }`}
            style={
              isInventoryCompactSearchMode
                ? { minHeight: "calc(100dvh - 11rem)" }
                : undefined
            }
          >
            {filteredAndSortedProducts.length === 0 ? (
              <article className="rounded-xl border bg-white p-8 text-center shadow-sm">
                <Package className="mx-auto h-12 w-12 text-slate-300" />
                <p className="mt-2 text-sm text-slate-600">
                  {t(uiLocale, "stock.inventory.empty.noResults")}
                </p>
              </article>
            ) : (
              filteredAndSortedProducts.map((product) => {
                const { outThreshold, lowThreshold } = resolveThresholds(product);
                const stockStatus =
                  product.available <= outThreshold
                    ? "out"
                    : product.available <= lowThreshold
                      ? "low"
                      : "good";

                return (
                  <article
                    key={product.productId}
                    id={`product-${product.productId}`}
                    className="rounded-xl border bg-white p-4 shadow-sm transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-start gap-2">
                          <div className="flex-1">
                            <p className="text-xs text-slate-500">{product.sku}</p>
                            <p className="text-sm font-medium">{product.name}</p>
                            <p className="text-xs text-slate-500">
                              {t(uiLocale, "products.form.baseUnit.label")}: {product.baseUnitCode}
                            </p>
                            {product.barcode ? (
                              <p className="text-[11px] text-slate-500">
                                {t(uiLocale, "products.label.barcode")}: {product.barcode}
                              </p>
                            ) : null}
                          </div>
                          <span
                            className={`rounded-full px-2 py-1 text-xs ${
                              product.active
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            {product.active
                              ? t(uiLocale, "products.status.active")
                              : t(uiLocale, "products.status.inactive")}
                          </span>
                        </div>

                        <div className="mt-3 grid grid-cols-3 gap-2">
                          <div className="rounded-lg bg-slate-50 p-2">
                            <p className="text-xs text-slate-600">
                              {t(uiLocale, "stock.recording.currentStock.onHand")}
                            </p>
                            <p className="text-lg font-bold text-slate-900">
                              {product.onHand.toLocaleString(numberLocale)}
                            </p>
                          </div>

                          <div className="rounded-lg bg-amber-50 p-2">
                            <p className="text-xs text-amber-700">
                              {t(uiLocale, "stock.recording.currentStock.reserved")}
                            </p>
                            <p className="text-lg font-bold text-amber-900">
                              {product.reserved.toLocaleString(numberLocale)}
                            </p>
                          </div>

                          <div
                            className={`rounded-lg p-2 ${
                              stockStatus === "out"
                                ? "bg-red-50"
                                : stockStatus === "low"
                                  ? "bg-amber-50"
                                  : "bg-emerald-50"
                            }`}
                          >
                            <p
                              className={`text-xs ${
                                stockStatus === "out"
                                  ? "text-red-700"
                                  : stockStatus === "low"
                                    ? "text-amber-700"
                                    : "text-emerald-700"
                              }`}
                            >
                              {t(uiLocale, "stock.recording.currentStock.available")}
                            </p>
                            <p
                              className={`text-lg font-bold ${
                                stockStatus === "out"
                                  ? "text-red-900"
                                  : stockStatus === "low"
                                    ? "text-amber-900"
                                    : "text-emerald-900"
                              }`}
                            >
                              {product.available.toLocaleString(numberLocale)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>

          {hasMoreProducts ? (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  void loadMoreProducts();
                }}
                disabled={isLoadingMoreProducts || isInventoryQueryPending}
              >
                {isLoadingMoreProducts
                  ? t(uiLocale, "products.list.loadingMore")
                  : t(uiLocale, "products.list.loadMore")}
              </Button>
            </div>
          ) : null}
        </>
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
                setShowScannerPermission(false);
                setShowScanner(true);
                window.localStorage.setItem(SCANNER_PERMISSION_STORAGE_KEY, "1");
                setHasSeenScannerPermission(true);
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
        <div className="p-4">
          {showScanner ? (
            <BarcodeScannerPanel
              isOpen={showScanner}
              onResult={handleBarcodeResult}
              onClose={() => setShowScanner(false)}
              cameraSelectId="stock-inventory-barcode-scanner-camera-select"
            />
          ) : null}
        </div>
      </SlideUpSheet>
    </section>
  );
}
