import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { redisGetJson, redisSetJson } from "@/lib/cache/redis";
import { db } from "@/lib/db/client";
import {
  orderItems,
  orders,
  products,
  purchaseOrderItems,
  purchaseOrderPayments,
  purchaseOrders,
} from "@/lib/db/schema";
import { getLowStockProducts, getStoreStockThresholds } from "@/lib/inventory/queries";
import { timeAsync, timeDbQuery } from "@/lib/perf/server";
import type { ReportChannelFilter } from "@/lib/reports/filters";

const paidStatuses = ["PAID", "PACKED", "SHIPPED"] as const;
const pendingStatuses = [
  "PENDING_PAYMENT",
  "READY_FOR_PICKUP",
  "PICKED_UP_PENDING_PAYMENT",
] as const;

export type DashboardMetrics = {
  todaySales: number;
  ordersCountToday: number;
  pendingPaymentCount: number;
  lowStockCount: number;
};

export type SalesOverviewSummary = {
  salesTotal: number;
  orderCount: number;
  averageOrderValue: number;
};

export type SalesTrendPoint = {
  bucketDate: string;
  salesTotal: number;
  orderCount: number;
};

export type TopProductRow = {
  productId: string;
  sku: string;
  name: string;
  qtyBaseSold: number;
  revenue: number;
  cogs: number;
};

export type SalesByChannelRow = {
  channel: "WALK_IN" | "FACEBOOK" | "WHATSAPP";
  orderCount: number;
  salesTotal: number;
};

export type GrossProfitSummary = {
  revenue: number;
  cogs: number;
  currentCostCogs: number;
  shippingCost: number;
  grossProfit: number;
  currentCostGrossProfit: number;
  grossProfitDeltaVsCurrentCost: number;
};

export type CodByProviderRow = {
  provider: string;
  pendingCount: number;
  pendingAmount: number;
  settledCount: number;
  settledAmount: number;
  returnedCount: number;
  returnedShippingLoss: number;
  returnedCodFee: number;
  netAmount: number;
};

export type CodOverviewSummary = {
  pendingCount: number;
  pendingAmount: number;
  settledTodayCount: number;
  settledTodayAmount: number;
  returnedTodayCount: number;
  returnedTodayShippingLoss: number;
  returnedTodayCodFee: number;
  settledAllCount: number;
  settledAllAmount: number;
  returnedCount: number;
  returnedShippingLoss: number;
  returnedCodFee: number;
  netAmount: number;
  byProvider: CodByProviderRow[];
};

export type PurchaseFxDeltaSummary = {
  pendingRateCount: number;
  pendingRateUnpaidCount: number;
  lockedCount: number;
  changedRateCount: number;
  totalRateDeltaBase: number;
  recentLocks: {
    id: string;
    poNumber: string;
    supplierName: string | null;
    purchaseCurrency: "LAK" | "THB" | "USD";
    exchangeRateInitial: number;
    exchangeRate: number;
    exchangeRateLockedAt: string | null;
    paymentStatus: "UNPAID" | "PARTIAL" | "PAID";
  }[];
};

export type PurchaseOutstandingRow = {
  poId: string;
  poNumber: string;
  supplierName: string | null;
  purchaseCurrency: "LAK" | "THB" | "USD";
  dueDate: string | null;
  receivedAt: string | null;
  paymentStatus: "UNPAID" | "PARTIAL" | "PAID";
  grandTotalBase: number;
  totalPaidBase: number;
  outstandingBase: number;
  ageDays: number;
  fxDeltaBase: number;
  exchangeRateInitial: number;
  exchangeRate: number;
  exchangeRateLockedAt: string | null;
};

const PURCHASE_OUTSTANDING_EPSILON_BASE = 5;

function normalizePurchaseOutstandingBase(
  totalPaidBase: number,
  grandTotalBase: number,
): number {
  const rawOutstanding = grandTotalBase - totalPaidBase;
  if (rawOutstanding <= PURCHASE_OUTSTANDING_EPSILON_BASE) {
    return 0;
  }
  return rawOutstanding;
}

function derivePurchaseOutstandingPaymentStatus(
  totalPaidBase: number,
  grandTotalBase: number,
): "UNPAID" | "PARTIAL" | "PAID" {
  const normalizedOutstanding = normalizePurchaseOutstandingBase(
    totalPaidBase,
    grandTotalBase,
  );
  if (totalPaidBase <= 0) return "UNPAID";
  if (normalizedOutstanding <= 0) return "PAID";
  return "PARTIAL";
}

