import Link from "next/link";

import type { AppSession } from "@/lib/auth/session-types";
import { currencySymbol, type StoreCurrency } from "@/lib/finance/store-financial";
import { type UiLocale, uiLocaleToDateLocale } from "@/lib/i18n/locales";
import { t } from "@/lib/i18n/messages";
import type { DashboardViewData } from "@/server/services/dashboard.service";

export type StorefrontDashboardProps = {
  session: AppSession;
  dashboardDataPromise: Promise<DashboardViewData>;
  canViewInventory: boolean;
  canViewReports: boolean;
};

function numberLocale(uiLocale: UiLocale) {
  return uiLocaleToDateLocale(uiLocale);
}

function fmtCount(value: number, uiLocale: UiLocale) {
  return value.toLocaleString(numberLocale(uiLocale));
}

function fmtPrice(amount: number, currency: StoreCurrency, uiLocale: UiLocale): string {
  return `${currencySymbol(currency)}${amount.toLocaleString(numberLocale(uiLocale))}`;
}

function formatDate(dateValue: string | null, uiLocale: UiLocale): string {
  if (!dateValue) return "-";
  const date = new Date(dateValue);
  if (!Number.isFinite(date.getTime())) return "-";
  return date.toLocaleDateString(numberLocale(uiLocale), {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function TodaySalesSkeleton({ uiLocale, className }: { uiLocale: UiLocale; className?: string }) {
  return (
    <p className={className ?? "mt-1 text-sm text-white/80"}>
      {t(uiLocale, "dashboard.todaySales.label")}{" "}
      <span className="inline-block h-4 w-24 animate-pulse rounded bg-white/30" />
    </p>
  );
}

export async function TodaySales({
  dashboardDataPromise,
  uiLocale,
  className,
}: {
  dashboardDataPromise: Promise<DashboardViewData>;
  uiLocale: UiLocale;
  className?: string;
}) {
  const dashboardData = await dashboardDataPromise;

  return (
    <p className={className ?? "mt-1 text-sm text-white/80"}>
      {t(uiLocale, "dashboard.todaySales.label")}{" "}
      {fmtPrice(
        dashboardData.metrics.todaySales,
        dashboardData.purchaseApReminder.storeCurrency,
        uiLocale,
      )}
    </p>
  );
}

export function DashboardCardsSkeleton({
  uiLocale,
  activeRoleName,
}: {
  uiLocale: UiLocale;
  activeRoleName: string | null | undefined;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {[
        t(uiLocale, "dashboard.cards.ordersToday"),
        t(uiLocale, "dashboard.cards.pendingPayment"),
        t(uiLocale, "dashboard.cards.lowStock"),
      ].map((label) => (
        <div key={label} className="rounded-xl border bg-white p-4">
          <p className="text-xs text-muted-foreground">{label}</p>
          <div className="mt-2 h-8 w-16 animate-pulse rounded bg-slate-200" />
        </div>
      ))}
      <div className="rounded-xl border bg-white p-4">
        <p className="text-xs text-muted-foreground">{t(uiLocale, "dashboard.cards.roleInStore")}</p>
        <p className="mt-1 text-sm font-medium">
          {activeRoleName ?? t(uiLocale, "dashboard.cards.noRole")}
        </p>
      </div>
    </div>
  );
}

export function LowStockSkeleton({ uiLocale }: { uiLocale: UiLocale }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-sm font-medium">{t(uiLocale, "dashboard.lowStock.title")}</p>
      <div className="mt-2 space-y-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-4 w-full animate-pulse rounded bg-slate-200" />
        ))}
      </div>
    </div>
  );
}

