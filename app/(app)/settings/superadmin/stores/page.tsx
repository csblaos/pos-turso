import {
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import { and, eq, inArray, sql } from "drizzle-orm";
import { redirect } from "next/navigation";

import { SuperadminGovernanceHelpButton } from "@/components/app/superadmin-governance-help-button";
import { getSession } from "@/lib/auth/session";
import { listActiveMemberships } from "@/lib/auth/session-db";
import { db } from "@/lib/db/client";
import { fbConnections, storeBranches, storeMembers, stores, waConnections } from "@/lib/db/schema";
import { uiLocaleToDateLocale } from "@/lib/i18n/locales";
import { t, type MessageKey } from "@/lib/i18n/messages";

const toNumber = (value: unknown) => Number(value ?? 0);

const storeTypeLabelKeyMap = {
  ONLINE_RETAIL: "onboarding.storeType.online.title",
  RESTAURANT: "onboarding.storeType.restaurant.title",
  CAFE: "onboarding.storeType.cafe.title",
  OTHER: "onboarding.storeType.other.title",
} as const satisfies Record<string, MessageKey>;

export default async function SettingsSuperadminStoresPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  const uiLocale = session.uiLocale;

  const memberships = await listActiveMemberships(session.userId);
  if (memberships.length === 0) {
    redirect("/onboarding");
  }

  const storeIds = memberships.map((membership) => membership.storeId);

  const [storeRows, branchRows, memberRows, fbErrorRows, waErrorRows] = await Promise.all([
    db
      .select({
        id: stores.id,
        name: stores.name,
        storeType: stores.storeType,
      })
      .from(stores)
      .where(inArray(stores.id, storeIds)),
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
      .select({ storeId: fbConnections.storeId })
      .from(fbConnections)
      .where(
        and(inArray(fbConnections.storeId, storeIds), eq(fbConnections.status, "ERROR")),
      ),
    db
      .select({ storeId: waConnections.storeId })
      .from(waConnections)
      .where(
        and(inArray(waConnections.storeId, storeIds), eq(waConnections.status, "ERROR")),
      ),
  ]);

  const branchCountByStore = new Map(branchRows.map((row) => [row.storeId, toNumber(row.count)]));
  const memberSummaryByStore = new Map<
    string,
    { active: number; invited: number; suspended: number }
  >();

  for (const row of memberRows) {
    const summary = memberSummaryByStore.get(row.storeId) ?? {
      active: 0,
      invited: 0,
      suspended: 0,
    };
    const count = toNumber(row.count);
    if (row.status === "ACTIVE") {
      summary.active = count;
    } else if (row.status === "INVITED") {
      summary.invited = count;
    } else if (row.status === "SUSPENDED") {
      summary.suspended = count;
    }
    memberSummaryByStore.set(row.storeId, summary);
  }

  const channelErrorStoreIds = new Set([
    ...fbErrorRows.map((row) => row.storeId),
    ...waErrorRows.map((row) => row.storeId),
  ]);

  const numberLocale = uiLocaleToDateLocale(uiLocale);
  const collator = new Intl.Collator(numberLocale, { sensitivity: "base" });

  const governanceRows = storeRows
    .map((store) => {
      const branchCount = branchCountByStore.get(store.id) ?? 0;
      const memberSummary = memberSummaryByStore.get(store.id) ?? {
        active: 0,
        invited: 0,
        suspended: 0,
      };
      const hasChannelError = channelErrorStoreIds.has(store.id);
      const needsAttention =
        branchCount === 0 ||
        memberSummary.active === 0 ||
        memberSummary.suspended > 0 ||
        hasChannelError;
      return {
        ...store,
        branchCount,
        ...memberSummary,
        hasChannelError,
        needsAttention,
      };
    })
    .sort((a, b) => {
      const byAttention = Number(b.needsAttention) - Number(a.needsAttention);
      if (byAttention !== 0) {
        return byAttention;
      }
      return collator.compare(a.name, b.name);
    });

  const totalBranches = governanceRows.reduce((sum, row) => sum + row.branchCount, 0);
  const totalActiveMembers = governanceRows.reduce((sum, row) => sum + row.active, 0);
  const storesNeedAttention = governanceRows.filter((row) => row.needsAttention).length;

  return (
    <section className="space-y-5">
      <header className="flex items-start justify-between gap-3 px-1">
        <div className="min-w-0 flex-1 space-y-2">
          <p className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            {t(uiLocale, "superadmin.workspaceBadge")}
          </p>
          <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">
            {t(uiLocale, "superadmin.governance.title")}
          </h1>
        </div>
        <div className="shrink-0">
          <SuperadminGovernanceHelpButton uiLocale={uiLocale} />
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">{t(uiLocale, "superadmin.governance.metric.totalStores")}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {governanceRows.length.toLocaleString(numberLocale)}
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">{t(uiLocale, "superadmin.governance.metric.totalBranches")}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {totalBranches.toLocaleString(numberLocale)}
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">{t(uiLocale, "superadmin.governance.metric.activeMembers")}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {totalActiveMembers.toLocaleString(numberLocale)}
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">{t(uiLocale, "superadmin.governance.metric.needsAttentionStores")}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {storesNeedAttention.toLocaleString(numberLocale)}
          </p>
        </article>
      </div>

      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <p className="text-sm font-semibold text-slate-900">
            {t(uiLocale, "superadmin.governance.board.title")}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {t(uiLocale, "superadmin.governance.board.subtitle")}
          </p>
        </div>
        {governanceRows.length === 0 ? (
          <p className="px-4 py-4 text-sm text-slate-500">{t(uiLocale, "superadmin.governance.empty")}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {governanceRows.map((row) => (
              <li key={row.id} className="space-y-2 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{row.name}</p>
                    <p className="truncate text-xs text-slate-500">
                      {t(uiLocale, storeTypeLabelKeyMap[row.storeType])} •{" "}
                      {t(uiLocale, "superadmin.governance.row.branchesLabel")}{" "}
                      {row.branchCount.toLocaleString(numberLocale)} •{" "}
                      {t(uiLocale, "superadmin.governance.row.activeLabel")}{" "}
                      {row.active.toLocaleString(numberLocale)} •{" "}
                      {t(uiLocale, "superadmin.governance.row.invitedLabel")}{" "}
                      {row.invited.toLocaleString(numberLocale)} •{" "}
                      {t(uiLocale, "superadmin.governance.row.suspendedLabel")}{" "}
                      {row.suspended.toLocaleString(numberLocale)}
                    </p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                      row.needsAttention
                        ? "border-amber-200 bg-amber-50 text-amber-700"
                        : "border-emerald-200 bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {row.needsAttention
                      ? t(uiLocale, "superadmin.governance.badge.needsAttention")
                      : t(uiLocale, "superadmin.governance.badge.ok")}
                  </span>
                </div>

                {row.needsAttention ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    <p className="inline-flex items-center gap-1 font-medium">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {t(uiLocale, "superadmin.governance.issues.title")}
                    </p>
                    <p className="mt-1">
                      {row.branchCount === 0 ? `${t(uiLocale, "superadmin.governance.issues.noBranches")} • ` : ""}
                      {row.active === 0 ? `${t(uiLocale, "superadmin.governance.issues.noActiveMembers")} • ` : ""}
                      {row.suspended > 0
                        ? `${t(uiLocale, "superadmin.governance.issues.suspendedMembers.prefix")} ${row.suspended.toLocaleString(numberLocale)} ${t(uiLocale, "superadmin.governance.issues.suspendedMembers.suffix")} • `
                        : ""}
                      {row.hasChannelError ? t(uiLocale, "superadmin.governance.issues.channelError") : ""}
                    </p>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </article>

    </section>
  );
}
