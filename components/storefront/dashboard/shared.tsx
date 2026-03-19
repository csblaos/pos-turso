import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  ClipboardList,
  Coffee,
  PackageSearch,
  ShoppingBag,
  UtensilsCrossed,
  WalletCards,
  AppWindow,
  type LucideIcon,
} from "lucide-react";

import type { AppSession } from "@/lib/auth/session-types";
import { currencySymbol, type StoreCurrency } from "@/lib/finance/store-financial";
import { type UiLocale, uiLocaleToDateLocale } from "@/lib/i18n/locales";
import { t } from "@/lib/i18n/messages";
import type { DashboardViewData } from "@/server/services/dashboard.service";

export type StorefrontDashboardProps = {
  session: AppSession;
  dashboardDataPromise: Promise<DashboardViewData>;
  canViewOrders: boolean;
  canViewInventory: boolean;
  canViewReports: boolean;
};

export type DashboardThemeName = "online" | "cafe" | "restaurant" | "other";

type DashboardTheme = {
  badgeClassName: string;
  heroClassName: string;
  heroMutedTextClassName: string;
  heroIconWrapClassName: string;
  heroIconClassName: string;
  focusCardClassName: string;
  primaryActionClassName: string;
  secondaryActionClassName: string;
  detailCardClassName: string;
  icon: LucideIcon;
  storeTypeTitleKey:
    | "onboarding.storeType.online.title"
    | "onboarding.storeType.cafe.title"
    | "onboarding.storeType.restaurant.title"
    | "onboarding.storeType.other.title";
};

type DashboardFocusItem = {
  key: string;
  href: string;
  title: string;
  description: string;
  value: string;
  valueCaption: string;
  actionLabel: string;
  icon: LucideIcon;
};

