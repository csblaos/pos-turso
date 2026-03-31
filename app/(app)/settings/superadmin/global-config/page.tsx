import { and, eq, inArray, isNotNull, or, sql } from "drizzle-orm";
import { ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";

import { SuperadminGlobalConfigHelpButton } from "@/components/app/superadmin-global-config-help-button";
import { SuperadminPaymentPolicyConfig } from "@/components/app/superadmin-payment-policy-config";
import { getSession } from "@/lib/auth/session";
import { listActiveMemberships } from "@/lib/auth/session-db";
import { getGlobalBranchPolicy } from "@/lib/branches/policy";
import { db } from "@/lib/db/client";
import { storeMembers, stores, users } from "@/lib/db/schema";
import {
  getGlobalPaymentPolicy,
  getGlobalSessionPolicy,
  getGlobalStoreLogoPolicy,
} from "@/lib/system-config/policy";
import { uiLocaleToDateLocale } from "@/lib/i18n/locales";
import { t } from "@/lib/i18n/messages";

export default async function SettingsSuperadminGlobalConfigPage() {
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

  const [
    globalBranchPolicy,
    globalSessionPolicy,
    globalPaymentPolicy,
    globalStoreLogoPolicy,
    storeOverrideCountRows,
    superadminOverrideCountRows,
    storeOverrideRows,
    superadminOverrideRows,
  ] = await Promise.all([
    getGlobalBranchPolicy(),
    getGlobalSessionPolicy(),
    getGlobalPaymentPolicy(),
    getGlobalStoreLogoPolicy(),
    db
      .select({ value: sql<number>`count(*)` })
      .from(stores)
      .where(and(inArray(stores.id, storeIds), isNotNull(stores.maxBranchesOverride))),
    db
      .select({ value: sql<number>`count(distinct ${users.id})` })
      .from(storeMembers)
      .innerJoin(users, eq(storeMembers.userId, users.id))
      .where(
        and(
          inArray(storeMembers.storeId, storeIds),
          eq(users.systemRole, "SUPERADMIN"),
          or(
            isNotNull(users.canCreateBranches),
            isNotNull(users.maxBranchesPerStore),
            isNotNull(users.sessionLimit),
          ),
        ),
      ),
    db
      .select({
        id: stores.id,
        name: stores.name,
        maxBranchesOverride: stores.maxBranchesOverride,
      })
      .from(stores)
      .where(and(inArray(stores.id, storeIds), isNotNull(stores.maxBranchesOverride)))
      .orderBy(stores.name)
      .limit(30),
    db
      .select({
        userId: users.id,
        name: users.name,
        email: users.email,
        canCreateBranches: users.canCreateBranches,
        maxBranchesPerStore: users.maxBranchesPerStore,
        sessionLimit: users.sessionLimit,
      })
      .from(storeMembers)
      .innerJoin(users, eq(storeMembers.userId, users.id))
      .where(
        and(
          inArray(storeMembers.storeId, storeIds),
          eq(users.systemRole, "SUPERADMIN"),
          or(
            isNotNull(users.canCreateBranches),
            isNotNull(users.maxBranchesPerStore),
            isNotNull(users.sessionLimit),
          ),
        ),
      )
      .groupBy(
        users.id,
        users.name,
        users.email,
        users.canCreateBranches,
        users.maxBranchesPerStore,
        users.sessionLimit,
      )
      .orderBy(users.name)
      .limit(50),
  ]);
  const storeOverrideCount = Number(storeOverrideCountRows[0]?.value ?? 0);
  const superadminOverrideCount = Number(superadminOverrideCountRows[0]?.value ?? 0);
  const branchDefaultLabel = globalBranchPolicy.defaultCanCreateBranches
    ? t(uiLocale, "superadmin.globalConfig.branchDefault.allowed")
    : t(uiLocale, "superadmin.globalConfig.branchDefault.blocked");
  const branchDefaultQuota =
    globalBranchPolicy.defaultMaxBranchesPerStore === null
      ? t(uiLocale, "superadmin.globalConfig.branchDefault.unlimited")
      : `${t(uiLocale, "superadmin.globalConfig.branchDefault.maxPrefix")} ${globalBranchPolicy.defaultMaxBranchesPerStore.toLocaleString(numberLocale)} ${t(uiLocale, "superadmin.globalConfig.branchDefault.maxSuffix")}`;
  const sessionLimitText = `${globalSessionPolicy.defaultSessionLimit.toLocaleString(numberLocale)} ${t(uiLocale, "superadmin.globalConfig.systemDefaults.sessionLimit.suffix")}`;
  const branchCreationText = globalBranchPolicy.defaultCanCreateBranches
    ? t(uiLocale, "superadmin.globalConfig.systemDefaults.branchCreation.allowed")
    : t(uiLocale, "superadmin.globalConfig.systemDefaults.branchCreation.blocked");
  const branchQuotaText =
    globalBranchPolicy.defaultMaxBranchesPerStore === null
      ? t(uiLocale, "superadmin.globalConfig.systemDefaults.branchQuota.unlimited")
      : `${globalBranchPolicy.defaultMaxBranchesPerStore.toLocaleString(numberLocale)} ${t(uiLocale, "superadmin.globalConfig.systemDefaults.branchQuota.suffix")}`;
  const paymentPolicyText = `${t(uiLocale, "superadmin.globalConfig.systemDefaults.paymentPolicy.maxAccountsPrefix")} ${globalPaymentPolicy.maxAccountsPerStore.toLocaleString(numberLocale)} ${t(uiLocale, "superadmin.globalConfig.systemDefaults.paymentPolicy.maxAccountsSuffix")}`;
  const logoUploadText = `${globalStoreLogoPolicy.maxSizeMb.toLocaleString(numberLocale)} MB · ${t(uiLocale, "superadmin.globalConfig.systemDefaults.logoUpload.resizeLabel")} ${globalStoreLogoPolicy.autoResize ? t(uiLocale, "superadmin.globalConfig.systemDefaults.logoUpload.enabled") : t(uiLocale, "superadmin.globalConfig.systemDefaults.logoUpload.disabled")} · ${globalStoreLogoPolicy.resizeMaxWidth.toLocaleString(numberLocale)} px`;

  return (
    <section className="space-y-5">
      <header className="flex items-start justify-between gap-3 px-1">
        <div className="min-w-0 flex-1 space-y-2">
          <p className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            {t(uiLocale, "superadmin.workspaceBadge")}
          </p>
          <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">
            {t(uiLocale, "superadmin.globalConfig.title")}
          </h1>
        </div>
        <div className="shrink-0">
          <SuperadminGlobalConfigHelpButton uiLocale={uiLocale} />
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">{t(uiLocale, "superadmin.globalConfig.card.sessionDefault")}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {globalSessionPolicy.defaultSessionLimit.toLocaleString(numberLocale)}
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">{t(uiLocale, "superadmin.globalConfig.card.branchDefault")}</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{branchDefaultLabel}</p>
          <p className="mt-1 text-xs text-slate-500">{branchDefaultQuota}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">
            {t(uiLocale, "superadmin.globalConfig.card.storeBranchOverride")}
          </p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {storeOverrideCount.toLocaleString(numberLocale)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {t(uiLocale, "superadmin.globalConfig.card.storeBranchOverrideDescription")}
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">
            {t(uiLocale, "superadmin.globalConfig.card.superadminOverride")}
          </p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {superadminOverrideCount.toLocaleString(numberLocale)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {t(uiLocale, "superadmin.globalConfig.card.superadminOverrideDescription")}
          </p>
        </article>
      </div>

      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <p className="text-sm font-semibold text-slate-900">
            {t(uiLocale, "superadmin.globalConfig.systemDefaults.title")}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {t(uiLocale, "superadmin.globalConfig.systemDefaults.subtitle")}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="text-xs text-slate-500">
              {t(uiLocale, "superadmin.globalConfig.systemDefaults.sessionLimit.label")}
            </p>
            <p className="mt-1 text-sm font-medium text-slate-900">{sessionLimitText}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="text-xs text-slate-500">
              {t(uiLocale, "superadmin.globalConfig.systemDefaults.branchCreation.label")}
            </p>
            <p className="mt-1 text-sm font-medium text-slate-900">{branchCreationText}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="text-xs text-slate-500">
              {t(uiLocale, "superadmin.globalConfig.systemDefaults.branchQuota.label")}
            </p>
            <p className="mt-1 text-sm font-medium text-slate-900">{branchQuotaText}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="text-xs text-slate-500">
              {t(uiLocale, "superadmin.globalConfig.systemDefaults.paymentPolicy.label")}
            </p>
            <p className="mt-1 text-sm font-medium text-slate-900">{paymentPolicyText}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 sm:col-span-2">
            <p className="text-xs text-slate-500">
              {t(uiLocale, "superadmin.globalConfig.systemDefaults.logoUpload.label")}
            </p>
            <p className="mt-1 text-sm font-medium text-slate-900">{logoUploadText}</p>
          </div>
        </div>
      </article>

      <SuperadminPaymentPolicyConfig initialConfig={globalPaymentPolicy} />

      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <p className="text-sm font-semibold text-slate-900">
            {t(uiLocale, "superadmin.globalConfig.overrides.title")}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {t(uiLocale, "superadmin.globalConfig.overrides.subtitle")}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 p-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              {t(uiLocale, "superadmin.globalConfig.overrides.store.title")}
            </p>
            {storeOverrideRows.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">
                {t(uiLocale, "superadmin.globalConfig.overrides.store.empty")}
              </p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {storeOverrideRows.map((store) => (
                  <li key={store.id} className="text-xs text-slate-700">
                    {store.name} • {t(uiLocale, "superadmin.globalConfig.overrides.store.maxBranchesPrefix")}{" "}
                    {store.maxBranchesOverride?.toLocaleString(numberLocale)}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              {t(uiLocale, "superadmin.globalConfig.overrides.superadmin.title")}
            </p>
            {superadminOverrideRows.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">
                {t(uiLocale, "superadmin.globalConfig.overrides.superadmin.empty")}
              </p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {superadminOverrideRows.map((user) => (
                  <li key={user.userId} className="text-xs text-slate-700">
                    {user.name} • {t(uiLocale, "superadmin.globalConfig.overrides.superadmin.branchPrefix")}{" "}
                    {user.maxBranchesPerStore === null
                      ? t(uiLocale, "superadmin.globalConfig.overrides.superadmin.default")
                      : user.maxBranchesPerStore.toLocaleString(numberLocale)}{" "}
                    • {t(uiLocale, "superadmin.globalConfig.overrides.superadmin.sessionPrefix")}{" "}
                    {user.sessionLimit === null
                      ? t(uiLocale, "superadmin.globalConfig.overrides.superadmin.default")
                      : user.sessionLimit.toLocaleString(numberLocale)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </article>

    </section>
  );
}
