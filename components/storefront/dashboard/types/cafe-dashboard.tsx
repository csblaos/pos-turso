import Link from "next/link";
import { Suspense } from "react";
import { Coffee, CupSoda, Leaf, ReceiptText } from "lucide-react";

import {
  DashboardCardsSkeleton,
  LowStock,
  LowStockSkeleton,
  PurchaseApReminder,
  PurchaseApReminderSkeleton,
  TodaySales,
  TodaySalesSkeleton,
  type StorefrontDashboardProps,
} from "@/components/storefront/dashboard/shared";
import { uiLocaleToDateLocale, type UiLocale } from "@/lib/i18n/locales";
import { t } from "@/lib/i18n/messages";

async function CafeDashboardCards({
  dashboardDataPromise,
  activeRoleName,
  uiLocale,
}: {
  dashboardDataPromise: StorefrontDashboardProps["dashboardDataPromise"];
  activeRoleName: string | null | undefined;
  uiLocale: UiLocale;
}) {
  const dashboardData = await dashboardDataPromise;
  const numberLocale = uiLocaleToDateLocale(uiLocale);

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-2xl border border-amber-200 bg-white p-4">
        <p className="text-xs text-muted-foreground">{t(uiLocale, "dashboard.cards.billsToday")}</p>
        <p className="mt-1 text-2xl font-semibold text-amber-900">
          {dashboardData.metrics.ordersCountToday.toLocaleString(numberLocale)}
        </p>
      </div>
      <div className="rounded-2xl border border-rose-200 bg-white p-4">
        <p className="text-xs text-muted-foreground">{t(uiLocale, "dashboard.cards.pendingPayment")}</p>
        <p className="mt-1 text-2xl font-semibold text-rose-700">
          {dashboardData.metrics.pendingPaymentCount.toLocaleString(numberLocale)}
        </p>
      </div>
      <div className="rounded-2xl border border-emerald-200 bg-white p-4">
        <div className="flex items-center gap-1.5">
          <Leaf className="h-4 w-4 text-emerald-700" />
          <p className="text-xs text-muted-foreground">{t(uiLocale, "dashboard.cards.lowStock")}</p>
        </div>
        <p className="mt-1 text-2xl font-semibold text-emerald-800">
          {dashboardData.metrics.lowStockCount.toLocaleString(numberLocale)}
        </p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-xs text-muted-foreground">{t(uiLocale, "dashboard.cards.roleInStore")}</p>
        <p className="mt-1 text-sm font-medium">
          {activeRoleName ?? t(uiLocale, "dashboard.cards.noRole")}
        </p>
      </div>
    </div>
  );
}

export function CafeStorefrontDashboard({
  session,
  dashboardDataPromise,
  canViewInventory,
  canViewReports,
}: StorefrontDashboardProps) {
  const uiLocale = session.uiLocale;

  return (
    <section className="space-y-4">
      <div className="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-100 via-orange-50 to-white p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-amber-800">Cafe POS</p>
            <h1 className="mt-1 text-xl font-semibold text-amber-950">{session.displayName}</h1>
          </div>
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-900 text-amber-50">
            <Coffee className="h-5 w-5" />
          </div>
        </div>
        <Suspense fallback={<TodaySalesSkeleton uiLocale={uiLocale} className="mt-1 text-sm text-amber-800/80" />}>
          <TodaySales
            dashboardDataPromise={dashboardDataPromise}
            uiLocale={uiLocale}
            className="mt-1 text-sm text-amber-800"
          />
        </Suspense>
      </div>

      <Suspense fallback={<DashboardCardsSkeleton uiLocale={uiLocale} activeRoleName={session.activeRoleName} />}>
        <CafeDashboardCards
          dashboardDataPromise={dashboardDataPromise}
          activeRoleName={session.activeRoleName}
          uiLocale={uiLocale}
        />
      </Suspense>

      <article className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-slate-900">
          {t(uiLocale, "dashboard.cafe.template.title")}
        </p>
        <p className="mt-1 text-xs text-slate-500">{t(uiLocale, "dashboard.cafe.template.description")}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link
            href="/orders"
            className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900"
          >
            <ReceiptText className="h-4 w-4" />
            {t(uiLocale, "dashboard.cafe.template.cta.orders")}
          </Link>
          <Link
            href="/products"
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800"
          >
            <CupSoda className="h-4 w-4" />
            {t(uiLocale, "dashboard.cafe.template.cta.drinks")}
          </Link>
        </div>
      </article>

      {canViewInventory ? (
        <Suspense fallback={<PurchaseApReminderSkeleton uiLocale={uiLocale} />}>
          <PurchaseApReminder dashboardDataPromise={dashboardDataPromise} uiLocale={uiLocale} />
        </Suspense>
      ) : null}

      {canViewInventory ? (
        <Suspense fallback={<LowStockSkeleton uiLocale={uiLocale} />}>
          <LowStock dashboardDataPromise={dashboardDataPromise} uiLocale={uiLocale} />
        </Suspense>
      ) : null}

      {canViewReports ? (
        <Link href="/reports" className="text-sm font-medium text-amber-800 hover:underline">
          {t(uiLocale, "dashboard.reports.moreCafe")}
        </Link>
      ) : null}
    </section>
  );
}