function resolvePurchaseOutstandingProductBase(params: {
  purchaseCurrency: "LAK" | "THB" | "USD";
  storeCurrency: "LAK" | "THB" | "USD";
  totalCostBaseRaw: number;
  totalCostPurchase: number;
  exchangeRateInitial: number;
  exchangeRate: number;
  exchangeRateLockedAt: string | null;
}): number {
  const {
    purchaseCurrency,
    storeCurrency,
    totalCostBaseRaw,
    totalCostPurchase,
    exchangeRateInitial,
    exchangeRate,
    exchangeRateLockedAt,
  } = params;

  if (totalCostBaseRaw > 0) {
    return totalCostBaseRaw;
  }
  if (purchaseCurrency === storeCurrency || totalCostPurchase <= 0) {
    return totalCostBaseRaw;
  }

  const effectiveRate =
    exchangeRateLockedAt && exchangeRate > 0 ? exchangeRate : exchangeRateInitial;
  if (!Number.isFinite(effectiveRate) || effectiveRate <= 0) {
    return totalCostBaseRaw;
  }

  return Math.round(totalCostPurchase * effectiveRate);
}

export type PurchaseApAgingSummary = {
  totalOutstandingBase: number;
  bucket0To30: {
    count: number;
    amountBase: number;
  };
  bucket31To60: {
    count: number;
    amountBase: number;
  };
  bucket61Plus: {
    count: number;
    amountBase: number;
  };
  suppliers: {
    supplierName: string;
    outstandingBase: number;
    fxDeltaBase: number;
    poCount: number;
  }[];
};

const DASHBOARD_METRICS_TTL_SECONDS = 20;

export type ReportsQueryFilters = {
  dateFrom: string;
  dateTo: string;
  channel: ReportChannelFilter;
};

function dashboardMetricsCacheKey(storeId: string) {
  const dayKey = new Date().toISOString().slice(0, 10);
  return `reports:dashboard_metrics:${storeId}:${dayKey}`;
}

async function fetchDashboardMetrics(storeId: string): Promise<DashboardMetrics> {
  const [todaySalesRow, ordersCountRow, pendingRow, lowStockRows] = await Promise.all([
    timeDbQuery("reports.dashboard.todaySales", async () =>
      db
        .select({
          value: sql<number>`coalesce(sum(${orders.total}), 0)`,
        })
        .from(orders)
        .where(
          and(
            eq(orders.storeId, storeId),
            inArray(orders.status, paidStatuses),
            sql`${orders.paidAt} >= datetime('now', 'localtime', 'start of day', 'utc')`,
            sql`${orders.paidAt} < datetime('now', 'localtime', 'start of day', '+1 day', 'utc')`,
          ),
        ),
    ),
    timeDbQuery("reports.dashboard.ordersCount", async () =>
      db
        .select({
          value: sql<number>`count(*)`,
        })
        .from(orders)
        .where(
          and(
            eq(orders.storeId, storeId),
            sql`${orders.createdAt} >= datetime('now', 'localtime', 'start of day', 'utc')`,
            sql`${orders.createdAt} < datetime('now', 'localtime', 'start of day', '+1 day', 'utc')`,
          ),
        ),
    ),
    timeDbQuery("reports.dashboard.pendingPayment", async () =>
      db
        .select({
          value: sql<number>`count(*)`,
        })
        .from(orders)
        .where(and(eq(orders.storeId, storeId), inArray(orders.status, pendingStatuses))),
    ),
    getStoreStockThresholds(storeId).then((thresholds) =>
      getLowStockProducts(storeId, thresholds),
    ),
  ]);

  return {
    todaySales: Number(todaySalesRow[0]?.value ?? 0),
    ordersCountToday: Number(ordersCountRow[0]?.value ?? 0),
    pendingPaymentCount: Number(pendingRow[0]?.value ?? 0),
    lowStockCount: lowStockRows.length,
  };
}

export async function getDashboardMetrics(storeId: string): Promise<DashboardMetrics> {
  return timeAsync("reports.dashboard.metrics.total", async () => {
    const cacheKey = dashboardMetricsCacheKey(storeId);
    const cached = await redisGetJson<DashboardMetrics>(cacheKey);
    if (cached) {
      return cached;
    }

    const metrics = await fetchDashboardMetrics(storeId);
    await redisSetJson(cacheKey, metrics, DASHBOARD_METRICS_TTL_SECONDS);
    return metrics;
  });
}

function buildPaidOrderFilters(storeId: string, filters: ReportsQueryFilters) {
  const conditions = [
    eq(orders.storeId, storeId),
    inArray(orders.status, paidStatuses),
    sql`${orders.paidAt} is not null`,
    sql`date(${orders.paidAt}, 'localtime') >= ${filters.dateFrom}`,
    sql`date(${orders.paidAt}, 'localtime') <= ${filters.dateTo}`,
  ];

  if (filters.channel !== "ALL") {
    conditions.push(eq(orders.channel, filters.channel));
  }

  return and(...conditions);
}

