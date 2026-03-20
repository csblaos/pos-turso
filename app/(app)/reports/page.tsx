import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, WalletCards } from "lucide-react";

import { ReportsFilters } from "@/components/app/reports-filters";
import { getSession } from "@/lib/auth/session";
import {
  getUserPermissionsForCurrentSession,
  isPermissionGranted,
} from "@/lib/rbac/access";
import {
  DEFAULT_UI_LOCALE,
  uiLocaleToDateLocale,
  type UiLocale,
} from "@/lib/i18n/locales";
import { t, type MessageKey } from "@/lib/i18n/messages";
import { resolveReportsFilterState } from "@/lib/reports/filters";
import { getReportsViewData } from "@/server/services/reports.service";

type ReportsPageProps = {
  searchParams: Promise<{
    preset?: string | string[];
    dateFrom?: string | string[];
    dateTo?: string | string[];
    channel?: string | string[];
  }>;
};

function formatShortDate(value: string, locale: string) {
  const parsed = new Date(`${value}T00:00:00`);
  return parsed.toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
  });
}

function formatRangeLabel(
  uiLocale: UiLocale,
  numberLocale: string,
  filters: { preset: string; dateFrom: string; dateTo: string },
) {
  if (filters.preset !== "CUSTOM") {
    return t(uiLocale, `reports.filters.preset.${filters.preset}` as MessageKey);
  }

  return `${formatShortDate(filters.dateFrom, numberLocale)} - ${formatShortDate(
    filters.dateTo,
    numberLocale,
  )}`;
}

function MetricCard({
  title,
  value,
  hint,
  tone = "default",
}: {
  title: string;
  value: string;
  hint?: string;
  tone?: "default" | "positive" | "warning";
}) {
  const toneClass =
    tone === "positive"
      ? "border-emerald-200 bg-emerald-50/70"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50/70"
        : "border-slate-200 bg-white";
  return (
    <article className={`rounded-2xl border p-4 shadow-sm ${toneClass}`}>
      <p className="text-xs font-medium text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </article>
  );
}