const dashboardThemes: Record<DashboardThemeName, DashboardTheme> = {
  online: {
    badgeClassName: "bg-sky-100 text-sky-900 ring-1 ring-sky-200",
    heroClassName:
      "border border-sky-200 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.88),_rgba(240,249,255,0.98)_38%,_rgba(224,242,254,0.98)_100%)]",
    heroMutedTextClassName: "text-sky-900/72",
    heroIconWrapClassName: "bg-sky-900 text-sky-50 shadow-lg shadow-sky-200/70",
    heroIconClassName: "text-sky-50",
    focusCardClassName: "border-sky-200/80 bg-white/95 shadow-sm shadow-sky-100/70",
    primaryActionClassName: "text-sky-700 hover:text-sky-900",
    secondaryActionClassName: "text-sky-700 hover:bg-sky-50",
    detailCardClassName: "border-sky-100 bg-white/95",
    icon: ShoppingBag,
    storeTypeTitleKey: "onboarding.storeType.online.title",
  },
  cafe: {
    badgeClassName: "bg-amber-100 text-amber-950 ring-1 ring-amber-200",
    heroClassName:
      "border border-amber-200 bg-[radial-gradient(circle_at_top_left,_rgba(255,251,235,0.96),_rgba(254,243,199,0.92)_42%,_rgba(255,255,255,0.98)_100%)]",
    heroMutedTextClassName: "text-amber-950/70",
    heroIconWrapClassName: "bg-amber-900 text-amber-50 shadow-lg shadow-amber-200/70",
    heroIconClassName: "text-amber-50",
    focusCardClassName: "border-amber-200/80 bg-white/95 shadow-sm shadow-amber-100/70",
    primaryActionClassName: "text-amber-800 hover:text-amber-950",
    secondaryActionClassName: "text-amber-800 hover:bg-amber-50",
    detailCardClassName: "border-amber-100 bg-white/95",
    icon: Coffee,
    storeTypeTitleKey: "onboarding.storeType.cafe.title",
  },
  restaurant: {
    badgeClassName: "bg-rose-100 text-rose-950 ring-1 ring-rose-200",
    heroClassName:
      "border border-rose-200 bg-[radial-gradient(circle_at_top_left,_rgba(255,241,242,0.98),_rgba(255,228,230,0.96)_40%,_rgba(255,247,237,0.98)_100%)]",
    heroMutedTextClassName: "text-rose-950/70",
    heroIconWrapClassName: "bg-rose-900 text-rose-50 shadow-lg shadow-rose-200/70",
    heroIconClassName: "text-rose-50",
    focusCardClassName: "border-rose-200/80 bg-white/95 shadow-sm shadow-rose-100/70",
    primaryActionClassName: "text-rose-800 hover:text-rose-950",
    secondaryActionClassName: "text-rose-800 hover:bg-rose-50",
    detailCardClassName: "border-rose-100 bg-white/95",
    icon: UtensilsCrossed,
    storeTypeTitleKey: "onboarding.storeType.restaurant.title",
  },
  other: {
    badgeClassName: "bg-violet-100 text-violet-950 ring-1 ring-violet-200",
    heroClassName:
      "border border-violet-200 bg-[radial-gradient(circle_at_top_left,_rgba(245,243,255,0.98),_rgba(237,233,254,0.96)_42%,_rgba(255,255,255,0.98)_100%)]",
    heroMutedTextClassName: "text-violet-950/70",
    heroIconWrapClassName: "bg-violet-900 text-violet-50 shadow-lg shadow-violet-200/70",
    heroIconClassName: "text-violet-50",
    focusCardClassName: "border-violet-200/80 bg-white/95 shadow-sm shadow-violet-100/70",
    primaryActionClassName: "text-violet-800 hover:text-violet-950",
    secondaryActionClassName: "text-violet-800 hover:bg-violet-50",
    detailCardClassName: "border-violet-100 bg-white/95",
    icon: AppWindow,
    storeTypeTitleKey: "onboarding.storeType.other.title",
  },
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

function buildDashboardFocusItems(
  dashboardData: DashboardViewData,
  uiLocale: UiLocale,
  options: Pick<
    StorefrontDashboardProps,
    "canViewOrders" | "canViewInventory"
  >,
): DashboardFocusItem[] {
  const items: DashboardFocusItem[] = [];
  const apSummary = dashboardData.purchaseApReminder.summary;
  const apTotalCount = apSummary.overdueCount + apSummary.dueSoonCount;

  if (options.canViewOrders && dashboardData.metrics.pendingPaymentCount > 0) {
    items.push({
      key: "pending-payment",
      href: "/orders?tab=payment-review",
      title: t(uiLocale, "dashboard.focus.pendingPayment.title"),
      description: t(uiLocale, "dashboard.focus.pendingPayment.description"),
      value: fmtCount(dashboardData.metrics.pendingPaymentCount, uiLocale),
      valueCaption: t(uiLocale, "dashboard.focus.pendingPayment.caption"),
      actionLabel: t(uiLocale, "dashboard.focus.action.openOrders"),
      icon: WalletCards,
    });
  }

  if (options.canViewInventory && dashboardData.metrics.lowStockCount > 0) {
    items.push({
      key: "low-stock",
      href: "/stock?tab=inventory",
      title: t(uiLocale, "dashboard.focus.lowStock.title"),
      description: t(uiLocale, "dashboard.focus.lowStock.description"),
      value: fmtCount(dashboardData.metrics.lowStockCount, uiLocale),
      valueCaption: t(uiLocale, "dashboard.focus.lowStock.caption"),
      actionLabel: t(uiLocale, "dashboard.focus.action.openInventory"),
      icon: PackageSearch,
    });
  }

  if (options.canViewInventory && apTotalCount > 0) {
    items.push({
      key: "purchase-ap",
      href: "/stock?tab=purchase",
      title: t(uiLocale, "dashboard.focus.purchaseAp.title"),
      description: t(uiLocale, "dashboard.focus.purchaseAp.description"),
      value: fmtCount(apTotalCount, uiLocale),
      valueCaption: t(uiLocale, "dashboard.focus.purchaseAp.caption"),
      actionLabel: t(uiLocale, "dashboard.focus.action.openPurchase"),
      icon: AlertTriangle,
    });
  }

  if (options.canViewOrders) {
    items.push({
      key: "orders-today",
      href: "/orders",
      title: t(uiLocale, "dashboard.focus.ordersToday.title"),
      description: t(uiLocale, "dashboard.focus.ordersToday.description"),
      value: fmtCount(dashboardData.metrics.ordersCountToday, uiLocale),
      valueCaption: t(uiLocale, "dashboard.focus.ordersToday.caption"),
      actionLabel: t(uiLocale, "dashboard.focus.action.openOrders"),
      icon: ClipboardList,
    });
  }

  return items.slice(0, 4);
}

function DashboardSectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="space-y-1 px-1">
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      <p className="text-sm text-slate-500">{subtitle}</p>
    </div>
  );
}

