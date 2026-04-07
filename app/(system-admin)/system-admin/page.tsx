import Link from "next/link";
import { Suspense } from "react";
import {
  Crown,
  ShieldCheck,
  ShieldAlert,
  Store,
  UserCheck,
  Users,
} from "lucide-react";

import { getSession } from "@/lib/auth/session";
import { DEFAULT_UI_LOCALE, type UiLocale, uiLocaleToDateLocale } from "@/lib/i18n/locales";
import { t } from "@/lib/i18n/messages";
import { SystemAdminRefreshButton } from "@/components/system-admin/system-admin-refresh-button";
import {
  getSystemAdminDashboardStats,
  type SystemAdminDashboardStats,
} from "@/lib/system-admin/dashboard";
import { listSuperadmins, type SuperadminItem } from "@/lib/system-admin/superadmins";

function DashboardStatsCardsSkeleton() {
  const cards = [
    { icon: Users },
    { icon: Store },
    { icon: Users },
    { icon: UserCheck },
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((item, index) => {
        const Icon = item.icon;
        return (
          <div key={index} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <span className="text-slate-400">
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="h-3 w-24 animate-pulse rounded bg-slate-200" />
            </p>
            <div className="mt-2 h-8 w-20 animate-pulse rounded bg-slate-200" />
          </div>
        );
      })}
    </div>
  );
}

async function DashboardStatsCards({
  statsPromise,
  uiLocale,
  numberLocale,
}: {
  statsPromise: Promise<SystemAdminDashboardStats>;
  uiLocale: UiLocale;
  numberLocale: string;
}) {
  const stats = await statsPromise;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
          <span className="text-slate-400">
            <Users className="h-3.5 w-3.5" />
          </span>
          <span>{t(uiLocale, "systemAdmin.dashboard.card.totalClients")}</span>
        </p>
        <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          {stats.totalClients.toLocaleString(numberLocale)}
        </p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
          <span className="text-slate-400">
            <Store className="h-3.5 w-3.5" />
          </span>
          <span>{t(uiLocale, "systemAdmin.dashboard.card.totalStores")}</span>
        </p>
        <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          {stats.totalStores.toLocaleString(numberLocale)}
        </p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
          <span className="text-slate-400">
            <Users className="h-3.5 w-3.5" />
          </span>
          <span>{t(uiLocale, "systemAdmin.dashboard.card.totalUsers")}</span>
        </p>
        <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          {stats.totalUsers.toLocaleString(numberLocale)}
        </p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
          <span className="text-slate-400">
            <UserCheck className="h-3.5 w-3.5" />
          </span>
          <span>{t(uiLocale, "systemAdmin.dashboard.card.activeMembers")}</span>
        </p>
        <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          {stats.totalActiveMembers.toLocaleString(numberLocale)}
        </p>
      </div>
    </div>
  );
}

function TopClientsSkeleton() {
  return (
    <div className="mt-3 space-y-2">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div className="mt-0.5 h-9 w-9 animate-pulse rounded-full bg-slate-200" />
              <div className="min-w-0">
                <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
                <div className="mt-2 h-3 w-52 animate-pulse rounded bg-slate-200" />
              </div>
            </div>
            <div className="mt-1 h-6 w-12 animate-pulse rounded bg-slate-200" />
          </div>
        </div>
      ))}
    </div>
  );
}

async function TopClientsList({
  superadminsPromise,
  uiLocale,
  numberLocale,
}: {
  superadminsPromise: Promise<SuperadminItem[]>;
  uiLocale: UiLocale;
  numberLocale: string;
}) {
  const superadmins = await superadminsPromise;
  const topClients = [...superadmins]
    .sort((a, b) => b.activeOwnerStoreCount - a.activeOwnerStoreCount)
    .slice(0, 5);

  if (topClients.length === 0) {
    return (
      <p className="mt-3 text-sm text-muted-foreground">
        {t(uiLocale, "systemAdmin.dashboard.topClients.empty")}
      </p>
    );
  }

  return (
    <ul className="mt-3 space-y-2">
      {topClients.map((item) => (
        <li key={item.userId} className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
                {item.name?.trim()?.slice(0, 1)?.toUpperCase() ?? "?"}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
                <p className="truncate text-xs text-slate-500">{item.email}</p>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-semibold text-slate-900">
                {item.activeOwnerStoreCount.toLocaleString(numberLocale)}
              </p>
              <p className="text-[11px] text-slate-500">
                {t(uiLocale, "systemAdmin.dashboard.topClients.ownerStoresPrefix")}
              </p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function StorePermissionSummarySkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="flex items-center justify-between gap-3">
          <div className="h-4 w-44 animate-pulse rounded bg-slate-200" />
          <div className="h-5 w-10 animate-pulse rounded bg-slate-200" />
        </div>
      ))}
    </div>
  );
}

