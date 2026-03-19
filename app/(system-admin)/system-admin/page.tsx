import Link from "next/link";
import { Suspense } from "react";

import { getSession } from "@/lib/auth/session";
import { DEFAULT_UI_LOCALE, type UiLocale, uiLocaleToDateLocale } from "@/lib/i18n/locales";
import { t } from "@/lib/i18n/messages";
import {
  getSystemAdminDashboardStats,
  type SystemAdminDashboardStats,
} from "@/lib/system-admin/dashboard";
import { listSuperadmins, type SuperadminItem } from "@/lib/system-admin/superadmins";

function DashboardStatsCardsSkeleton({
  uiLocale,
}: {
  uiLocale: UiLocale;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {([
        "systemAdmin.dashboard.card.totalClients",
        "systemAdmin.dashboard.card.totalStores",
        "systemAdmin.dashboard.card.totalUsers",
        "systemAdmin.dashboard.card.activeMembers",
      ] as const).map((labelKey) => (
        <div key={labelKey} className="rounded-xl border bg-white p-4">
          <p className="text-xs text-muted-foreground">{t(uiLocale, labelKey)}</p>
          <div className="mt-2 h-8 w-20 animate-pulse rounded bg-slate-200" />
        </div>
      ))}
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
      <div className="rounded-xl border bg-white p-4">
        <p className="text-xs text-muted-foreground">
          {t(uiLocale, "systemAdmin.dashboard.card.totalClients")}
        </p>
        <p className="mt-1 text-2xl font-semibold">
          {stats.totalClients.toLocaleString(numberLocale)}
        </p>
      </div>
      <div className="rounded-xl border bg-white p-4">
        <p className="text-xs text-muted-foreground">
          {t(uiLocale, "systemAdmin.dashboard.card.totalStores")}
        </p>
        <p className="mt-1 text-2xl font-semibold">
          {stats.totalStores.toLocaleString(numberLocale)}
        </p>
      </div>
      <div className="rounded-xl border bg-white p-4">
        <p className="text-xs text-muted-foreground">
          {t(uiLocale, "systemAdmin.dashboard.card.totalUsers")}
        </p>
        <p className="mt-1 text-2xl font-semibold">
          {stats.totalUsers.toLocaleString(numberLocale)}
        </p>
      </div>
      <div className="rounded-xl border bg-white p-4">
        <p className="text-xs text-muted-foreground">
          {t(uiLocale, "systemAdmin.dashboard.card.activeMembers")}
        </p>
        <p className="mt-1 text-2xl font-semibold">
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
        <div key={index} className="rounded-lg border p-3">
          <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
          <div className="mt-2 h-3 w-52 animate-pulse rounded bg-slate-200" />
          <div className="mt-2 h-3 w-48 animate-pulse rounded bg-slate-200" />
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
        <li key={item.userId} className="rounded-lg border p-3 text-sm">
          <p className="font-medium">{item.name}</p>
          <p className="text-xs text-muted-foreground">{item.email}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t(uiLocale, "systemAdmin.dashboard.topClients.ownerStoresPrefix")}{" "}
            {item.activeOwnerStoreCount.toLocaleString(numberLocale)}
          </p>
        </li>
      ))}
    </ul>
  );
}

function StorePermissionSummarySkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="h-5 w-full animate-pulse rounded bg-slate-200" />
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
      <p className="text-sm text-muted-foreground">
        {t(uiLocale, "systemAdmin.dashboard.storePermissions.canCreateStores")}{" "}
        {stats.totalClientsCanCreateStores.toLocaleString(numberLocale)}
      </p>
      <p className="text-sm text-muted-foreground">
        {t(uiLocale, "systemAdmin.dashboard.storePermissions.unlimitedClients")}{" "}
        {stats.totalUnlimitedClients.toLocaleString(numberLocale)}
      </p>
      <p className="text-sm text-muted-foreground">
        {t(uiLocale, "systemAdmin.dashboard.storePermissions.suspendedMembers")}{" "}
        {stats.totalSuspendedMembers.toLocaleString(numberLocale)}
      </p>
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
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">{t(uiLocale, "systemAdmin.dashboard.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t(uiLocale, "systemAdmin.dashboard.subtitle")}
        </p>
      </header>

      <Suspense fallback={<DashboardStatsCardsSkeleton uiLocale={uiLocale} />}>
        <DashboardStatsCards
          statsPromise={statsPromise}
          uiLocale={uiLocale}
          numberLocale={numberLocale}
        />
      </Suspense>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <article className="rounded-xl border bg-white p-4 lg:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">
              {t(uiLocale, "systemAdmin.dashboard.topClients.title")}
            </h2>
            <Link
              href="/system-admin/config/clients"
              prefetch
              className="text-sm text-blue-700 hover:underline"
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

        <article className="space-y-2 rounded-xl border bg-white p-4">
          <h2 className="text-sm font-semibold">
            {t(uiLocale, "systemAdmin.dashboard.storePermissions.title")}
          </h2>
          <Suspense fallback={<StorePermissionSummarySkeleton />}>
            <StorePermissionSummary
              statsPromise={statsPromise}
              uiLocale={uiLocale}
              numberLocale={numberLocale}
            />
          </Suspense>
          <Link
            href="/system-admin/config"
            prefetch
            className="inline-block text-sm text-blue-700 hover:underline"
          >
            {t(uiLocale, "systemAdmin.dashboard.storePermissions.goToConfig")}
          </Link>
        </article>
      </div>
    </section>
  );
}
