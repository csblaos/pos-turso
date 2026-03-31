import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  ChevronRight,
  ClipboardList,
  Gauge,
  PlugZap,
  Settings2,
  ShieldCheck,
  Store,
  Users,
} from "lucide-react";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { SuperadminHomeHelpButton } from "@/components/app/superadmin-home-help-button";
import { getSession } from "@/lib/auth/session";
import { listActiveMemberships } from "@/lib/auth/session-db";
import { uiLocaleToDateLocale, type UiLocale } from "@/lib/i18n/locales";
import { t } from "@/lib/i18n/messages";
import { getSuperadminHomeSnapshot } from "@/lib/superadmin/home-dashboard";

const quickActions = [
  {
    href: "/settings/superadmin/stores",
    titleKey: "settings.superadminHome.quickActions.operations.title",
    descriptionKey: "settings.superadminHome.quickActions.operations.description",
    icon: Building2,
  },
  {
    href: "/settings/superadmin/users",
    titleKey: "settings.superadminHome.quickActions.access.title",
    descriptionKey: "settings.superadminHome.quickActions.access.description",
    icon: Users,
  },
  {
    href: "/settings/superadmin/security",
    titleKey: "settings.superadminHome.quickActions.security.title",
    descriptionKey: "settings.superadminHome.quickActions.security.description",
    icon: ShieldCheck,
  },
  {
    href: "/settings/superadmin/quotas",
    titleKey: "settings.superadminHome.quickActions.quotas.title",
    descriptionKey: "settings.superadminHome.quickActions.quotas.description",
    icon: Gauge,
  },
  {
    href: "/settings/superadmin/global-config",
    titleKey: "settings.superadminHome.quickActions.globalConfig.title",
    descriptionKey: "settings.superadminHome.quickActions.globalConfig.description",
    icon: Settings2,
  },
  {
    href: "/settings/superadmin/audit-log",
    titleKey: "settings.superadminHome.quickActions.auditLog.title",
    descriptionKey: "settings.superadminHome.quickActions.auditLog.description",
    icon: ClipboardList,
  },
  {
    href: "/settings/superadmin/integrations",
    titleKey: "settings.superadminHome.quickActions.integrations.title",
    descriptionKey: "settings.superadminHome.quickActions.integrations.description",
    icon: PlugZap,
  },
  {
    href: "/settings/stores",
    titleKey: "settings.superadminHome.quickActions.backToStores.title",
    descriptionKey: "settings.superadminHome.quickActions.backToStores.description",
    icon: Store,
  },
] as const;

function SuperadminOverviewFallback({
  totalStores,
  uiLocale,
  numberLocale,
}: {
  totalStores: number;
  uiLocale: UiLocale;
  numberLocale: string;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">
            {t(uiLocale, "settings.superadminHome.card.totalStores")}
          </p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {totalStores.toLocaleString(numberLocale)}
          </p>
        </article>
        {Array.from({ length: 3 }).map((_, index) => (
          <article key={index} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="h-3 w-28 animate-pulse rounded bg-slate-200" />
            <div className="mt-2 h-8 w-24 animate-pulse rounded bg-slate-100" />
          </article>
        ))}
      </div>

      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
          <div className="mt-1 h-3 w-72 animate-pulse rounded bg-slate-100" />
        </div>
        <div className="space-y-2 px-4 py-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-5 w-full animate-pulse rounded bg-slate-100" />
          ))}
        </div>
      </article>

      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
          <div className="mt-1 h-3 w-40 animate-pulse rounded bg-slate-100" />
        </div>
        <div className="space-y-2 px-4 py-3">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="h-4 w-full animate-pulse rounded bg-slate-100" />
          ))}
        </div>
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="h-4 w-44 animate-pulse rounded bg-slate-200" />
        <div className="mt-2 h-3 w-full animate-pulse rounded bg-slate-100" />
        <div className="mt-1 h-3 w-5/6 animate-pulse rounded bg-slate-100" />
      </article>
    </>
  );
}

