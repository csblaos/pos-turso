import { and, eq, inArray, sql } from "drizzle-orm";
import { ShieldCheck, Store } from "lucide-react";
import { redirect } from "next/navigation";

import { SuperadminOverviewHelpButton } from "@/components/app/superadmin-overview-help-button";
import { getSession } from "@/lib/auth/session";
import { listActiveMemberships } from "@/lib/auth/session-db";
import { db } from "@/lib/db/client";
import { fbConnections, orders, storeBranches, storeMembers, waConnections } from "@/lib/db/schema";
import { uiLocaleToDateLocale } from "@/lib/i18n/locales";
import { t } from "@/lib/i18n/messages";

const paidStatuses: Array<"PAID" | "PACKED" | "SHIPPED"> = ["PAID", "PACKED", "SHIPPED"];

const toNumber = (value: unknown) => Number(value ?? 0);

export default async function SettingsSuperadminOverviewPage() {
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

  const [branchRows, memberRows, todaySalesRows, todayOrdersRows, fbRows, waRows] = await Promise.all([
    db
      .select({ storeId: storeBranches.storeId, count: sql<number>`count(*)` })
      .from(storeBranches)
      .where(inArray(storeBranches.storeId, storeIds))
      .groupBy(storeBranches.storeId),
    db
      .select({
        storeId: storeMembers.storeId,
        status: storeMembers.status,
        count: sql<number>`count(*)`,
      })
      .from(storeMembers)
      .where(inArray(storeMembers.storeId, storeIds))
      .groupBy(storeMembers.storeId, storeMembers.status),
    db
      .select({ value: sql<number>`coalesce(sum(${orders.total}), 0)` })
      .from(orders)
      .where(
        and(
          inArray(orders.storeId, storeIds),
          inArray(orders.status, paidStatuses),
          sql`${orders.paidAt} >= datetime('now', 'localtime', 'start of day', 'utc')`,
          sql`${orders.paidAt} < datetime('now', 'localtime', 'start of day', '+1 day', 'utc')`,
        ),
      ),
    db
      .select({ value: sql<number>`count(*)` })
      .from(orders)
      .where(
        and(
          inArray(orders.storeId, storeIds),
          sql`${orders.createdAt} >= datetime('now', 'localtime', 'start of day', 'utc')`,
          sql`${orders.createdAt} < datetime('now', 'localtime', 'start of day', '+1 day', 'utc')`,
        ),
      ),
    db
      .select({ storeId: fbConnections.storeId })
      .from(fbConnections)
      .where(
        and(inArray(fbConnections.storeId, storeIds), eq(fbConnections.status, "CONNECTED")),
      ),
    db
      .select({ storeId: waConnections.storeId })
      .from(waConnections)
      .where(
        and(inArray(waConnections.storeId, storeIds), eq(waConnections.status, "CONNECTED")),
      ),
  ]);

  const branchCountByStore = new Map(branchRows.map((row) => [row.storeId, toNumber(row.count)]));
  const activeMembersByStore = new Map<string, number>();

  for (const row of memberRows) {
    if (row.status !== "ACTIVE") {
      continue;
    }
    activeMembersByStore.set(row.storeId, toNumber(row.count));
  }

  const totalStores = memberships.length;
  const totalBranches = memberships.reduce(
    (sum, membership) => sum + (branchCountByStore.get(membership.storeId) ?? 0),
    0,
  );
  const totalActiveMembers = memberships.reduce(
    (sum, membership) => sum + (activeMembersByStore.get(membership.storeId) ?? 0),
    0,
  );
  const todaySales = toNumber(todaySalesRows[0]?.value);
  const todayOrders = toNumber(todayOrdersRows[0]?.value);
  const connectedFbStoreCount = new Set(fbRows.map((row) => row.storeId)).size;
  const connectedWaStoreCount = new Set(waRows.map((row) => row.storeId)).size;

  const topStoresByMembers = [...memberships]
    .map((membership) => ({
      ...membership,
      activeMembers: activeMembersByStore.get(membership.storeId) ?? 0,
      branchCount: branchCountByStore.get(membership.storeId) ?? 0,
    }))
    .sort((a, b) => b.activeMembers - a.activeMembers)
    .slice(0, 5);

  return (
    <section className="space-y-5">
      <header className="flex items-start justify-between gap-3 px-1">
        <div className="min-w-0 flex-1 space-y-2">
          <p className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            {t(uiLocale, "superadmin.workspaceBadge")}
          </p>
          <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">
            {t(uiLocale, "superadmin.overview.title")}
          </h1>
        </div>
        <div className="shrink-0">
          <SuperadminOverviewHelpButton uiLocale={uiLocale} />
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">{t(uiLocale, "superadmin.overview.card.totalStores")}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{totalStores.toLocaleString(numberLocale)}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">{t(uiLocale, "superadmin.overview.card.totalBranches")}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{totalBranches.toLocaleString(numberLocale)}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">{t(uiLocale, "superadmin.overview.card.activeMembers")}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{totalActiveMembers.toLocaleString(numberLocale)}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">{t(uiLocale, "superadmin.overview.card.todayOrders")}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{todayOrders.toLocaleString(numberLocale)}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">{t(uiLocale, "superadmin.overview.card.todaySales")}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{todaySales.toLocaleString(numberLocale)}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">{t(uiLocale, "superadmin.overview.card.connectedChannels")}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {connectedFbStoreCount.toLocaleString(numberLocale)} / {connectedWaStoreCount.toLocaleString(numberLocale)}
          </p>
        </article>
      </div>

      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <p className="text-sm font-semibold text-slate-900">
            {t(uiLocale, "superadmin.overview.topStores.title")}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {t(uiLocale, "superadmin.overview.topStores.subtitle")}
          </p>
        </div>
        {topStoresByMembers.length === 0 ? (
          <p className="px-4 py-4 text-sm text-slate-500">
            {t(uiLocale, "superadmin.overview.topStores.empty")}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {topStoresByMembers.map((store) => (
              <li key={store.storeId} className="flex min-h-14 items-center gap-3 px-4 py-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                  <Store className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{store.storeName}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {t(uiLocale, "superadmin.overview.topStores.membersPrefix")}{" "}
                    {store.activeMembers.toLocaleString(numberLocale)}{" "}
                    {t(uiLocale, "superadmin.overview.topStores.membersSuffix")} •{" "}
                    {t(uiLocale, "superadmin.overview.topStores.branchesPrefix")}{" "}
                    {store.branchCount.toLocaleString(numberLocale)}{" "}
                    {t(uiLocale, "superadmin.overview.topStores.branchesSuffix")}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </article>

    </section>
  );
}
