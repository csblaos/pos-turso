import { ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";

import { SuperadminStoreConfigHelpButton } from "@/components/app/superadmin-store-config-help-button";
import { StoresManagement } from "@/components/app/stores-management";
import { getSession } from "@/lib/auth/session";
import { listActiveMemberships } from "@/lib/auth/session-db";
import {
  evaluateStoreCreationAccess,
  getStoreCreationPolicy,
  type StoreCreationPolicy,
} from "@/lib/auth/store-creation";
import { uiLocaleToDateLocale, type UiLocale } from "@/lib/i18n/locales";
import { t } from "@/lib/i18n/messages";

function getCreateStoreBlockedReason(
  uiLocale: UiLocale,
  numberLocale: string,
  policy: StoreCreationPolicy,
) {
  if (policy.systemRole !== "SUPERADMIN") {
    return t(uiLocale, "superadmin.storeConfig.blocked.superadminOnly");
  }

  if (policy.canCreateStores !== true) {
    return t(uiLocale, "superadmin.storeConfig.blocked.permissionMissing");
  }

  if (
    typeof policy.maxStores === "number" &&
    policy.maxStores > 0 &&
    policy.activeOwnerStoreCount >= policy.maxStores
  ) {
    return `${t(uiLocale, "superadmin.storeConfig.blocked.quotaReachedPrefix")} ${policy.maxStores.toLocaleString(numberLocale)} ${t(uiLocale, "superadmin.storeConfig.blocked.quotaReachedSuffix")}`;
  }

  return null;
}

export default async function SettingsSuperadminStoreConfigPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const memberships = await listActiveMemberships(session.userId);
  if (memberships.length === 0) {
    redirect("/onboarding");
  }

  const uiLocale = session.uiLocale;
  const numberLocale = uiLocaleToDateLocale(uiLocale);
  const policy = await getStoreCreationPolicy(session.userId);
  const access = evaluateStoreCreationAccess(policy);
  const canCreateStore = access.allowed;
  const createStoreBlockedReason = getCreateStoreBlockedReason(uiLocale, numberLocale, policy);
  const storeQuotaSummary =
    typeof policy.maxStores === "number"
      ? `${t(uiLocale, "superadmin.storeConfig.quota.limitedPrefix")} ${policy.activeOwnerStoreCount.toLocaleString(numberLocale)} / ${policy.maxStores.toLocaleString(numberLocale)} ${t(uiLocale, "superadmin.storeConfig.quota.limitedSuffix")}`
      : `${t(uiLocale, "superadmin.storeConfig.quota.unlimitedPrefix")} ${policy.activeOwnerStoreCount.toLocaleString(numberLocale)} ${t(uiLocale, "superadmin.storeConfig.quota.unlimitedSuffix")}`;

  const activeStoreId = session.activeStoreId ?? memberships[0].storeId;

  return (
    <section className="space-y-2">
      <header className="flex items-start justify-between gap-3 px-1">
        <div className="min-w-0 flex-1 space-y-2">
          <p className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            {t(uiLocale, "superadmin.workspaceBadge")}
          </p>
          <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">
            {t(uiLocale, "superadmin.storeConfig.title")}
          </h1>
        </div>
        <div className="shrink-0">
          <SuperadminStoreConfigHelpButton uiLocale={uiLocale} />
        </div>
      </header>

      <StoresManagement
        memberships={memberships}
        activeStoreId={activeStoreId}
        activeBranchId={session.activeBranchId}
        uiLocale={uiLocale}
        isSuperadmin
        canCreateStore={canCreateStore}
        createStoreBlockedReason={createStoreBlockedReason}
        storeQuotaSummary={storeQuotaSummary}
        mode="store-config"
      />

    </section>
  );
}