export async function getSalesOverview(
  storeId: string,
  filters: ReportsQueryFilters,
): Promise<SalesOverviewSummary> {
  const rows = await timeDbQuery("reports.salesOverview.range", async () =>
    db
      .select({
        salesTotal: sql<number>`coalesce(sum(${orders.total}), 0)`,
        orderCount: sql<number>`count(*)`,
      })
      .from(orders)
      .where(buildPaidOrderFilters(storeId, filters)),
  );

  const salesTotal = Number(rows[0]?.salesTotal ?? 0);
  const orderCount = Number(rows[0]?.orderCount ?? 0);

  return {
    salesTotal,
    orderCount,
    averageOrderValue: orderCount > 0 ? salesTotal / orderCount : 0,
  };
}

export async function getSalesTrend(
  storeId: string,
  filters: ReportsQueryFilters,
): Promise<SalesTrendPoint[]> {
  const rows = await timeDbQuery("reports.salesTrend.range", async () =>
    db
      .select({
        bucketDate: sql<string>`date(${orders.paidAt}, 'localtime')`,
        salesTotal: sql<number>`coalesce(sum(${orders.total}), 0)`,
        orderCount: sql<number>`count(*)`,
      })
      .from(orders)
      .where(buildPaidOrderFilters(storeId, filters))
      .groupBy(sql`date(${orders.paidAt}, 'localtime')`)
      .orderBy(sql`date(${orders.paidAt}, 'localtime') asc`),
  );

  return rows.map((row) => ({
    bucketDate: row.bucketDate,
    salesTotal: Number(row.salesTotal ?? 0),
    orderCount: Number(row.orderCount ?? 0),
  }));
}