async function StorePermissionSummary({
  statsPromise,
  uiLocale,
  numberLocale,
}: {
  statsPromise: Promise<SystemAdminDashboardStats>;
  uiLocale: UiLocale;
  numberLocale: string;
}) {
  const stats = await statsPromise;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <p className="text-slate-600">
          {t(uiLocale, "systemAdmin.dashboard.storePermissions.canCreateStores")}
        </p>
        <p className="shrink-0 font-semibold text-slate-900">
          {stats.totalClientsCanCreateStores.toLocaleString(numberLocale)}
        </p>
      </div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <p className="text-slate-600">
          {t(uiLocale, "systemAdmin.dashboard.storePermissions.unlimitedClients")}
        </p>
        <p className="shrink-0 font-semibold text-slate-900">
          {stats.totalUnlimitedClients.toLocaleString(numberLocale)}
        </p>
      </div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <p className="text-slate-600">
          {t(uiLocale, "systemAdmin.dashboard.storePermissions.suspendedMembers")}
        </p>
        <p className="shrink-0 font-semibold text-slate-900">
          {stats.totalSuspendedMembers.toLocaleString(numberLocale)}
        </p>
      </div>
    </div>
  );
}

function SecuritySignalsSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="flex items-center justify-between gap-3">
          <div className="h-4 w-44 animate-pulse rounded bg-slate-200" />
          <div className="h-5 w-12 animate-pulse rounded bg-slate-200" />
        </div>
      ))}
    </div>
  );
}

async function SecuritySignalsSummary({
  statsPromise,
  uiLocale,
  numberLocale,
}: {
  statsPromise: Promise<SystemAdminDashboardStats>;
  uiLocale: UiLocale;
  numberLocale: string;
}) {
  const stats = await statsPromise;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <p className="text-slate-600">{t(uiLocale, "systemAdmin.dashboard.securitySignals.suspendedClients")}</p>
        <p className="shrink-0 font-semibold text-slate-900">
          {stats.totalSuspendedClients.toLocaleString(numberLocale)}
        </p>
      </div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <p className="text-slate-600">
          {t(uiLocale, "systemAdmin.dashboard.securitySignals.mustChangePassword")}
        </p>
        <p className="shrink-0 font-semibold text-slate-900">
          {stats.totalMustChangePasswordUsers.toLocaleString(numberLocale)}
        </p>
      </div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <p className="text-slate-600">{t(uiLocale, "systemAdmin.dashboard.securitySignals.audit24h")}</p>
        <p className="shrink-0 font-semibold text-slate-900">
          {stats.totalAuditEvents24h.toLocaleString(numberLocale)}
        </p>
      </div>
    </div>
  );
}

export default async function SystemAdminDashboardPage() {
  const session = await getSession();
  const uiLocale = session?.uiLocale ?? DEFAULT_UI_LOCALE;
  const numberLocale = uiLocaleToDateLocale(uiLocale);
  const statsPromise = getSystemAdminDashboardStats();
  const superadminsPromise = listSuperadmins();

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600">
          <ShieldCheck className="h-3.5 w-3.5" />
          {t(uiLocale, "systemAdmin.workspaceBadge")}
        </div>
        <SystemAdminRefreshButton uiLocale={uiLocale} />
      </div>

      <Suspense fallback={<DashboardStatsCardsSkeleton />}>
        <DashboardStatsCards
          statsPromise={statsPromise}
          uiLocale={uiLocale}
          numberLocale={numberLocale}
        />
      </Suspense>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Crown className="h-4 w-4 text-slate-500" />
              <span>{t(uiLocale, "systemAdmin.dashboard.topClients.title")}</span>
            </h2>
            <Link
              href="/system-admin/config/clients"
              prefetch
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              {t(uiLocale, "systemAdmin.dashboard.topClients.manage")}
            </Link>
          </div>

          <Suspense fallback={<TopClientsSkeleton />}>
            <TopClientsList
              superadminsPromise={superadminsPromise}
              uiLocale={uiLocale}
              numberLocale={numberLocale}
            />
          </Suspense>
        </article>

        <div className="space-y-3">
          <article className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <ShieldCheck className="h-4 w-4 text-slate-500" />
              <span>{t(uiLocale, "systemAdmin.dashboard.storePermissions.title")}</span>
            </h2>
            <Suspense fallback={<StorePermissionSummarySkeleton />}>
              <StorePermissionSummary
                statsPromise={statsPromise}
                uiLocale={uiLocale}
                numberLocale={numberLocale}
              />
            </Suspense>
          </article>

          <article className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <ShieldAlert className="h-4 w-4 text-slate-500" />
                <span>{t(uiLocale, "systemAdmin.dashboard.securitySignals.title")}</span>
              </h2>
              <Link
                href="/system-admin/config/security"
                prefetch
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                {t(uiLocale, "systemAdmin.dashboard.securitySignals.manage")}
              </Link>
            </div>
            <Suspense fallback={<SecuritySignalsSkeleton />}>
              <SecuritySignalsSummary
                statsPromise={statsPromise}
                uiLocale={uiLocale}
                numberLocale={numberLocale}
              />
            </Suspense>
          </article>
        </div>
      </div>
    </section>
  );
}
