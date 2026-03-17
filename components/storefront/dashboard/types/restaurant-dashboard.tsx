import Link from "next/link";
import { Suspense } from "react";
import { ChefHat, Clock3, Flame, ReceiptText, UtensilsCrossed } from "lucide-react";

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

async function RestaurantDashboardCards({
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
      <div className="rounded-2xl border border-rose-200 bg-white p-4">
        <div className="flex items-center gap-1.5">
          <ReceiptText className="h-4 w-4 text-rose-700" />
          <p className="text-xs text-muted-foreground">{t(uiLocale, "dashboard.cards.ordersToday")}</p>
        </div>
        <p className="mt-1 text-2xl font-semibold text-rose-900">
          {dashboardData.metrics.ordersCountToday.toLocaleString(numberLocale)}
        </p>
      </div>
      <div className="rounded-2xl border border-amber-200 bg-white p-4">
        <div className="flex items-center gap-1.5">
          <Clock3 className="h-4 w-4 text-amber-700" />
          <p className="text-xs text-muted-foreground">{t(uiLocale, "dashboard.cards.pendingPayment")}</p>
        </div>
        <p className="mt-1 text-2xl font-semibold text-amber-900">
          {dashboardData.metrics.pendingPaymentCount.toLocaleString(numberLocale)}
        </p>
      </div>
      <div className="rounded-2xl border border-orange-200 bg-white p-4">
        <div className="flex items-center gap-1.5">
          <Flame className="h-4 w-4 text-orange-700" />
          <p className="text-xs text-muted-foreground">{t(uiLocale, "dashboard.cards.lowStock")}</p>
        </div>
        <p className="mt-1 text-2xl font-semibold text-orange-900">
          {dashboardData.metrics.lowStockCount.toLocaleString(numberLocale)}
        </p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-1.5">
          <ChefHat className="h-4 w-4 text-slate-700" />
          <p className="text-xs text-muted-foreground">{t(uiLocale, "dashboard.cards.roleInStore")}</p>
        </div>
        <p className="mt-1 text-sm font-medium">
          {activeRoleName ?? t(uiLocale, "dashboard.cards.noRole")}
        </p>
      </div>
    </div>
  );
}

export function RestaurantStorefrontDashboard({
  session,
  dashboardDataPromise,
  canViewInventory,
  canViewReports,
}: StorefrontDashboardProps) {
  const uiLocale = session.uiLocale;

  return (
    <section className="space-y-4">
      <div className="rounded-3xl border border-rose-200 bg-gradient-to-br from-rose-100 via-orange-50 to-white p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-rose-800">
              Restaurant POS
            </p>
            <h1 className="mt-1 text-xl font-semibold text-rose-950">{session.displayName}</h1>
          </div>
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-900 text-rose-50">
            <UtensilsCrossed className="h-5 w-5" />
          </div>
        </div>
        <Suspense fallback={<TodaySalesSkeleton uiLocale={uiLocale} className="mt-1 text-sm text-rose-800/80" />}>
          <TodaySales
            dashboardDataPromise={dashboardDataPromise}
            uiLocale={uiLocale}
            className="mt-1 text-sm text-rose-800"
          />
        </Suspense>
      </div>

      <Suspense fallback={<DashboardCardsSkeleton uiLocale={uiLocale} activeRoleName={session.activeRoleName} />}>
        <RestaurantDashboardCards
          dashboardDataPromise={dashboardDataPromise}
          activeRoleName={session.activeRoleName}
          uiLocale={uiLocale}
        />
      </Suspense>

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
        <Link href="/reports" className="text-sm font-medium text-rose-800 hover:underline">
          {t(uiLocale, "dashboard.reports.moreRestaurant")}
        </Link>
      ) : null}
    </section>
  );
}