export async function LowStock({
  dashboardDataPromise,
  uiLocale,
}: {
  dashboardDataPromise: Promise<DashboardViewData>;
  uiLocale: UiLocale;
}) {
  const dashboardData = await dashboardDataPromise;

  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-sm font-medium">{t(uiLocale, "dashboard.lowStock.title")}</p>
      {dashboardData.lowStockItems.length === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">{t(uiLocale, "dashboard.lowStock.empty")}</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm">
          {dashboardData.lowStockItems.slice(0, 5).map((item) => (
            <li key={item.productId}>
              {item.sku} - {item.name}: {fmtCount(item.available, uiLocale)}{" "}
              {item.baseUnitCode}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PurchaseApReminderSkeleton({ uiLocale }: { uiLocale: UiLocale }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-medium text-amber-800">{t(uiLocale, "dashboard.purchaseAp.title")}</p>
      <div className="mt-2 space-y-2">
        <div className="h-4 w-56 animate-pulse rounded bg-amber-200/70" />
        <div className="h-4 w-48 animate-pulse rounded bg-amber-200/70" />
        <div className="h-4 w-full animate-pulse rounded bg-amber-200/70" />
      </div>
    </div>
  );
}

export async function PurchaseApReminder({
  dashboardDataPromise,
  uiLocale,
}: {
  dashboardDataPromise: Promise<DashboardViewData>;
  uiLocale: UiLocale;
}) {
  const dashboardData = await dashboardDataPromise;
  const reminder = dashboardData.purchaseApReminder;
  const hasReminder =
    reminder.summary.overdueCount > 0 || reminder.summary.dueSoonCount > 0;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-amber-900">
          {t(uiLocale, "dashboard.purchaseAp.title")}
        </p>
        <Link
          href="/stock?tab=purchase"
          className="text-xs font-medium text-amber-800 hover:underline"
        >
          {t(uiLocale, "dashboard.purchaseAp.linkToPo")}
        </Link>
      </div>
      <p className="mt-1 text-xs text-amber-800/90">
        {t(uiLocale, "dashboard.purchaseAp.count.overduePrefix")}{" "}
        {fmtCount(reminder.summary.overdueCount, uiLocale)}{" "}
        {t(uiLocale, "dashboard.purchaseAp.count.itemsSuffix")}
        {" · "}
        {t(uiLocale, "dashboard.purchaseAp.count.dueSoonPrefix")}{" "}
        {fmtCount(reminder.summary.dueSoonCount, uiLocale)}{" "}
        {t(uiLocale, "dashboard.purchaseAp.count.itemsSuffix")}
      </p>
      <p className="text-xs text-amber-800/90">
        {t(uiLocale, "dashboard.purchaseAp.amount.overduePrefix")}{" "}
        {fmtPrice(reminder.summary.overdueOutstandingBase, reminder.storeCurrency, uiLocale)}
        {" · "}
        {t(uiLocale, "dashboard.purchaseAp.amount.dueSoonPrefix")}{" "}
        {fmtPrice(reminder.summary.dueSoonOutstandingBase, reminder.storeCurrency, uiLocale)}
      </p>

      {!hasReminder ? (
        <p className="mt-2 text-sm text-amber-800/90">
          {t(uiLocale, "dashboard.purchaseAp.empty")}
        </p>
      ) : (
        <ul className="mt-2 space-y-1.5 text-xs text-amber-950">
          {reminder.summary.items.map((item) => (
            <li key={item.poId} className="rounded-lg border border-amber-200 bg-white px-2.5 py-2">
              <p className="font-medium">
                {item.poNumber} · {item.supplierName}
              </p>
              <p className="text-amber-800/90">
                {item.dueStatus === "OVERDUE"
                  ? `${t(uiLocale, "dashboard.purchaseAp.item.overduePrefix")} ${fmtCount(Math.abs(item.daysUntilDue), uiLocale)} ${t(uiLocale, "dashboard.purchaseAp.item.daysSuffix")}`
                  : `${t(uiLocale, "dashboard.purchaseAp.item.dueInPrefix")} ${fmtCount(item.daysUntilDue, uiLocale)} ${t(uiLocale, "dashboard.purchaseAp.item.daysSuffix")}`}
                {" · "}
                {t(uiLocale, "dashboard.purchaseAp.item.dueLabel")}{" "}
                {formatDate(item.dueDate, uiLocale)}
                {" · "}
                {t(uiLocale, "dashboard.purchaseAp.item.outstandingLabel")}{" "}
                {fmtPrice(item.outstandingBase, reminder.storeCurrency, uiLocale)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
