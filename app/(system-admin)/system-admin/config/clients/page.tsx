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
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">{t(uiLocale, "systemAdmin.clientsPage.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t(uiLocale, "systemAdmin.clientsPage.subtitle")}
        </p>
      </header>

      <SuperadminManagement
        superadmins={superadmins}
        globalBranchDefaults={globalBranchDefaults}
      />
    </section>
  );
}