function DashboardFocusCard({
  item,
  theme,
}: {
  item: DashboardFocusItem;
  theme: DashboardTheme;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={`group rounded-3xl border p-4 transition-all ${theme.focusCardClassName}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-slate-950">{item.title}</p>
          <p className="text-sm text-slate-500">{item.description}</p>
        </div>
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-3xl font-semibold tracking-tight text-slate-950">{item.value}</p>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
            {item.valueCaption}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1 text-sm font-semibold ${theme.primaryActionClassName}`}>
          {item.actionLabel}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

function DashboardSummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/60 bg-white/72 px-3 py-3 backdrop-blur-sm">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function DashboardEmptyFocus({
  theme,
  uiLocale,
}: {
  theme: DashboardTheme;
  uiLocale: UiLocale;
}) {
  return (
    <div className={`rounded-3xl border p-5 ${theme.focusCardClassName}`}>
      <p className="text-base font-semibold text-slate-950">{t(uiLocale, "dashboard.focus.clear.title")}</p>
      <p className="mt-1 text-sm text-slate-500">{t(uiLocale, "dashboard.focus.clear.description")}</p>
    </div>
  );
}

function DashboardLowStockCard({
  dashboardData,
  theme,
  uiLocale,
}: {
  dashboardData: DashboardViewData;
  theme: DashboardTheme;
  uiLocale: UiLocale;
}) {
  return (
    <div className={`rounded-3xl border p-4 ${theme.detailCardClassName}`}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-base font-semibold text-slate-950">{t(uiLocale, "dashboard.lowStock.title")}</p>
          <p className="mt-1 text-sm text-slate-500">{t(uiLocale, "dashboard.lowStock.description")}</p>
        </div>
        <Link
          href="/stock?tab=inventory"
          className={`inline-flex items-center gap-1 text-sm font-semibold ${theme.secondaryActionClassName}`}
        >
          {t(uiLocale, "dashboard.lowStock.linkToInventory")}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      {dashboardData.lowStockItems.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">{t(uiLocale, "dashboard.lowStock.empty")}</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {dashboardData.lowStockItems.slice(0, 5).map((item) => (
            <li
              key={item.productId}
              className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-950">{item.name}</p>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {item.sku} • {item.baseUnitCode}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-lg font-semibold text-slate-950">{fmtCount(item.available, uiLocale)}</p>
                <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
                  {t(uiLocale, "dashboard.lowStock.remaining")}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DashboardPurchaseApCard({
  dashboardData,
  theme,
  uiLocale,
}: {
  dashboardData: DashboardViewData;
  theme: DashboardTheme;
  uiLocale: UiLocale;
}) {
  const reminder = dashboardData.purchaseApReminder;
  const hasReminder =
    reminder.summary.overdueCount > 0 || reminder.summary.dueSoonCount > 0;

  return (
    <div className={`rounded-3xl border p-4 ${theme.detailCardClassName}`}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-base font-semibold text-slate-950">{t(uiLocale, "dashboard.purchaseAp.title")}</p>
          <p className="mt-1 text-sm text-slate-500">{t(uiLocale, "dashboard.purchaseAp.description")}</p>
        </div>
        <Link
          href="/stock?tab=purchase"
          className={`inline-flex items-center gap-1 text-sm font-semibold ${theme.secondaryActionClassName}`}
        >
          {t(uiLocale, "dashboard.purchaseAp.linkToPo")}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-amber-800">
            {t(uiLocale, "dashboard.purchaseAp.count.overduePrefix")}
          </p>
          <p className="mt-1 text-xl font-semibold text-amber-950">
            {fmtCount(reminder.summary.overdueCount, uiLocale)}
          </p>
          <p className="text-xs text-amber-800/90">
            {fmtPrice(reminder.summary.overdueOutstandingBase, reminder.storeCurrency, uiLocale)}
          </p>
        </div>
        <div className="rounded-2xl border border-orange-200 bg-orange-50 px-3 py-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-orange-800">
            {t(uiLocale, "dashboard.purchaseAp.count.dueSoonPrefix")}
          </p>
          <p className="mt-1 text-xl font-semibold text-orange-950">
            {fmtCount(reminder.summary.dueSoonCount, uiLocale)}
          </p>
          <p className="text-xs text-orange-800/90">
            {fmtPrice(reminder.summary.dueSoonOutstandingBase, reminder.storeCurrency, uiLocale)}
          </p>
        </div>
      </div>

      {!hasReminder ? (
        <p className="mt-4 text-sm text-slate-500">{t(uiLocale, "dashboard.purchaseAp.empty")}</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {reminder.summary.items.map((item) => (
            <li
              key={item.poId}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-3"
            >
              <p className="text-sm font-semibold text-slate-950">
                {item.poNumber} • {item.supplierName}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {item.dueStatus === "OVERDUE"
                  ? `${t(uiLocale, "dashboard.purchaseAp.item.overduePrefix")} ${fmtCount(Math.abs(item.daysUntilDue), uiLocale)} ${t(uiLocale, "dashboard.purchaseAp.item.daysSuffix")}`
                  : `${t(uiLocale, "dashboard.purchaseAp.item.dueInPrefix")} ${fmtCount(item.daysUntilDue, uiLocale)} ${t(uiLocale, "dashboard.purchaseAp.item.daysSuffix")}`}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {t(uiLocale, "dashboard.purchaseAp.item.dueLabel")} {formatDate(item.dueDate, uiLocale)}
                {" • "}
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

export function DashboardWorkspaceSkeleton({
  themeName,
}: {
  themeName: DashboardThemeName;
}) {
  const theme = dashboardThemes[themeName];

  return (
    <section className="space-y-5">
      <div className={`rounded-[1.75rem] border p-5 ${theme.heroClassName}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="h-5 w-28 animate-pulse rounded bg-white/80" />
            <div className="h-8 w-44 animate-pulse rounded bg-white/90" />
            <div className="h-4 w-40 animate-pulse rounded bg-white/70" />
          </div>
          <div className={`h-14 w-14 rounded-[1.25rem] ${theme.heroIconWrapClassName} opacity-60`} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="rounded-2xl border border-white/60 bg-white/72 px-3 py-3">
              <div className="h-3 w-16 animate-pulse rounded bg-slate-200" />
              <div className="mt-2 h-6 w-20 animate-pulse rounded bg-slate-200" />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <div className="space-y-1 px-1">
          <div className="h-5 w-28 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-52 animate-pulse rounded bg-slate-200" />
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className={`rounded-3xl border p-4 ${theme.focusCardClassName}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
                  <div className="h-4 w-36 animate-pulse rounded bg-slate-200" />
                </div>
                <div className="h-10 w-10 animate-pulse rounded-2xl bg-slate-200" />
              </div>
              <div className="mt-4 space-y-2">
                <div className="h-8 w-20 animate-pulse rounded bg-slate-200" />
                <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <div className="space-y-1 px-1">
          <div className="h-5 w-24 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-44 animate-pulse rounded bg-slate-200" />
        </div>
        <div className={`rounded-3xl border p-4 ${theme.focusCardClassName}`}>
          <div className="h-5 w-28 animate-pulse rounded bg-slate-200" />
          <div className="mt-2 h-4 w-36 animate-pulse rounded bg-slate-200" />
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className={`rounded-3xl border p-4 ${theme.detailCardClassName}`}>
            <div className="h-5 w-36 animate-pulse rounded bg-slate-200" />
            <div className="mt-2 h-4 w-48 animate-pulse rounded bg-slate-200" />
            <div className="mt-4 space-y-2">
              {Array.from({ length: 3 }).map((__, lineIndex) => (
                <div key={lineIndex} className="h-16 animate-pulse rounded-2xl bg-slate-100" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export async function ThemedStorefrontDashboard({
  session,
  dashboardDataPromise,
  canViewOrders,
  canViewInventory,
  canViewReports,
  themeName,
}: StorefrontDashboardProps & {
  themeName: DashboardThemeName;
}) {
  const dashboardData = await dashboardDataPromise;
  const theme = dashboardThemes[themeName];
  const uiLocale = session.uiLocale;
  const HeroIcon = theme.icon;

  const focusItems = buildDashboardFocusItems(dashboardData, uiLocale, {
    canViewOrders,
    canViewInventory,
  });
  return (
    <section className="space-y-5">
      <div className={`rounded-[1.75rem] p-5 ${theme.heroClassName}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${theme.badgeClassName}`}
            >
              {t(uiLocale, theme.storeTypeTitleKey)}
            </span>
            <p className={`mt-3 text-sm font-medium ${theme.heroMutedTextClassName}`}>
              {t(uiLocale, "dashboard.hero.greeting")}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
              {session.displayName}
            </h1>
            <p className={`mt-2 text-sm ${theme.heroMutedTextClassName}`}>
              {session.activeStoreName ?? "-"}
              {session.activeBranchName ? ` • ${session.activeBranchName}` : ""}
              {session.activeRoleName ? ` • ${session.activeRoleName}` : ""}
            </p>
          </div>
          <div
            className={`inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.25rem] ${theme.heroIconWrapClassName}`}
          >
            <HeroIcon className={`h-6 w-6 ${theme.heroIconClassName}`} />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <DashboardSummaryCard
            label={t(uiLocale, "dashboard.todaySales.label")}
            value={fmtPrice(
              dashboardData.metrics.todaySales,
              dashboardData.purchaseApReminder.storeCurrency,
              uiLocale,
            )}
          />
          <DashboardSummaryCard
            label={t(uiLocale, "dashboard.cards.ordersToday")}
            value={fmtCount(dashboardData.metrics.ordersCountToday, uiLocale)}
          />
          <DashboardSummaryCard
            label={t(uiLocale, "dashboard.cards.pendingPayment")}
            value={fmtCount(dashboardData.metrics.pendingPaymentCount, uiLocale)}
          />
          <DashboardSummaryCard
            label={t(uiLocale, "dashboard.cards.lowStock")}
            value={fmtCount(dashboardData.metrics.lowStockCount, uiLocale)}
          />
        </div>
      </div>

      <div className="space-y-3">
        <DashboardSectionHeader
          title={t(uiLocale, "dashboard.focus.title")}
          subtitle={t(uiLocale, "dashboard.focus.subtitle")}
        />
        {focusItems.length === 0 ? (
          <DashboardEmptyFocus theme={theme} uiLocale={uiLocale} />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {focusItems.map((item) => (
              <DashboardFocusCard key={item.key} item={item} theme={theme} />
            ))}
          </div>
        )}
      </div>

      {canViewReports ? (
        <div className="px-1">
          <Link
            href="/reports"
            className={`inline-flex items-center gap-1 text-sm font-semibold ${theme.primaryActionClassName}`}
          >
            {t(uiLocale, "dashboard.reports.more")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : null}

      {canViewInventory ? (
        <div className="space-y-3">
          <DashboardSectionHeader
            title={t(uiLocale, "dashboard.details.title")}
            subtitle={t(uiLocale, "dashboard.details.subtitle")}
          />
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]">
            <DashboardPurchaseApCard dashboardData={dashboardData} theme={theme} uiLocale={uiLocale} />
            <DashboardLowStockCard dashboardData={dashboardData} theme={theme} uiLocale={uiLocale} />
          </div>
        </div>
      ) : null}
    </section>
  );
}
