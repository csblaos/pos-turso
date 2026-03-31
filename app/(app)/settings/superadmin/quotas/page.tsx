import { and, eq, inArray, sql } from "drizzle-orm";
import { ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";

import { SuperadminQuotasHelpButton } from "@/components/app/superadmin-quotas-help-button";
import {
  type BranchLimitSource,
  evaluateBranchCreationAccess,
  getGlobalBranchPolicy,
} from "@/lib/branches/policy";
import { getSession } from "@/lib/auth/session";
import { listActiveMemberships } from "@/lib/auth/session-db";
import {
  evaluateStoreCreationAccess,
  getStoreCreationPolicy,
} from "@/lib/auth/store-creation";
import { db } from "@/lib/db/client";
import { storeBranches, storeMembers, stores, users } from "@/lib/db/schema";
import { uiLocaleToDateLocale } from "@/lib/i18n/locales";
import { t, type MessageKey } from "@/lib/i18n/messages";

const toNumber = (value: unknown) => Number(value ?? 0);

const toNonNegativeIntOrNull = (value: unknown) => {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return null;
  }
  return value;
};

const toUsagePercent = (current: number, max: number | null) => {
  if (max === null || max <= 0) {
    return null;
  }
  return Math.min(100, Math.max(0, Math.round((current / max) * 100)));
};

const resolveEffectiveBranchLimit = (params: {
  storeMaxBranchesOverride: number | null;
  superadminMaxBranchesPerStoreOverride: number | null;
  globalDefaultMaxBranchesPerStore: number | null;
}) => {
  if (params.storeMaxBranchesOverride !== null) {
    return {
      effectiveMaxBranchesPerStore: params.storeMaxBranchesOverride,
      effectiveLimitSource: "STORE_OVERRIDE" as const,
    };
  }

  if (params.superadminMaxBranchesPerStoreOverride !== null) {
    return {
      effectiveMaxBranchesPerStore: params.superadminMaxBranchesPerStoreOverride,
      effectiveLimitSource: "SUPERADMIN_OVERRIDE" as const,
    };
  }

  if (params.globalDefaultMaxBranchesPerStore !== null) {
    return {
      effectiveMaxBranchesPerStore: params.globalDefaultMaxBranchesPerStore,
      effectiveLimitSource: "GLOBAL_DEFAULT" as const,
    };
  }

  return {
    effectiveMaxBranchesPerStore: null,
    effectiveLimitSource: "UNLIMITED" as const,
  };
};

const limitSourceLabelKey: Record<BranchLimitSource, MessageKey> = {
  STORE_OVERRIDE: "superadmin.quotas.row.limitSource.STORE_OVERRIDE",
  SUPERADMIN_OVERRIDE: "superadmin.quotas.row.limitSource.SUPERADMIN_OVERRIDE",
  GLOBAL_DEFAULT: "superadmin.quotas.row.limitSource.GLOBAL_DEFAULT",
  UNLIMITED: "superadmin.quotas.row.limitSource.UNLIMITED",
};

