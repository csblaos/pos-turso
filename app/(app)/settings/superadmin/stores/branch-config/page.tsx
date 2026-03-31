import { ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";

import { SuperadminBranchConfigHelpButton } from "@/components/app/superadmin-branch-config-help-button";
import { StoresManagement } from "@/components/app/stores-management";
import { getSession } from "@/lib/auth/session";
import { listActiveMemberships } from "@/lib/auth/session-db";
import { t } from "@/lib/i18n/messages";

export default async function SettingsSuperadminBranchConfigPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const memberships = await listActiveMemberships(session.userId);
  if (memberships.length === 0) {
    redirect("/onboarding");
  }

  const activeStoreId = session.activeStoreId ?? memberships[0].storeId;
  const uiLocale = session.uiLocale;

  return (
    <section className="space-y-2">
      <header className="flex items-start justify-between gap-3 px-1">
        <div className="min-w-0 flex-1 space-y-2">
          <p className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            {t(uiLocale, "superadmin.workspaceBadge")}
          </p>
          <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">
            {t(uiLocale, "superadmin.branchConfig.title")}
          </h1>
        </div>
        <div className="shrink-0">
          <SuperadminBranchConfigHelpButton uiLocale={uiLocale} />
        </div>
      </header>

      <StoresManagement
        memberships={memberships}
        activeStoreId={activeStoreId}
        activeBranchId={session.activeBranchId}
        uiLocale={uiLocale}
        isSuperadmin
        canCreateStore={false}
        createStoreBlockedReason={null}
        storeQuotaSummary={null}
        mode="branch-config"
      />

    </section>
  );
}