async function SuperadminOverviewPanels({
  userId,
  storeIds,
  totalStores,
  uiLocale,
  numberLocale,
}: {
  userId: string;
  storeIds: string[];
  totalStores: number;
  uiLocale: UiLocale;
  numberLocale: string;
}) {
  const snapshot = await getSuperadminHomeSnapshot(userId, storeIds);
  const cacheDriver = process.env.REDIS_DRIVER?.trim() || "unknown";

  const alerts: string[] = [];
  if (snapshot.storesNeedAttention > 0) {
    alerts.push(
      `${t(uiLocale, "settings.superadminHome.alerts.storesNeedAttentionPrefix")} ${snapshot.storesNeedAttention.toLocaleString(numberLocale)} ${t(uiLocale, "settings.superadminHome.alerts.storesNeedAttentionSuffix")}`,
    );
  }
  if (snapshot.channelErrorStoreCount > 0) {
    alerts.push(
      `${t(uiLocale, "settings.superadminHome.alerts.channelErrorsPrefix")} ${snapshot.channelErrorStoreCount.toLocaleString(numberLocale)} ${t(uiLocale, "settings.superadminHome.alerts.channelErrorsSuffix")}`,
    );
  }
  if (snapshot.totalSuspendedMembers > 0) {
    alerts.push(
      `${t(uiLocale, "settings.superadminHome.alerts.suspendedMembersPrefix")} ${snapshot.totalSuspendedMembers.toLocaleString(numberLocale)} ${t(uiLocale, "settings.superadminHome.alerts.suspendedMembersSuffix")}`,
    );
  }
  if (snapshot.totalInvitedMembers > 0) {
    alerts.push(
      `${t(uiLocale, "settings.superadminHome.alerts.invitedMembersPrefix")} ${snapshot.totalInvitedMembers.toLocaleString(numberLocale)} ${t(uiLocale, "settings.superadminHome.alerts.invitedMembersSuffix")}`,
    );
  }
  if (!snapshot.storeCreationAllowed && snapshot.storeCreationBlockedReason) {
    alerts.push(snapshot.storeCreationBlockedReason);
  }

  const messagingStatus =
    snapshot.channelErrorStoreCount > 0
      ? `${t(uiLocale, "settings.superadminHome.health.messaging.statusNeedsAttentionPrefix")} ${snapshot.channelErrorStoreCount.toLocaleString(numberLocale)} ${t(uiLocale, "settings.superadminHome.health.messaging.statusNeedsAttentionSuffix")}`
      : t(uiLocale, "settings.superadminHome.health.messaging.statusNormal");
  const sessionLimitText = `${snapshot.globalSessionDefault.toLocaleString(numberLocale)} ${t(uiLocale, "settings.superadminHome.policySnapshot.sessionDefaultSuffix")}`;
  const branchPolicyText = snapshot.globalBranchDefaultCanCreate
    ? t(uiLocale, "settings.superadminHome.policySnapshot.branchAllowed")
    : t(uiLocale, "settings.superadminHome.policySnapshot.branchBlocked");
  const branchQuotaText =
    snapshot.globalBranchDefaultMax === null
      ? t(uiLocale, "settings.superadminHome.policySnapshot.unlimited")
      : `${t(uiLocale, "settings.superadminHome.policySnapshot.maxPrefix")} ${snapshot.globalBranchDefaultMax.toLocaleString(numberLocale)} ${t(uiLocale, "settings.superadminHome.policySnapshot.maxSuffix")}`;
  const storeLogoText = `${snapshot.globalStoreLogoPolicy.maxSizeMb.toLocaleString(numberLocale)} MB · ${t(uiLocale, "settings.superadminHome.policySnapshot.resizeLabel")} ${snapshot.globalStoreLogoPolicy.autoResize ? t(uiLocale, "settings.superadminHome.policySnapshot.autoResizeEnabled") : t(uiLocale, "settings.superadminHome.policySnapshot.autoResizeDisabled")} · ${snapshot.globalStoreLogoPolicy.resizeMaxWidth.toLocaleString(numberLocale)} px`;
  const paymentAccountsText = `${t(uiLocale, "superadmin.globalConfig.systemDefaults.paymentPolicy.maxAccountsPrefix")} ${snapshot.globalPaymentPolicy.maxAccountsPerStore.toLocaleString(numberLocale)} ${t(uiLocale, "settings.superadminHome.policySnapshot.paymentAccountsSuffix")}`;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">
            {t(uiLocale, "settings.superadminHome.card.totalStores")}
          </p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {totalStores.toLocaleString(numberLocale)}
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">
            {t(uiLocale, "settings.superadminHome.card.storesNeedAttention")}
          </p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {snapshot.storesNeedAttention.toLocaleString(numberLocale)}
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">
            {t(uiLocale, "settings.superadminHome.card.todayOrders")}
          </p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {snapshot.totalTodayOrders.toLocaleString(numberLocale)}
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">
            {t(uiLocale, "settings.superadminHome.card.todaySales")}
          </p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {snapshot.totalTodaySales.toLocaleString(numberLocale)}
          </p>
        </article>
      </div>

      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <p className="text-sm font-semibold text-slate-900">
            {t(uiLocale, "settings.superadminHome.health.title")}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {t(uiLocale, "settings.superadminHome.health.subtitle")}
          </p>
        </div>
        <ul className="divide-y divide-slate-100">
          <li className="flex min-h-14 items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-900">
                {t(uiLocale, "settings.superadminHome.health.database.title")}
              </p>
              <p className="text-xs text-slate-500">
                {t(uiLocale, "settings.superadminHome.health.database.description")}
              </p>
            </div>
            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
              {t(uiLocale, "settings.superadminHome.health.database.statusReady")}
            </span>
          </li>
          <li className="flex min-h-14 items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-900">
                {t(uiLocale, "settings.superadminHome.health.cache.title")}
              </p>
              <p className="text-xs text-slate-500">
                {t(uiLocale, "settings.superadminHome.health.cache.driverPrefix")} {cacheDriver}
              </p>
            </div>
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
              {t(uiLocale, "settings.superadminHome.health.cache.statusNormal")}
            </span>
          </li>
          <li className="flex min-h-14 items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-900">
                {t(uiLocale, "settings.superadminHome.health.messaging.title")}
              </p>
              <p className="text-xs text-slate-500">
                {t(uiLocale, "settings.superadminHome.health.messaging.description")}
              </p>
            </div>
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                snapshot.channelErrorStoreCount > 0
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700"
              }`}
            >
              {messagingStatus}
            </span>
          </li>
        </ul>
      </article>

      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <p className="text-sm font-semibold text-slate-900">
            {t(uiLocale, "settings.superadminHome.alerts.title")}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {t(uiLocale, "settings.superadminHome.alerts.subtitle")}
          </p>
        </div>
        {alerts.length === 0 ? (
          <p className="px-4 py-4 text-sm text-emerald-700">
            {t(uiLocale, "settings.superadminHome.alerts.empty")}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {alerts.map((alert, index) => (
              <li key={`${alert}-${index}`} className="flex items-start gap-2 px-4 py-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <p className="text-sm text-slate-700">{alert}</p>
              </li>
            ))}
          </ul>
        )}
      </article>

      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <p className="text-sm font-semibold text-slate-900">
            {t(uiLocale, "settings.superadminHome.policySnapshot.title")}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {t(uiLocale, "settings.superadminHome.policySnapshot.subtitle")}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="text-xs text-slate-500">
              {t(uiLocale, "settings.superadminHome.policySnapshot.sessionDefaultLabel")}
            </p>
            <p className="mt-1 text-sm font-medium text-slate-900">{sessionLimitText}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="text-xs text-slate-500">
              {t(uiLocale, "settings.superadminHome.policySnapshot.branchDefaultLabel")}
            </p>
            <p className="mt-1 text-sm font-medium text-slate-900">{branchPolicyText}</p>
            <p className="mt-1 text-xs text-slate-500">{branchQuotaText}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="text-xs text-slate-500">
              {t(uiLocale, "settings.superadminHome.policySnapshot.paymentAccountsLabel")}
            </p>
            <p className="mt-1 text-sm font-medium text-slate-900">{paymentAccountsText}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="text-xs text-slate-500">
              {t(uiLocale, "settings.superadminHome.policySnapshot.storeLogoLabel")}
            </p>
            <p className="mt-1 text-sm font-medium text-slate-900">{storeLogoText}</p>
          </div>
        </div>
      </article>
    </>
  );
}

export default async function SettingsSuperadminRootPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  const uiLocale = session.uiLocale;
  const numberLocale = uiLocaleToDateLocale(uiLocale);

  const memberships = await listActiveMemberships(session.userId);
  if (memberships.length === 0) {
    redirect("/onboarding");
  }

  const storeIds = memberships.map((membership) => membership.storeId);

  return (
    <section className="space-y-5">
      <header className="flex items-start justify-between gap-3 px-1">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            {t(uiLocale, "settings.superadminHome.badge")}
          </p>
          <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">
            {t(uiLocale, "settings.superadminHome.title")}
          </h1>
        </div>
        <div className="shrink-0">
          <SuperadminHomeHelpButton uiLocale={uiLocale} />
        </div>
      </header>

      <div className="space-y-2">
        <p className="px-1 text-[11px] font-semibold uppercase text-slate-500">
          {t(uiLocale, "settings.superadminHome.quickActions.section")}
        </p>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {quickActions.map((item, index) => {
            const Icon = item.icon;
            const isLast = index === quickActions.length - 1;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50 ${
                  isLast ? "" : "border-b border-slate-100"
                }`}
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-900">
                    {t(uiLocale, item.titleKey)}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-slate-500">
                    {t(uiLocale, item.descriptionKey)}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />
              </Link>
            );
          })}
        </div>
      </div>

      <Suspense
        fallback={
          <SuperadminOverviewFallback
            totalStores={memberships.length}
            uiLocale={uiLocale}
            numberLocale={numberLocale}
          />
        }
      >
        <SuperadminOverviewPanels
          userId={session.userId}
          storeIds={storeIds}
          totalStores={memberships.length}
          uiLocale={uiLocale}
          numberLocale={numberLocale}
        />
      </Suspense>
    </section>
  );
}