export default async function SettingsSuperadminQuotasPage() {
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

  const [storePolicy, globalBranchPolicy, activeMemberRows, branchCountRows, storeRows, userRows] =
    await Promise.all([
      getStoreCreationPolicy(session.userId),
      getGlobalBranchPolicy(),
      db
        .select({
          storeId: storeMembers.storeId,
          count: sql<number>`count(*)`,
        })
        .from(storeMembers)
        .where(and(inArray(storeMembers.storeId, storeIds), eq(storeMembers.status, "ACTIVE")))
        .groupBy(storeMembers.storeId),
      db
        .select({
          storeId: storeBranches.storeId,
          count: sql<number>`count(*)`,
        })
        .from(storeBranches)
        .where(inArray(storeBranches.storeId, storeIds))
        .groupBy(storeBranches.storeId),
      db
        .select({
          id: stores.id,
          maxBranchesOverride: stores.maxBranchesOverride,
        })
        .from(stores)
        .where(inArray(stores.id, storeIds)),
      db
        .select({
          systemRole: users.systemRole,
          canCreateBranches: users.canCreateBranches,
          maxBranchesPerStore: users.maxBranchesPerStore,
        })
        .from(users)
        .where(eq(users.id, session.userId))
        .limit(1),
    ]);

  const storeAccess = evaluateStoreCreationAccess(storePolicy);
  const activeMembersByStore = new Map(
    activeMemberRows.map((row) => [row.storeId, toNumber(row.count)]),
  );
  const branchCountByStore = new Map(branchCountRows.map((row) => [row.storeId, toNumber(row.count)]));
  const storeMaxBranchesOverrideByStore = new Map(
    storeRows.map((row) => [row.id, toNonNegativeIntOrNull(row.maxBranchesOverride)]),
  );
  const existingStoreIds = new Set(storeRows.map((row) => row.id));
  const userRow = userRows[0];
  const isSuperadmin = (userRow?.systemRole ?? storePolicy.systemRole) === "SUPERADMIN";
  const superadminCanCreateBranchesOverride =
    typeof userRow?.canCreateBranches === "boolean" ? userRow.canCreateBranches : null;
  const superadminMaxBranchesPerStoreOverride = toNonNegativeIntOrNull(
    userRow?.maxBranchesPerStore,
  );

  const branchPolicies = memberships.map((membership) => {
    const storeExists = existingStoreIds.has(membership.storeId);
    const storeMaxBranchesOverride = storeMaxBranchesOverrideByStore.get(membership.storeId) ?? null;
    const currentBranchCount = branchCountByStore.get(membership.storeId) ?? 0;
    const effectiveCanCreateBranches =
      superadminCanCreateBranchesOverride ?? globalBranchPolicy.defaultCanCreateBranches;
    const { effectiveMaxBranchesPerStore, effectiveLimitSource } = resolveEffectiveBranchLimit({
      storeMaxBranchesOverride,
      superadminMaxBranchesPerStoreOverride,
      globalDefaultMaxBranchesPerStore: globalBranchPolicy.defaultMaxBranchesPerStore,
    });

    const policy = {
      storeExists,
      isSuperadmin,
      isStoreOwner: membership.roleName === "Owner",
      currentBranchCount,
      globalDefaultCanCreateBranches: globalBranchPolicy.defaultCanCreateBranches,
      globalDefaultMaxBranchesPerStore: globalBranchPolicy.defaultMaxBranchesPerStore,
      superadminCanCreateBranchesOverride,
      superadminMaxBranchesPerStoreOverride,
      storeMaxBranchesOverride,
      effectiveCanCreateBranches,
      effectiveMaxBranchesPerStore,
      effectiveLimitSource,
    };

    return {
      membership,
      policy,
      access: evaluateBranchCreationAccess(policy),
    };
  });

  const storesCanCreateBranchCount = branchPolicies.filter((item) => item.access.allowed).length;
  const storesNearBranchLimitCount = branchPolicies.filter((item) => {
    const usagePercent = toUsagePercent(
      item.policy.currentBranchCount,
      item.policy.effectiveMaxBranchesPerStore,
    );
    return usagePercent !== null && usagePercent >= 80;
  }).length;
  const storesBlockedCount = branchPolicies.filter((item) => !item.access.allowed).length;

  return (
    <section className="space-y-5">
      <header className="flex items-start justify-between gap-3 px-1">
        <div className="min-w-0 flex-1 space-y-2">
          <p className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            {t(uiLocale, "superadmin.workspaceBadge")}
          </p>
          <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">
            {t(uiLocale, "superadmin.quotas.title")}
          </h1>
        </div>
        <div className="shrink-0">
          <SuperadminQuotasHelpButton uiLocale={uiLocale} />
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">{t(uiLocale, "superadmin.quotas.card.storeQuota")}</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {typeof storePolicy.maxStores === "number"
              ? `${storePolicy.activeOwnerStoreCount.toLocaleString(numberLocale)} / ${storePolicy.maxStores.toLocaleString(numberLocale)} ${t(uiLocale, "superadmin.quotas.card.storeLimitedSuffix")}`
              : `${t(uiLocale, "superadmin.quotas.card.storeUnlimitedPrefix")} ${storePolicy.activeOwnerStoreCount.toLocaleString(numberLocale)} ${t(uiLocale, "superadmin.quotas.card.storeUnlimitedSuffix")}`}
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">
            {t(uiLocale, "superadmin.quotas.card.storeCreationAccess")}
          </p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {storeAccess.allowed
              ? t(uiLocale, "superadmin.quotas.card.accessAllowed")
              : t(uiLocale, "superadmin.quotas.card.accessBlocked")}
          </p>
          {!storeAccess.allowed && storeAccess.reason ? (
            <p className="mt-1 text-xs text-red-600">{storeAccess.reason}</p>
          ) : null}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">
            {t(uiLocale, "superadmin.quotas.card.branchEligibleStores")}
          </p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {storesCanCreateBranchCount.toLocaleString(numberLocale)} /{" "}
            {memberships.length.toLocaleString(numberLocale)}{" "}
            {t(uiLocale, "superadmin.quotas.card.storesSuffix")}
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">
            {t(uiLocale, "superadmin.quotas.card.nearLimitStores")}
          </p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {storesNearBranchLimitCount.toLocaleString(numberLocale)}{" "}
            {t(uiLocale, "superadmin.quotas.card.storesSuffix")}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {t(uiLocale, "superadmin.quotas.card.blockedStoresPrefix")}{" "}
            {storesBlockedCount.toLocaleString(numberLocale)}{" "}
            {t(uiLocale, "superadmin.quotas.card.storesSuffix")}
          </p>
        </article>
      </div>

      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <p className="text-sm font-semibold text-slate-900">
            {t(uiLocale, "superadmin.quotas.section.branchPolicies.title")}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {t(uiLocale, "superadmin.quotas.section.branchPolicies.subtitle")}
          </p>
        </div>

        <ul className="divide-y divide-slate-100">
          {branchPolicies.map((item) => {
            const activeMembers = activeMembersByStore.get(item.membership.storeId) ?? 0;
            const usagePercent = toUsagePercent(
              item.policy.currentBranchCount,
              item.policy.effectiveMaxBranchesPerStore,
            );
            const summaryText =
              item.policy.effectiveMaxBranchesPerStore === null
                ? `${t(uiLocale, "superadmin.quotas.row.unlimited")} (${t(uiLocale, limitSourceLabelKey[item.policy.effectiveLimitSource])})`
                : `${item.policy.currentBranchCount.toLocaleString(numberLocale)} / ${item.policy.effectiveMaxBranchesPerStore.toLocaleString(numberLocale)} ${t(uiLocale, "superadmin.quotas.row.branchUnit")} (${t(uiLocale, limitSourceLabelKey[item.policy.effectiveLimitSource])})`;

            return (
              <li key={item.membership.storeId} className="space-y-2 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {item.membership.storeName}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {t(uiLocale, "superadmin.quotas.row.rolePrefix")} {item.membership.roleName} •{" "}
                      {t(uiLocale, "superadmin.quotas.row.activeMembersPrefix")}{" "}
                      {activeMembers.toLocaleString(numberLocale)}{" "}
                      {t(uiLocale, "superadmin.quotas.row.activeMembersSuffix")}
                    </p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                      item.access.allowed
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-red-200 bg-red-50 text-red-700"
                    }`}
                  >
                    {item.access.allowed
                      ? t(uiLocale, "superadmin.quotas.row.allowed")
                      : t(uiLocale, "superadmin.quotas.row.blocked")}
                  </span>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs font-medium text-slate-700">{summaryText}</p>
                  {usagePercent !== null ? (
                    <div className="mt-2">
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className={`h-full rounded-full ${
                            usagePercent >= 100
                              ? "bg-red-500"
                              : usagePercent >= 80
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                          }`}
                          style={{ width: `${usagePercent}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {t(uiLocale, "superadmin.quotas.row.usagePrefix")}{" "}
                        {usagePercent.toLocaleString(numberLocale)}
                        {t(uiLocale, "superadmin.quotas.row.usageSuffix")}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-1 text-[11px] text-slate-500">
                      {t(uiLocale, "superadmin.quotas.row.unlimitedHint")}
                    </p>
                  )}
                  {!item.access.allowed && item.access.reason ? (
                    <p className="mt-1 text-xs text-red-600">{item.access.reason}</p>
                  ) : (
                    <p className="mt-1 text-xs text-slate-500">
                      {t(uiLocale, "superadmin.quotas.row.limitSourcePrefix")}{" "}
                      {t(uiLocale, limitSourceLabelKey[item.policy.effectiveLimitSource])} •{" "}
                      {t(uiLocale, "superadmin.quotas.row.currentBranchesPrefix")}{" "}
                      {item.policy.currentBranchCount.toLocaleString(numberLocale)}{" "}
                      {t(uiLocale, "superadmin.quotas.row.currentBranchesSuffix")}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </article>

    </section>
  );
}