function SalesTrendChart({
  points,
  numberLocale,
  storeCurrency,
  emptyLabel,
}: {
  points: Array<{ bucketDate: string; salesTotal: number; orderCount: number }>;
  numberLocale: string;
  storeCurrency: string;
  emptyLabel: string;
}) {
  if (points.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  const maxValue = Math.max(...points.map((point) => point.salesTotal), 1);

  return (
    <div className="space-y-3">
      <div className="flex h-52 items-end gap-2 overflow-x-auto pb-2">
        {points.map((point) => {
          const height = Math.max(12, Math.round((point.salesTotal / maxValue) * 100));
          return (
            <div key={point.bucketDate} className="flex min-w-[3rem] flex-1 flex-col items-center gap-2">
              <div className="flex h-36 w-full items-end">
                <div
                  className="w-full rounded-t-xl bg-gradient-to-t from-blue-600 to-cyan-400"
                  style={{ height: `${height}%` }}
                  title={`${point.salesTotal.toLocaleString(numberLocale)} ${storeCurrency} • ${point.orderCount.toLocaleString(numberLocale)}`}
                />
              </div>
              <div className="space-y-0.5 text-center">
                <p className="text-[11px] font-medium text-slate-700">
                  {formatShortDate(point.bucketDate, numberLocale)}
                </p>
                <p className="text-[10px] text-slate-500">
                  {point.orderCount.toLocaleString(numberLocale)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-slate-500">
        {points.length.toLocaleString(numberLocale)} days • {storeCurrency}
      </p>
    </div>
  );
}

function HorizontalBarList({
  rows,
  numberLocale,
  storeCurrency,
  emptyLabel,
}: {
  rows: Array<{ key: string; label: string; primaryValue: number; secondaryLabel: string }>;
  numberLocale: string;
  storeCurrency: string;
  emptyLabel: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  const maxValue = Math.max(...rows.map((row) => row.primaryValue), 1);

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.key} className="space-y-1.5">
          <div className="flex items-center justify-between gap-3 text-sm">
            <p className="min-w-0 truncate font-medium text-slate-800">{row.label}</p>
            <p className="shrink-0 text-xs text-slate-500">
              {row.primaryValue.toLocaleString(numberLocale)} {storeCurrency}
            </p>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-slate-900"
              style={{ width: `${Math.max(8, Math.round((row.primaryValue / maxValue) * 100))}%` }}
            />
          </div>
          <p className="text-xs text-slate-500">{row.secondaryLabel}</p>
        </div>
      ))}
    </div>
  );
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const params = await searchParams;
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
  const filters = resolveReportsFilterState(params);
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
    salesOverview,
    salesTrend,
    topProducts,
    salesByChannel,
    grossProfit,
    codOverview,
    purchaseFx,
    purchaseApAging,
  } = await getReportsViewData({
    storeId: session.activeStoreId,
    filters,
    topProductsLimit: 8,
    useCache: false,
  });

  const fmtNumber = (value: number) => value.toLocaleString(numberLocale);
  const fmtSigned = (value: number) =>
    `${value > 0 ? "+" : value < 0 ? "-" : ""}${fmtNumber(Math.abs(value))}`;
  const grossMarginPercent =
    salesOverview.salesTotal > 0 ? (grossProfit.grossProfit / salesOverview.salesTotal) * 100 : 0;
  const activeRangeLabel = formatRangeLabel(uiLocale, numberLocale, filters);
  const getChannelLabel = (channel: "WALK_IN" | "FACEBOOK" | "WHATSAPP") => {
    if (channel === "WALK_IN") return t(uiLocale, "reports.channel.WALK_IN");
    if (channel === "FACEBOOK") return t(uiLocale, "reports.channel.FACEBOOK");
    return t(uiLocale, "reports.channel.WHATSAPP");
  };

  return (
    <section className="space-y-4">
      <header className="space-y-2">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">{t(uiLocale, "reports.title")}</h1>
          <p className="text-sm text-muted-foreground">{t(uiLocale, "reports.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
            {activeRangeLabel}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
            {filters.channel === "ALL"
              ? t(uiLocale, "reports.filters.channel.ALL")
              : getChannelLabel(filters.channel)}
          </span>
        </div>
      </header>

      <ReportsFilters
        uiLocale={uiLocale}
        dateLocale={numberLocale}
        initialFilters={filters}
      />

      <Link
        href="/reports/cash-flow"
        className="group flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50/50"
      >
        <div className="flex min-w-0 items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <WalletCards className="h-5 w-5" />
          </span>
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold text-slate-900">
              {t(uiLocale, "reports.cashFlow.title")}
            </p>
            <p className="text-xs text-slate-500">
              {t(uiLocale, "reports.cashFlow.description")}
            </p>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-blue-700">
          {t(uiLocale, "reports.cashFlow.open")}
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </Link>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          title={t(uiLocale, "reports.overview.salesTotal")}
          value={`${fmtNumber(salesOverview.salesTotal)} ${storeCurrency}`}
          hint={activeRangeLabel}
          tone="positive"
        />
        <MetricCard
          title={t(uiLocale, "reports.overview.orderCount")}
          value={fmtNumber(salesOverview.orderCount)}
          hint={t(uiLocale, "reports.cod.ordersSuffix")}
        />
        <MetricCard
          title={t(uiLocale, "reports.overview.averageOrderValue")}
          value={`${fmtNumber(salesOverview.averageOrderValue)} ${storeCurrency}`}
        />
        <MetricCard
          title={t(uiLocale, "reports.overview.grossProfit")}
          value={`${fmtNumber(grossProfit.grossProfit)} ${storeCurrency}`}
          hint={t(uiLocale, "reports.grossProfit.snapshotHint")}
          tone="positive"
        />
        <MetricCard
          title={t(uiLocale, "reports.overview.codPending")}
          value={`${fmtNumber(codOverview.pendingAmount)} ${storeCurrency}`}
          hint={`${fmtNumber(codOverview.pendingCount)} ${t(uiLocale, "reports.cod.ordersSuffix")}`}
          tone="warning"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <article className="space-y-3 rounded-2xl border bg-white p-4 shadow-sm">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold">{t(uiLocale, "reports.chart.salesTrend.title")}</h2>
            <p className="text-xs text-slate-500">
              {t(uiLocale, "reports.chart.salesTrend.description")}
            </p>
          </div>
          <SalesTrendChart
            points={salesTrend}
            numberLocale={numberLocale}
            storeCurrency={storeCurrency}
            emptyLabel={t(uiLocale, "reports.common.noData")}
          />
        </article>

        <article className="space-y-3 rounded-2xl border bg-white p-4 shadow-sm">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold">{t(uiLocale, "reports.overview.healthTitle")}</h2>
            <p className="text-xs text-slate-500">
              {t(uiLocale, "reports.overview.healthDescription")}
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">{t(uiLocale, "reports.overview.grossMargin")}</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {grossMarginPercent.toFixed(1)}%
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">{t(uiLocale, "reports.purchaseFx.pendingRate")}</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {fmtNumber(purchaseFx.pendingRateCount)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">{t(uiLocale, "reports.cod.pendingOrders")}</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {fmtNumber(codOverview.pendingCount)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">{t(uiLocale, "reports.apAging.totalOutstanding")}</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {fmtNumber(purchaseApAging.totalOutstandingBase)} {storeCurrency}
              </p>
            </div>
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="space-y-3 rounded-2xl border bg-white p-4 shadow-sm">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold">{t(uiLocale, "reports.salesByChannel.title")}</h2>
            <p className="text-xs text-slate-500">{t(uiLocale, "reports.salesByChannel.description")}</p>
          </div>
          <HorizontalBarList
            rows={salesByChannel.map((row) => ({
              key: row.channel,
              label: getChannelLabel(row.channel),
              primaryValue: row.salesTotal,
              secondaryLabel: `${fmtNumber(row.orderCount)} ${t(uiLocale, "reports.cod.ordersSuffix")}`,
            }))}
            numberLocale={numberLocale}
            storeCurrency={storeCurrency}
            emptyLabel={t(uiLocale, "reports.common.noData")}
          />
        </article>

        <article className="space-y-3 rounded-2xl border bg-white p-4 shadow-sm">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold">{t(uiLocale, "reports.topProducts.title")}</h2>
            <p className="text-xs text-slate-500">{t(uiLocale, "reports.topProducts.description")}</p>
          </div>
          <HorizontalBarList
            rows={topProducts.map((item) => ({
              key: item.productId,
              label: `${item.sku} - ${item.name}`,
              primaryValue: item.revenue,
              secondaryLabel: `${t(uiLocale, "reports.topProducts.soldPrefix")} ${fmtNumber(
                item.qtyBaseSold,
              )} ${t(uiLocale, "reports.topProducts.baseUnitsSuffix")}`,
            }))}
            numberLocale={numberLocale}
            storeCurrency={storeCurrency}
            emptyLabel={t(uiLocale, "reports.common.noData")}
          />
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="space-y-3 rounded-2xl border bg-white p-4 shadow-sm">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold">{t(uiLocale, "reports.cod.title")}</h2>
            <p className="text-xs text-slate-500">{t(uiLocale, "reports.cod.snapshotHint")}</p>
          </div>
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
              {t(uiLocale, "reports.cod.returnedTodayFee")}: {fmtNumber(codOverview.returnedTodayCodFee)}{" "}
              {storeCurrency}
            </p>
          </div>
          {codOverview.byProvider.length > 0 ? (
            <HorizontalBarList
              rows={codOverview.byProvider.slice(0, 5).map((row) => ({
                key: row.provider,
                label: row.provider,
                primaryValue: row.settledAmount,
                secondaryLabel: `${t(uiLocale, "reports.cod.returnedShort")} ${fmtNumber(
                  row.returnedCount,
                )} • ${t(uiLocale, "reports.cod.netShort")} ${fmtNumber(row.netAmount)} ${storeCurrency}`,
              }))}
              numberLocale={numberLocale}
              storeCurrency={storeCurrency}
              emptyLabel={t(uiLocale, "reports.cod.empty")}
            />
          ) : (
            <p className="text-sm text-muted-foreground">{t(uiLocale, "reports.cod.empty")}</p>
          )}
        </article>

        <article className="space-y-4 rounded-2xl border bg-white p-4 shadow-sm">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold">{t(uiLocale, "reports.purchase.sectionTitle")}</h2>
            <p className="text-xs text-slate-500">
              {t(uiLocale, "reports.purchase.snapshotHint")}
            </p>
          </div>

          <div className="space-y-3">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">{t(uiLocale, "reports.purchaseFx.title")}</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <p>{t(uiLocale, "reports.purchaseFx.pendingRate")}: {fmtNumber(purchaseFx.pendingRateCount)}</p>
                <p>
                  {t(uiLocale, "reports.purchaseFx.pendingRateUnpaid")}: {fmtNumber(
                    purchaseFx.pendingRateUnpaidCount,
                  )}
                </p>
                <p>{t(uiLocale, "reports.purchaseFx.locked")}: {fmtNumber(purchaseFx.lockedCount)}</p>
                <p>{t(uiLocale, "reports.purchaseFx.changed")}: {fmtNumber(purchaseFx.changedRateCount)}</p>
              </div>
              <p className="text-xs text-slate-500">
                {t(uiLocale, "reports.purchaseFx.totalDelta")}: {fmtSigned(
                  purchaseFx.totalRateDeltaBase,
                )} {storeCurrency}
              </p>
            </div>

            <div className="space-y-2 border-t border-slate-100 pt-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">{t(uiLocale, "reports.apAging.title")}</h3>
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
            </div>
          </div>
        </article>
      </section>

      <Link href="/dashboard" className="text-sm font-medium text-blue-700 hover:underline">
        {t(uiLocale, "reports.backToDashboard")}
      </Link>
    </section>
  );
}
