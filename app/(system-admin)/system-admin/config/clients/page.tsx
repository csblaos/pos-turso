import { ShieldCheck } from "lucide-react";

import { SuperadminManagement } from "@/components/system-admin/superadmin-management";
import { getGlobalBranchPolicy } from "@/lib/branches/policy";
import { getSession } from "@/lib/auth/session";
import { DEFAULT_UI_LOCALE } from "@/lib/i18n/locales";
import { t } from "@/lib/i18n/messages";
import { listSuperadmins } from "@/lib/system-admin/superadmins";

export const dynamic = "force-dynamic";

export default async function SystemAdminClientsConfigPage() {
  const session = await getSession();
  const uiLocale = session?.uiLocale ?? DEFAULT_UI_LOCALE;
  const [superadmins, globalBranchDefaults] = await Promise.all([
    listSuperadmins(),
    getGlobalBranchPolicy(),
  ]);

  return (
    <section className="space-y-4">
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600">
          <ShieldCheck className="h-3.5 w-3.5" />
          {t(uiLocale, "systemAdmin.workspaceBadge")}
        </div>
      </header>

      <SuperadminManagement
        superadmins={superadmins}
        globalBranchDefaults={globalBranchDefaults}
      />
    </section>
  );
}
