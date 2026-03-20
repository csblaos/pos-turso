import "server-only";

import { eq } from "drizzle-orm";

import { redisDelete, redisGetJson, redisSetJson } from "@/lib/cache/redis";
import { db } from "@/lib/db/client";
import { stores } from "@/lib/db/schema";
import type { ReportsFilterState } from "@/lib/reports/filters";
import {
  getCodOverviewSummary,
  getGrossProfitSummary,
  getOutstandingPurchaseRows,
  getPurchaseApAgingSummary,
  getPurchaseFxDeltaSummary,
  getSalesOverview,
  getSalesTrend,
  getSalesByChannel,
  getTopProducts,
  type GrossProfitSummary,
  type CodOverviewSummary,
  type PurchaseApAgingSummary,
  type PurchaseFxDeltaSummary,
  type PurchaseOutstandingRow,
  type SalesOverviewSummary,
  type SalesTrendPoint,
  type SalesByChannelRow,
  type TopProductRow,
} from "@/lib/reports/queries";

const REPORTS_OVERVIEW_TTL_SECONDS = 20;

const reportsOverviewCacheKey = (
  storeId: string,
  topProductsLimit: number,
  filters: ReportsFilterState,
) => {
  return `reports:overview:${storeId}:${topProductsLimit}:${filters.preset}:${filters.dateFrom}:${filters.dateTo}:${filters.channel}`;
};

export type ReportsViewData = {
  storeCurrency: string;
  salesOverview: SalesOverviewSummary;
  salesTrend: SalesTrendPoint[];
  filters: ReportsFilterState;
  topProducts: TopProductRow[];
  salesByChannel: SalesByChannelRow[];
  grossProfit: GrossProfitSummary;
  codOverview: CodOverviewSummary;
  purchaseFx: PurchaseFxDeltaSummary;
  purchaseApAging: PurchaseApAgingSummary;
};

export async function invalidateReportsOverviewCache(
  storeId: string,
  filters?: ReportsFilterState,
  topProductsLimit = 10,
) {
  if (!filters) {
    return;
  }
  await redisDelete(reportsOverviewCacheKey(storeId, topProductsLimit, filters));
}

export async function getReportsViewData(params: {
  storeId: string;
  filters: ReportsFilterState;
  topProductsLimit?: number;
  useCache?: boolean;
}): Promise<ReportsViewData> {
  const topProductsLimit = params.topProductsLimit ?? 10;
  const useCache = params.useCache ?? true;
  const cacheKey = reportsOverviewCacheKey(params.storeId, topProductsLimit, params.filters);

  if (useCache) {
    const cached = await redisGetJson<ReportsViewData>(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const [salesOverview, salesTrend, topProducts, salesByChannel, grossProfit, codOverview, storeRow] =
    await Promise.all([
      getSalesOverview(params.storeId, params.filters),
      getSalesTrend(params.storeId, params.filters),
      getTopProducts(params.storeId, params.filters, topProductsLimit),
      getSalesByChannel(params.storeId, params.filters),
      getGrossProfitSummary(params.storeId, params.filters),
      getCodOverviewSummary(params.storeId),
      db
        .select({ currency: stores.currency })
        .from(stores)
        .where(eq(stores.id, params.storeId))
        .limit(1)
        .then((rows) => rows[0] ?? null),
    ]);
  const storeCurrency = (storeRow?.currency ?? "LAK") as "LAK" | "THB" | "USD";
  const [purchaseFx, purchaseApAging] = await Promise.all([
    getPurchaseFxDeltaSummary(params.storeId, storeCurrency),
    getPurchaseApAgingSummary(params.storeId, storeCurrency),
  ]);

  const response: ReportsViewData = {
    storeCurrency,
    salesOverview,
    salesTrend,
    filters: params.filters,
    topProducts,
    salesByChannel,
    grossProfit,
    codOverview,
    purchaseFx,
    purchaseApAging,
  };

  if (useCache) {
    await redisSetJson(cacheKey, response, REPORTS_OVERVIEW_TTL_SECONDS);
  }

  return response;
}

export async function getOutstandingPurchaseRowsForExport(storeId: string) {
  const [storeRow] = await db
    .select({ currency: stores.currency })
    .from(stores)
    .where(eq(stores.id, storeId))
    .limit(1);
  const storeCurrency = (storeRow?.currency ?? "LAK") as "LAK" | "THB" | "USD";
  const rows = await getOutstandingPurchaseRows(storeId, storeCurrency);
  return {
    storeCurrency,
    rows,
  } satisfies { storeCurrency: string; rows: PurchaseOutstandingRow[] };
}
