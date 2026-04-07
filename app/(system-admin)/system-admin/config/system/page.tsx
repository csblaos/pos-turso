import { Settings, ShieldCheck } from "lucide-react";

import { SystemConfigAccordion } from "@/components/system-admin/system-config-accordion";
import { getGlobalBranchPolicy } from "@/lib/branches/policy";
import { getSession } from "@/lib/auth/session";
import { DEFAULT_UI_LOCALE } from "@/lib/i18n/locales";
import { t } from "@/lib/i18n/messages";
import { getGlobalSessionPolicy, getGlobalStoreLogoPolicy } from "@/lib/system-config/policy";

export default async function SystemAdminSystemConfigPage() {
  const session = await getSession();
  const uiLocale = session?.uiLocale ?? DEFAULT_UI_LOCALE;
  const [branchPolicy, sessionPolicy, storeLogoPolicy] = await Promise.all([
    getGlobalBranchPolicy(),
    getGlobalSessionPolicy(),
    getGlobalStoreLogoPolicy(),
  ]);

  return (
    <section className="space-y-4">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600">
            <ShieldCheck className="h-3.5 w-3.5" />
            {t(uiLocale, "systemAdmin.workspaceBadge")}
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-700">
            <Settings className="h-3.5 w-3.5" />
            {t(uiLocale, "systemAdmin.systemPage.title")}
          </div>
        </div>
      </header>

      <SystemConfigAccordion
        initialBranchPolicy={branchPolicy}
        initialSessionPolicy={sessionPolicy}
        initialStoreLogoPolicy={storeLogoPolicy}
      />
    </section>
  );
}
