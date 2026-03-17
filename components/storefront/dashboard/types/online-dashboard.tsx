import Link from "next/link";
import { Suspense } from "react";

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

async function OnlineDashboardCards({
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
      <div className="rounded-xl border bg-white p-4">
        <p className="text-xs text-muted-foreground">{t(uiLocale, "dashboard.cards.ordersToday")}</p>
        <p className="mt-1 text-2xl font-semibold">
          {dashboardData.metrics.ordersCountToday.toLocaleString(numberLocale)}
        </p>
      </div>
      <div className="rounded-xl border bg-white p-4">
        <p className="text-xs text-muted-foreground">{t(uiLocale, "dashboard.cards.pendingPayment")}</p>
        <p className="mt-1 text-2xl font-semibold">
          {dashboardData.metrics.pendingPaymentCount.toLocaleString(numberLocale)}
        </p>
      </div>
      <div className="rounded-xl border bg-white p-4">
        <p className="text-xs text-muted-foreground">{t(uiLocale, "dashboard.cards.lowStock")}</p>
        <p className="mt-1 text-2xl font-semibold">
          {dashboardData.metrics.lowStockCount.toLocaleString(numberLocale)}
        </p>
      </div>
      <div className="rounded-xl border bg-white p-4">
        <p className="text-xs text-muted-foreground">{t(uiLocale, "dashboard.cards.roleInStore")}</p>
        <p className="mt-1 text-sm font-medium">
          {activeRoleName ?? t(uiLocale, "dashboard.cards.noRole")}
        </p>
      </div>
    </div>
  );
}

export function OnlineStorefrontDashboard({
  session,
  dashboardDataPromise,
  canViewInventory,
  canViewReports,
}: StorefrontDashboardProps) {
  const uiLocale = session.uiLocale;

  return (
    <section className="space-y-4">
      <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 p-5 text-white">
        <p className="text-sm text-white/80">{t(uiLocale, "dashboard.hero.greeting")}</p>
        <h1 className="text-xl font-semibold">{session.displayName}</h1>
        <Suspense fallback={<TodaySalesSkeleton uiLocale={uiLocale} />}>
          <TodaySales dashboardDataPromise={dashboardDataPromise} uiLocale={uiLocale} />
        </Suspense>
      </div>

      <Suspense fallback={<DashboardCardsSkeleton uiLocale={uiLocale} activeRoleName={session.activeRoleName} />}>
        <OnlineDashboardCards
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
        <Link href="/reports" className="text-sm font-medium text-blue-700 hover:underline">
          {t(uiLocale, "dashboard.reports.more")}
        </Link>
      ) : null}
    </section>
  );
}
