import { SystemBranchPolicyConfig } from "@/components/system-admin/system-branch-policy-config";
import { SystemSessionPolicyConfig } from "@/components/system-admin/system-session-policy-config";
import { SystemStoreLogoPolicyConfig } from "@/components/system-admin/system-store-logo-policy-config";
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
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">{t(uiLocale, "systemAdmin.systemPage.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t(uiLocale, "systemAdmin.systemPage.subtitle")}
        </p>
      </header>

      <SystemBranchPolicyConfig initialConfig={branchPolicy} />
      <SystemSessionPolicyConfig initialConfig={sessionPolicy} />
      <SystemStoreLogoPolicyConfig initialConfig={storeLogoPolicy} />
    </section>
  );
}