export async function getTopProducts(
  storeId: string,
  filters: ReportsQueryFilters,
  limit = 10,
): Promise<TopProductRow[]> {
  const rows = await timeDbQuery("reports.topProducts", async () =>
    db
      .select({
        productId: products.id,
        sku: products.sku,
        name: products.name,
        qtyBaseSold: sql<number>`coalesce(sum(${orderItems.qtyBase}), 0)`,
        revenue: sql<number>`coalesce(sum(${orderItems.lineTotal}), 0)`,
        cogs: sql<number>`coalesce(sum(${orderItems.qtyBase} * ${orderItems.costBaseAtSale}), 0)`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .innerJoin(products, eq(orderItems.productId, products.id))
      .where(buildPaidOrderFilters(storeId, filters))
      .groupBy(products.id, products.sku, products.name)
      .orderBy(sql`sum(${orderItems.lineTotal}) desc`)
      .limit(limit),
  );

  return rows.map((row) => ({
    ...row,
    qtyBaseSold: Number(row.qtyBaseSold ?? 0),
    revenue: Number(row.revenue ?? 0),
    cogs: Number(row.cogs ?? 0),
  }));
}

export async function getSalesByChannel(
  storeId: string,
  filters: ReportsQueryFilters,
): Promise<SalesByChannelRow[]> {
  const rows = await timeDbQuery("reports.salesByChannel", async () =>
    db
      .select({
        channel: orders.channel,
        orderCount: sql<number>`count(*)`,
        salesTotal: sql<number>`coalesce(sum(${orders.total}), 0)`,
      })
      .from(orders)
      .where(buildPaidOrderFilters(storeId, filters))
      .groupBy(orders.channel)
      .orderBy(sql`sum(${orders.total}) desc`),
  );

  return rows.map((row) => ({
    channel: row.channel,
    orderCount: Number(row.orderCount ?? 0),
    salesTotal: Number(row.salesTotal ?? 0),
  }));
}

export async function getGrossProfitSummary(
  storeId: string,
  filters: ReportsQueryFilters,
): Promise<GrossProfitSummary> {
  const [revenueRows, cogsRows, currentCostCogsRows, shippingRows] = await Promise.all([
    timeDbQuery("reports.grossProfit.revenue", async () =>
      db
        .select({ value: sql<number>`coalesce(sum(${orders.total}), 0)` })
        .from(orders)
        .where(buildPaidOrderFilters(storeId, filters)),
    ),
    timeDbQuery("reports.grossProfit.cogs", async () =>
      db
        .select({
          value: sql<number>`coalesce(sum(${orderItems.qtyBase} * ${orderItems.costBaseAtSale}), 0)`,
        })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(buildPaidOrderFilters(storeId, filters)),
    ),
    timeDbQuery("reports.grossProfit.currentCostCogs", async () =>
      db
        .select({
          value: sql<number>`coalesce(sum(${orderItems.qtyBase} * ${products.costBase}), 0)`,
        })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .innerJoin(products, eq(orderItems.productId, products.id))
        .where(buildPaidOrderFilters(storeId, filters)),
    ),
    timeDbQuery("reports.grossProfit.shipping", async () =>
      db
        .select({ value: sql<number>`coalesce(sum(${orders.shippingCost}), 0)` })
        .from(orders)
        .where(buildPaidOrderFilters(storeId, filters)),
    ),
  ]);

  const revenue = Number(revenueRows[0]?.value ?? 0);
  const cogs = Number(cogsRows[0]?.value ?? 0);
  const currentCostCogs = Number(currentCostCogsRows[0]?.value ?? 0);
  const shippingCost = Number(shippingRows[0]?.value ?? 0);
  const grossProfit = revenue - cogs - shippingCost;
  const currentCostGrossProfit = revenue - currentCostCogs - shippingCost;

  return {
    revenue,
    cogs,
    currentCostCogs,
    shippingCost,
    grossProfit,
    currentCostGrossProfit,
    grossProfitDeltaVsCurrentCost: grossProfit - currentCostGrossProfit,
  };
}

export async function getCodOverviewSummary(
  storeId: string,
): Promise<CodOverviewSummary> {
  const providerExpr = sql<string>`coalesce(
    nullif(trim(${orders.shippingProvider}), ''),
    nullif(trim(${orders.shippingCarrier}), ''),
    'ไม่ระบุ'
  )`;

  const codAmountExpr = sql<number>`case
    when ${orders.codAmount} > 0 then ${orders.codAmount}
    else ${orders.total}
  end`;

  const [overviewRows, byProviderRows] = await Promise.all([
    timeDbQuery("reports.cod.overview", async () =>
      db
        .select({
          pendingCount: sql<number>`coalesce(sum(case
            when ${orders.status} = 'SHIPPED'
              and ${orders.paymentStatus} = 'COD_PENDING_SETTLEMENT'
            then 1 else 0 end), 0)`,
          pendingAmount: sql<number>`coalesce(sum(case
            when ${orders.status} = 'SHIPPED'
              and ${orders.paymentStatus} = 'COD_PENDING_SETTLEMENT'
            then ${codAmountExpr}
            else 0 end), 0)`,
          settledTodayCount: sql<number>`coalesce(sum(case
            when ${orders.paymentStatus} = 'COD_SETTLED'
              and ${orders.codSettledAt} >= datetime('now', 'localtime', 'start of day', 'utc')
              and ${orders.codSettledAt} < datetime('now', 'localtime', 'start of day', '+1 day', 'utc')
            then 1 else 0 end), 0)`,
          settledTodayAmount: sql<number>`coalesce(sum(case
            when ${orders.paymentStatus} = 'COD_SETTLED'
              and ${orders.codSettledAt} >= datetime('now', 'localtime', 'start of day', 'utc')
              and ${orders.codSettledAt} < datetime('now', 'localtime', 'start of day', '+1 day', 'utc')
            then ${codAmountExpr}
            else 0 end), 0)`,
          returnedTodayCount: sql<number>`coalesce(sum(case
            when ${orders.status} = 'COD_RETURNED'
              and ${orders.codReturnedAt} >= datetime('now', 'localtime', 'start of day', 'utc')
              and ${orders.codReturnedAt} < datetime('now', 'localtime', 'start of day', '+1 day', 'utc')
            then 1 else 0 end), 0)`,
          returnedTodayShippingLoss: sql<number>`coalesce(sum(case
            when ${orders.status} = 'COD_RETURNED'
              and ${orders.codReturnedAt} >= datetime('now', 'localtime', 'start of day', 'utc')
              and ${orders.codReturnedAt} < datetime('now', 'localtime', 'start of day', '+1 day', 'utc')
            then ${orders.shippingCost}
            else 0 end), 0)`,
          returnedTodayCodFee: sql<number>`coalesce(sum(case
            when ${orders.status} = 'COD_RETURNED'
              and ${orders.codReturnedAt} >= datetime('now', 'localtime', 'start of day', 'utc')
              and ${orders.codReturnedAt} < datetime('now', 'localtime', 'start of day', '+1 day', 'utc')
            then ${orders.codFee}
            else 0 end), 0)`,
          settledAllCount: sql<number>`coalesce(sum(case
            when ${orders.paymentStatus} = 'COD_SETTLED'
            then 1 else 0 end), 0)`,
          settledAllAmount: sql<number>`coalesce(sum(case
            when ${orders.paymentStatus} = 'COD_SETTLED'
            then ${codAmountExpr}
            else 0 end), 0)`,
          returnedCount: sql<number>`coalesce(sum(case
            when ${orders.status} = 'COD_RETURNED'
            then 1 else 0 end), 0)`,
          returnedShippingLoss: sql<number>`coalesce(sum(case
            when ${orders.status} = 'COD_RETURNED'
            then ${orders.shippingCost}
            else 0 end), 0)`,
          returnedCodFee: sql<number>`coalesce(sum(case
            when ${orders.status} = 'COD_RETURNED'
            then ${orders.codFee}
            else 0 end), 0)`,
        })
        .from(orders)
        .where(and(eq(orders.storeId, storeId), eq(orders.paymentMethod, "COD"))),
    ),
    timeDbQuery("reports.cod.byProvider", async () =>
      db
        .select({
          provider: providerExpr,
          pendingCount: sql<number>`coalesce(sum(case
            when ${orders.status} = 'SHIPPED'
              and ${orders.paymentStatus} = 'COD_PENDING_SETTLEMENT'
            then 1 else 0 end), 0)`,
          pendingAmount: sql<number>`coalesce(sum(case
            when ${orders.status} = 'SHIPPED'
              and ${orders.paymentStatus} = 'COD_PENDING_SETTLEMENT'
            then ${codAmountExpr}
            else 0 end), 0)`,
          settledCount: sql<number>`coalesce(sum(case
            when ${orders.paymentStatus} = 'COD_SETTLED'
            then 1 else 0 end), 0)`,
          settledAmount: sql<number>`coalesce(sum(case
            when ${orders.paymentStatus} = 'COD_SETTLED'
            then ${codAmountExpr}
            else 0 end), 0)`,
          returnedCount: sql<number>`coalesce(sum(case
            when ${orders.status} = 'COD_RETURNED'
            then 1 else 0 end), 0)`,
          returnedShippingLoss: sql<number>`coalesce(sum(case
            when ${orders.status} = 'COD_RETURNED'
            then ${orders.shippingCost}
            else 0 end), 0)`,
          returnedCodFee: sql<number>`coalesce(sum(case
            when ${orders.status} = 'COD_RETURNED'
            then ${orders.codFee}
            else 0 end), 0)`,
        })
        .from(orders)
        .where(and(eq(orders.storeId, storeId), eq(orders.paymentMethod, "COD")))
        .groupBy(providerExpr)
        .orderBy(desc(sql`coalesce(sum(case
          when ${orders.paymentStatus} = 'COD_SETTLED'
          then ${codAmountExpr}
          else 0 end), 0)`)),
    ),
  ]);

  const overview = overviewRows[0];
  const pendingCount = Number(overview?.pendingCount ?? 0);
  const pendingAmount = Number(overview?.pendingAmount ?? 0);
  const settledTodayCount = Number(overview?.settledTodayCount ?? 0);
  const settledTodayAmount = Number(overview?.settledTodayAmount ?? 0);
  const returnedTodayCount = Number(overview?.returnedTodayCount ?? 0);
  const returnedTodayShippingLoss = Number(overview?.returnedTodayShippingLoss ?? 0);
  const returnedTodayCodFee = Number(overview?.returnedTodayCodFee ?? 0);
  const settledAllCount = Number(overview?.settledAllCount ?? 0);
  const settledAllAmount = Number(overview?.settledAllAmount ?? 0);
  const returnedCount = Number(overview?.returnedCount ?? 0);
  const returnedShippingLoss = Number(overview?.returnedShippingLoss ?? 0);
  const returnedCodFee = Number(overview?.returnedCodFee ?? 0);

  const byProvider: CodByProviderRow[] = byProviderRows.map((row) => {
    const settledAmount = Number(row.settledAmount ?? 0);
    const returnedShippingLoss = Number(row.returnedShippingLoss ?? 0);
    const returnedCodFee = Number(row.returnedCodFee ?? 0);
    return {
      provider: row.provider,
      pendingCount: Number(row.pendingCount ?? 0),
      pendingAmount: Number(row.pendingAmount ?? 0),
      settledCount: Number(row.settledCount ?? 0),
      settledAmount,
      returnedCount: Number(row.returnedCount ?? 0),
      returnedShippingLoss,
      returnedCodFee,
      netAmount: settledAmount - returnedShippingLoss,
    };
  });

  return {
    pendingCount,
    pendingAmount,
    settledTodayCount,
    settledTodayAmount,
    returnedTodayCount,
    returnedTodayShippingLoss,
    returnedTodayCodFee,
    settledAllCount,
    settledAllAmount,
    returnedCount,
    returnedShippingLoss,
    returnedCodFee,
    netAmount: settledAllAmount - returnedShippingLoss,
    byProvider,
  };
}

export async function getPurchaseFxDeltaSummary(
  storeId: string,
  storeCurrency: "LAK" | "THB" | "USD",
): Promise<PurchaseFxDeltaSummary> {
  const [summaryRows, recentRows] = await Promise.all([
    timeDbQuery("reports.purchaseFx.summary", async () =>
      db
        .select({
          pendingRateCount: sql<number>`coalesce(sum(case
            when ${purchaseOrders.status} = 'RECEIVED'
              and ${purchaseOrders.purchaseCurrency} <> ${storeCurrency}
              and ${purchaseOrders.exchangeRateLockedAt} is null
            then 1 else 0 end), 0)`,
          pendingRateUnpaidCount: sql<number>`coalesce(sum(case
            when ${purchaseOrders.status} = 'RECEIVED'
              and ${purchaseOrders.purchaseCurrency} <> ${storeCurrency}
              and ${purchaseOrders.exchangeRateLockedAt} is null
              and ${purchaseOrders.paymentStatus} = 'UNPAID'
            then 1 else 0 end), 0)`,
          lockedCount: sql<number>`coalesce(sum(case
            when ${purchaseOrders.purchaseCurrency} <> ${storeCurrency}
              and ${purchaseOrders.exchangeRateLockedAt} is not null
            then 1 else 0 end), 0)`,
          changedRateCount: sql<number>`coalesce(sum(case
            when ${purchaseOrders.purchaseCurrency} <> ${storeCurrency}
              and ${purchaseOrders.exchangeRateLockedAt} is not null
              and ${purchaseOrders.exchangeRate} <> ${purchaseOrders.exchangeRateInitial}
            then 1 else 0 end), 0)`,
          totalRateDeltaBase: sql<number>`coalesce(sum(case
            when ${purchaseOrders.purchaseCurrency} <> ${storeCurrency}
              and ${purchaseOrders.exchangeRateLockedAt} is not null
            then (
              (${purchaseOrders.exchangeRate} - ${purchaseOrders.exchangeRateInitial}) * coalesce((
                select sum(
                  ${purchaseOrderItems.unitCostPurchase} * case
                    when ${purchaseOrderItems.qtyReceived} > 0 then ${purchaseOrderItems.qtyReceived}
                    else ${purchaseOrderItems.qtyOrdered}
                  end
                )
                from ${purchaseOrderItems}
                where ${purchaseOrderItems.purchaseOrderId} = ${purchaseOrders.id}
              ), 0)
            )
            else 0 end), 0)`,
        })
        .from(purchaseOrders)
        .where(eq(purchaseOrders.storeId, storeId)),
    ),
    timeDbQuery("reports.purchaseFx.recentLocks", async () =>
      db
        .select({
          id: purchaseOrders.id,
          poNumber: purchaseOrders.poNumber,
          supplierName: purchaseOrders.supplierName,
          purchaseCurrency: purchaseOrders.purchaseCurrency,
          exchangeRateInitial: purchaseOrders.exchangeRateInitial,
          exchangeRate: purchaseOrders.exchangeRate,
          exchangeRateLockedAt: purchaseOrders.exchangeRateLockedAt,
          paymentStatus: purchaseOrders.paymentStatus,
        })
        .from(purchaseOrders)
        .where(
          and(
            eq(purchaseOrders.storeId, storeId),
            sql`${purchaseOrders.purchaseCurrency} <> ${storeCurrency}`,
            sql`${purchaseOrders.exchangeRateLockedAt} is not null`,
          ),
        )
        .orderBy(sql`${purchaseOrders.exchangeRateLockedAt} desc`)
        .limit(5),
    ),
  ]);

  return {
    pendingRateCount: Number(summaryRows[0]?.pendingRateCount ?? 0),
    pendingRateUnpaidCount: Number(summaryRows[0]?.pendingRateUnpaidCount ?? 0),
    lockedCount: Number(summaryRows[0]?.lockedCount ?? 0),
    changedRateCount: Number(summaryRows[0]?.changedRateCount ?? 0),
    totalRateDeltaBase: Number(summaryRows[0]?.totalRateDeltaBase ?? 0),
    recentLocks: recentRows.map((row) => ({
      id: row.id,
      poNumber: row.poNumber,
      supplierName: row.supplierName,
      purchaseCurrency: row.purchaseCurrency as "LAK" | "THB" | "USD",
      exchangeRateInitial: row.exchangeRateInitial,
      exchangeRate: row.exchangeRate,
      exchangeRateLockedAt: row.exchangeRateLockedAt,
      paymentStatus: row.paymentStatus as "UNPAID" | "PARTIAL" | "PAID",
    })),
  };
}

export async function getOutstandingPurchaseRows(
  storeId: string,
  storeCurrency: "LAK" | "THB" | "USD",
): Promise<PurchaseOutstandingRow[]> {
  const rows = await timeDbQuery("reports.purchaseOutstanding.rows", async () =>
    db
      .select({
        poId: purchaseOrders.id,
        poNumber: purchaseOrders.poNumber,
        supplierName: purchaseOrders.supplierName,
        purchaseCurrency: purchaseOrders.purchaseCurrency,
        dueDate: purchaseOrders.dueDate,
        receivedAt: purchaseOrders.receivedAt,
        paymentStatus: purchaseOrders.paymentStatus,
        exchangeRateInitial: purchaseOrders.exchangeRateInitial,
        exchangeRate: purchaseOrders.exchangeRate,
        exchangeRateLockedAt: purchaseOrders.exchangeRateLockedAt,
        totalCostPurchase: sql<number>`(
          coalesce((
            SELECT sum(${purchaseOrderItems.unitCostPurchase} * ${purchaseOrderItems.qtyOrdered})
            FROM ${purchaseOrderItems}
            WHERE ${purchaseOrderItems.purchaseOrderId} = ${purchaseOrders.id}
          ), 0)
        )`,
        totalCostBaseRaw: sql<number>`(
          coalesce((
            SELECT sum(${purchaseOrderItems.unitCostBase} * ${purchaseOrderItems.qtyBaseOrdered})
            FROM ${purchaseOrderItems}
            WHERE ${purchaseOrderItems.purchaseOrderId} = ${purchaseOrders.id}
          ), 0)
        )`,
        shippingCostBase: purchaseOrders.shippingCost,
        otherCostBase: purchaseOrders.otherCost,
        totalPaidBase: sql<number>`(
          coalesce((
            SELECT sum(case
              when ${purchaseOrderPayments.entryType} = 'PAYMENT' then ${purchaseOrderPayments.amountBase}
              when ${purchaseOrderPayments.entryType} = 'REVERSAL' then -${purchaseOrderPayments.amountBase}
              else 0
            end)
            FROM ${purchaseOrderPayments}
            WHERE ${purchaseOrderPayments.purchaseOrderId} = ${purchaseOrders.id}
          ), 0)
        )`,
        outstandingBase: sql<number>`(
          (
            coalesce((
              SELECT sum(${purchaseOrderItems.unitCostBase} * ${purchaseOrderItems.qtyBaseOrdered})
              FROM ${purchaseOrderItems}
              WHERE ${purchaseOrderItems.purchaseOrderId} = ${purchaseOrders.id}
            ), 0) + ${purchaseOrders.shippingCost} + ${purchaseOrders.otherCost}
          ) - coalesce((
            SELECT sum(case
              when ${purchaseOrderPayments.entryType} = 'PAYMENT' then ${purchaseOrderPayments.amountBase}
              when ${purchaseOrderPayments.entryType} = 'REVERSAL' then -${purchaseOrderPayments.amountBase}
              else 0
            end)
            FROM ${purchaseOrderPayments}
            WHERE ${purchaseOrderPayments.purchaseOrderId} = ${purchaseOrders.id}
          ), 0)
        )`,
        ageDays: sql<number>`cast(case
          when julianday('now') - julianday(coalesce(${purchaseOrders.dueDate}, ${purchaseOrders.receivedAt}, ${purchaseOrders.createdAt})) < 0 then 0
          else julianday('now') - julianday(coalesce(${purchaseOrders.dueDate}, ${purchaseOrders.receivedAt}, ${purchaseOrders.createdAt}))
        end as integer)`,
        fxDeltaBase: sql<number>`case
          when ${purchaseOrders.purchaseCurrency} <> ${storeCurrency}
            and ${purchaseOrders.exchangeRateLockedAt} is not null
            and ${purchaseOrders.exchangeRate} <> ${purchaseOrders.exchangeRateInitial}
          then (
            (${purchaseOrders.exchangeRate} - ${purchaseOrders.exchangeRateInitial}) * coalesce((
              SELECT sum(
                ${purchaseOrderItems.unitCostPurchase} * case
                  when ${purchaseOrderItems.qtyReceived} > 0 then ${purchaseOrderItems.qtyReceived}
                  else ${purchaseOrderItems.qtyOrdered}
                end
              )
              FROM ${purchaseOrderItems}
              WHERE ${purchaseOrderItems.purchaseOrderId} = ${purchaseOrders.id}
            ), 0)
          )
          else 0
        end`,
      })
      .from(purchaseOrders)
      .where(
        and(
          eq(purchaseOrders.storeId, storeId),
          eq(purchaseOrders.status, "RECEIVED"),
        ),
      )
      .orderBy(desc(purchaseOrders.dueDate), desc(purchaseOrders.receivedAt)),
  );

  return rows
    .map((row) => ({
      ...(() => {
      const totalCostPurchase = Number(row.totalCostPurchase ?? 0);
      const totalCostBaseRaw = Number(row.totalCostBaseRaw ?? 0);
      const shippingCostBase = Number(row.shippingCostBase ?? 0);
      const otherCostBase = Number(row.otherCostBase ?? 0);
      const totalPaidBase = Number(row.totalPaidBase ?? 0);
      const totalCostBase = resolvePurchaseOutstandingProductBase({
        purchaseCurrency: row.purchaseCurrency as "LAK" | "THB" | "USD",
        storeCurrency,
        totalCostBaseRaw,
        totalCostPurchase,
        exchangeRateInitial: Number(row.exchangeRateInitial ?? 1),
        exchangeRate: Number(row.exchangeRate ?? 1),
        exchangeRateLockedAt: row.exchangeRateLockedAt,
      });
      const grandTotalBase = totalCostBase + shippingCostBase + otherCostBase;
      const outstandingBase = normalizePurchaseOutstandingBase(
        totalPaidBase,
        grandTotalBase,
      );
      const paymentStatus = derivePurchaseOutstandingPaymentStatus(
        totalPaidBase,
        grandTotalBase,
      );

      return {
        grandTotalBase,
        totalPaidBase,
        outstandingBase,
        paymentStatus,
      };
      })(),
      poId: row.poId,
      poNumber: row.poNumber,
      supplierName: row.supplierName,
      purchaseCurrency: row.purchaseCurrency as "LAK" | "THB" | "USD",
      dueDate: row.dueDate,
      receivedAt: row.receivedAt,
      ageDays: Number(row.ageDays ?? 0),
      fxDeltaBase: Number(row.fxDeltaBase ?? 0),
      exchangeRateInitial: Number(row.exchangeRateInitial ?? 1),
      exchangeRate: Number(row.exchangeRate ?? 1),
      exchangeRateLockedAt: row.exchangeRateLockedAt,
    }))
    .filter((row) => row.outstandingBase > 0);
}

export async function getPurchaseApAgingSummary(
  storeId: string,
  storeCurrency: "LAK" | "THB" | "USD",
): Promise<PurchaseApAgingSummary> {
  const outstandingRows = await getOutstandingPurchaseRows(storeId, storeCurrency);

  const summary: PurchaseApAgingSummary = {
    totalOutstandingBase: 0,
    bucket0To30: { count: 0, amountBase: 0 },
    bucket31To60: { count: 0, amountBase: 0 },
    bucket61Plus: { count: 0, amountBase: 0 },
    suppliers: [],
  };

  const supplierMap = new Map<
    string,
    {
      outstandingBase: number;
      fxDeltaBase: number;
      poCount: number;
    }
  >();

  for (const row of outstandingRows) {
    summary.totalOutstandingBase += row.outstandingBase;
    if (row.ageDays <= 30) {
      summary.bucket0To30.count += 1;
      summary.bucket0To30.amountBase += row.outstandingBase;
    } else if (row.ageDays <= 60) {
      summary.bucket31To60.count += 1;
      summary.bucket31To60.amountBase += row.outstandingBase;
    } else {
      summary.bucket61Plus.count += 1;
      summary.bucket61Plus.amountBase += row.outstandingBase;
    }

    const supplierName = row.supplierName?.trim() || "ไม่ระบุซัพพลายเออร์";
    const current = supplierMap.get(supplierName) ?? {
      outstandingBase: 0,
      fxDeltaBase: 0,
      poCount: 0,
    };
    current.outstandingBase += row.outstandingBase;
    current.fxDeltaBase += row.fxDeltaBase;
    current.poCount += 1;
    supplierMap.set(supplierName, current);
  }

  summary.suppliers = Array.from(supplierMap.entries())
    .map(([supplierName, value]) => ({
      supplierName,
      outstandingBase: value.outstandingBase,
      fxDeltaBase: value.fxDeltaBase,
      poCount: value.poCount,
    }))
    .sort((a, b) => b.outstandingBase - a.outstandingBase);

  return summary;
}
