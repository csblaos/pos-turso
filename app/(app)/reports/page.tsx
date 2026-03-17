import Link from "next/link";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";
import {
  getUserPermissionsForCurrentSession,
  isPermissionGranted,
} from "@/lib/rbac/access";
import { DEFAULT_UI_LOCALE, uiLocaleToDateLocale } from "@/lib/i18n/locales";
import { t } from "@/lib/i18n/messages";
import { getReportsViewData } from "@/server/services/reports.service";

export default async function ReportsPage() {
  const [session, permissionKeys] = await Promise.all([
    getSession(),
    getUserPermissionsForCurrentSession(),
  ]);
  if (!session) {
    redirect("/login");
  }

  if (!session.activeStoreId) {
    redirect("/onboarding");
  }

  const uiLocale = session.uiLocale ?? DEFAULT_UI_LOCALE;
  const numberLocale = uiLocaleToDateLocale(uiLocale);
  const fmtNumber = (value: number) => value.toLocaleString(numberLocale);
  const fmtSigned = (value: number) =>
    `${value > 0 ? "+" : value < 0 ? "-" : ""}${fmtNumber(Math.abs(value))}`;
  const getChannelLabel = (channel: "WALK_IN" | "FACEBOOK" | "WHATSAPP") => {
    if (channel === "WALK_IN") return t(uiLocale, "reports.channel.WALK_IN");
    if (channel === "FACEBOOK") return t(uiLocale, "reports.channel.FACEBOOK");
    return t(uiLocale, "reports.channel.WHATSAPP");
  };

  const canView = isPermissionGranted(permissionKeys, "reports.view");

  if (!canView) {
    return (
      <section className="space-y-2">
        <h1 className="text-xl font-semibold">{t(uiLocale, "reports.title")}</h1>
        <p className="text-sm text-red-600">{t(uiLocale, "reports.noAccess")}</p>
      </section>
    );
  }

  const {
    storeCurrency,
    salesSummary,
    topProducts,
    salesByChannel,
    grossProfit,
    codOverview,
    purchaseFx,
    purchaseApAging,
  } =
    await getReportsViewData({
      storeId: session.activeStoreId,
      topProductsLimit: 10,
      useCache: true,
    });

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">{t(uiLocale, "reports.title")}</h1>
        <p className="text-sm text-muted-foreground">{t(uiLocale, "reports.subtitle")}</p>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <article className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">{t(uiLocale, "reports.sales.today")}</p>
          <p className="mt-1 text-xl font-semibold">
            {fmtNumber(salesSummary.salesToday)} {storeCurrency}
          </p>
        </article>
        <article className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">{t(uiLocale, "reports.sales.thisMonth")}</p>
          <p className="mt-1 text-xl font-semibold">
            {fmtNumber(salesSummary.salesThisMonth)} {storeCurrency}
          </p>
        </article>
      </div>

      <article className="space-y-2 rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold">{t(uiLocale, "reports.grossProfit.title")}</h2>
        <p className="text-sm">
          {t(uiLocale, "reports.grossProfit.revenue")}: {fmtNumber(grossProfit.revenue)}{" "}
          {storeCurrency}
        </p>
        <p className="text-xs text-muted-foreground">{t(uiLocale, "reports.grossProfit.snapshotHint")}</p>
        <p className="text-sm">
          {t(uiLocale, "reports.grossProfit.cogs")}: {fmtNumber(grossProfit.cogs)} {storeCurrency}
        </p>
        <p className="text-sm">
          {t(uiLocale, "reports.grossProfit.shippingCost")}: {fmtNumber(grossProfit.shippingCost)}{" "}
          {storeCurrency}
        </p>
        <p className="text-sm font-semibold">
          {t(uiLocale, "reports.grossProfit.total")}: {fmtNumber(grossProfit.grossProfit)}{" "}
          {storeCurrency}
        </p>
        <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-muted-foreground">
            {t(uiLocale, "reports.grossProfit.currentCostPreview.title")}
          </p>
          <p className="text-sm">
            {t(uiLocale, "reports.grossProfit.currentCostPreview.cogs")}:{" "}
            {fmtNumber(grossProfit.currentCostCogs)} {storeCurrency}
          </p>
          <p className="text-sm font-semibold">
            {t(uiLocale, "reports.grossProfit.currentCostPreview.total")}:{" "}
            {fmtNumber(grossProfit.currentCostGrossProfit)} {storeCurrency}
          </p>
          <p className="text-xs text-muted-foreground">
            {t(uiLocale, "reports.grossProfit.currentCostPreview.delta")}:{" "}
            {fmtSigned(grossProfit.grossProfitDeltaVsCurrentCost)} {storeCurrency}
          </p>
        </div>
      </article>

      <article className="space-y-3 rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold">{t(uiLocale, "reports.cod.title")}</h2>
        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
          <p>
            {t(uiLocale, "reports.cod.pendingOrders")}: {fmtNumber(codOverview.pendingCount)}{" "}
            {t(uiLocale, "reports.cod.ordersSuffix")}
          </p>
          <p>
            {t(uiLocale, "reports.cod.pendingAmount")}: {fmtNumber(codOverview.pendingAmount)}{" "}
            {storeCurrency}
          </p>
          <p>
            {t(uiLocale, "reports.cod.settledTodayOrders")}: {fmtNumber(codOverview.settledTodayCount)}{" "}
            {t(uiLocale, "reports.cod.ordersSuffix")}
          </p>
          <p>
            {t(uiLocale, "reports.cod.settledTodayAmount")}: {fmtNumber(codOverview.settledTodayAmount)}{" "}
            {storeCurrency}
          </p>
          <p>
            {t(uiLocale, "reports.cod.returnedTodayOrders")}: {fmtNumber(codOverview.returnedTodayCount)}{" "}
            {t(uiLocale, "reports.cod.ordersSuffix")}
          </p>
          <p>
            {t(uiLocale, "reports.cod.returnedTodayShippingLoss")}:{" "}
            {fmtNumber(codOverview.returnedTodayShippingLoss)} {storeCurrency}
          </p>
          <p>
            {t(uiLocale, "reports.cod.returnedTodayFee")}: {fmtNumber(codOverview.returnedTodayCodFee)}{" "}
            {storeCurrency}
          </p>
        </div>
        <p className="text-sm">
          {t(uiLocale, "reports.cod.settledAllAmount")}: {fmtNumber(codOverview.settledAllAmount)}{" "}
          {storeCurrency}
          {" · "}
          {fmtNumber(codOverview.settledAllCount)} {t(uiLocale, "reports.cod.ordersSuffix")}
        </p>
        <p className="text-sm">
          {t(uiLocale, "reports.cod.returnedAllOrders")}: {fmtNumber(codOverview.returnedCount)}{" "}
          {t(uiLocale, "reports.cod.ordersSuffix")}
          {" · "}
          {t(uiLocale, "reports.cod.returnedAllShippingLoss")}:{" "}
          {fmtNumber(codOverview.returnedShippingLoss)} {storeCurrency}
        </p>
        <p className="text-sm">
          {t(uiLocale, "reports.cod.returnedAllFee")}: {fmtNumber(codOverview.returnedCodFee)}{" "}
          {storeCurrency}
        </p>
        <p className="text-sm font-semibold">
          {t(uiLocale, "reports.cod.netAllAmount")}: {fmtNumber(codOverview.netAmount)}{" "}
          {storeCurrency}
        </p>
        {codOverview.byProvider.length > 0 ? (
          <div className="space-y-2 pt-1">
            <p className="text-xs text-muted-foreground">{t(uiLocale, "reports.cod.byProviderHint")}</p>
            {codOverview.byProvider.slice(0, 8).map((row) => (
              <div key={row.provider} className="rounded-lg border p-2 text-xs text-slate-700">
                <p className="font-medium text-slate-900">{row.provider}</p>
                <p>
                  {t(uiLocale, "reports.cod.pendingOrdersShort")} {fmtNumber(row.pendingCount)}{" "}
                  {t(uiLocale, "reports.cod.ordersSuffix")} · {fmtNumber(row.pendingAmount)}{" "}
                  {storeCurrency}
                </p>
                <p>
                  {t(uiLocale, "reports.cod.settledShort")} {fmtNumber(row.settledCount)}{" "}
                  {t(uiLocale, "reports.cod.ordersSuffix")} · {fmtNumber(row.settledAmount)}{" "}
                  {storeCurrency}
                </p>
                <p>
                  {t(uiLocale, "reports.cod.returnedShort")} {fmtNumber(row.returnedCount)}{" "}
                  {t(uiLocale, "reports.cod.ordersSuffix")} ·{" "}
                  {t(uiLocale, "reports.cod.shippingLossShort")} {fmtNumber(row.returnedShippingLoss)}{" "}
                  {storeCurrency}
                </p>
                <p>
                  {t(uiLocale, "reports.cod.feeShort")}: {fmtNumber(row.returnedCodFee)}{" "}
                  {storeCurrency}
                </p>
                <p className="font-medium">
                  {t(uiLocale, "reports.cod.netShort")}: {fmtNumber(row.netAmount)} {storeCurrency}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t(uiLocale, "reports.cod.empty")}</p>
        )}
      </article>

      <article className="space-y-2 rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold">{t(uiLocale, "reports.purchaseFx.title")}</h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <p>
            {t(uiLocale, "reports.purchaseFx.pendingRate")}: {fmtNumber(purchaseFx.pendingRateCount)}
          </p>
          <p>
            {t(uiLocale, "reports.purchaseFx.pendingRateUnpaid")}:{" "}
            {fmtNumber(purchaseFx.pendingRateUnpaidCount)}
          </p>
          <p>
            {t(uiLocale, "reports.purchaseFx.locked")}: {fmtNumber(purchaseFx.lockedCount)}
          </p>
          <p>
            {t(uiLocale, "reports.purchaseFx.changed")}: {fmtNumber(purchaseFx.changedRateCount)}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          {t(uiLocale, "reports.purchaseFx.totalDelta")}: {fmtSigned(purchaseFx.totalRateDeltaBase)}{" "}
          {storeCurrency}
        </p>
        {purchaseFx.recentLocks.length > 0 ? (
          <div className="space-y-1 pt-1 text-xs">
            {purchaseFx.recentLocks.map((item) => {
              const deltaRate = item.exchangeRate - item.exchangeRateInitial;
              return (
                <p key={item.id}>
                  {item.poNumber}
                  {item.supplierName ? ` · ${item.supplierName}` : ""}
                  {" · "}
                  {item.purchaseCurrency} {item.exchangeRateInitial}→{item.exchangeRate}
                  {" ("}
                  {fmtSigned(deltaRate)}
                  {")"}
                </p>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t(uiLocale, "reports.purchaseFx.empty")}</p>
        )}
      </article>

      <article className="space-y-2 rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">{t(uiLocale, "reports.apAging.title")}</h2>
          <Link
            href="/api/stock/purchase-orders/outstanding/export-csv"
            prefetch={false}
            className="text-xs font-medium text-blue-700 hover:underline"
          >
            {t(uiLocale, "reports.apAging.exportCsv")}
          </Link>
        </div>
        <p className="text-sm">
          {t(uiLocale, "reports.apAging.totalOutstanding")}:{" "}
          {fmtNumber(purchaseApAging.totalOutstandingBase)} {storeCurrency}
        </p>
        <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
            <p className="font-medium">{t(uiLocale, "reports.apAging.bucket.0_30")}</p>
            <p>
              {fmtNumber(purchaseApAging.bucket0To30.count)} {t(uiLocale, "reports.apAging.docSuffix")}
            </p>
            <p>{fmtNumber(purchaseApAging.bucket0To30.amountBase)} {storeCurrency}</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-2">
            <p className="font-medium">{t(uiLocale, "reports.apAging.bucket.31_60")}</p>
            <p>
              {fmtNumber(purchaseApAging.bucket31To60.count)} {t(uiLocale, "reports.apAging.docSuffix")}
            </p>
            <p>{fmtNumber(purchaseApAging.bucket31To60.amountBase)} {storeCurrency}</p>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 p-2">
            <p className="font-medium">{t(uiLocale, "reports.apAging.bucket.61_plus")}</p>
            <p>
              {fmtNumber(purchaseApAging.bucket61Plus.count)} {t(uiLocale, "reports.apAging.docSuffix")}
            </p>
            <p>{fmtNumber(purchaseApAging.bucket61Plus.amountBase)} {storeCurrency}</p>
          </div>
        </div>
        {purchaseApAging.suppliers.length > 0 ? (
          <div className="space-y-1 pt-1 text-xs">
            {purchaseApAging.suppliers.slice(0, 5).map((supplier) => (
              <p key={supplier.supplierName}>
                {supplier.supplierName} · {t(uiLocale, "reports.apAging.outstandingShort")}{" "}
                {fmtNumber(supplier.outstandingBase)} {storeCurrency}
                {" · "}
                {t(uiLocale, "reports.apAging.fxShort")} {fmtSigned(supplier.fxDeltaBase)} {storeCurrency}
              </p>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t(uiLocale, "reports.apAging.empty")}</p>
        )}
      </article>

      <article className="space-y-2 rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold">{t(uiLocale, "reports.salesByChannel.title")}</h2>
        <div className="space-y-1 text-sm">
          {salesByChannel.length === 0 ? (
            <p className="text-muted-foreground">{t(uiLocale, "reports.common.noData")}</p>
          ) : (
            salesByChannel.map((row) => (
              <p key={row.channel}>
                {getChannelLabel(row.channel)}: {fmtNumber(row.salesTotal)} {storeCurrency} (
                {fmtNumber(row.orderCount)} {t(uiLocale, "reports.cod.ordersSuffix")})
              </p>
            ))
          )}
        </div>
      </article>

      <article className="space-y-2 rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold">{t(uiLocale, "reports.topProducts.title")}</h2>
        <div className="space-y-2">
          {topProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t(uiLocale, "reports.common.noData")}</p>
          ) : (
            topProducts.map((item) => (
              <div key={item.productId} className="rounded-lg border p-2 text-sm">
                <p className="font-medium">{item.sku} - {item.name}</p>
                <p className="text-xs text-muted-foreground">
                  {t(uiLocale, "reports.topProducts.soldPrefix")} {fmtNumber(item.qtyBaseSold)}{" "}
                  {t(uiLocale, "reports.topProducts.baseUnitsSuffix")} •{" "}
                  {t(uiLocale, "reports.topProducts.revenuePrefix")} {fmtNumber(item.revenue)} {storeCurrency} •{" "}
                  {t(uiLocale, "reports.topProducts.cogsPrefix")} {fmtNumber(item.cogs)} {storeCurrency}
                </p>
              </div>
            ))
          )}
        </div>
      </article>

      <Link href="/dashboard" className="text-sm font-medium text-blue-700 hover:underline">
        {t(uiLocale, "reports.backToDashboard")}
      </Link>
    </section>
  );
}
