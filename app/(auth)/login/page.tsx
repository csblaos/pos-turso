import { redirect } from "next/navigation";

import { LoginForm } from "@/components/app/login-form";
import { getSession } from "@/lib/auth/session";
import { getUserSystemRole } from "@/lib/auth/system-admin";
import { getRequestUiLocale } from "@/lib/i18n/request-locale";
import { t } from "@/lib/i18n/messages";
import { getUserPermissionsForCurrentSession } from "@/lib/rbac/access";
import { getStorefrontEntryRoute } from "@/lib/storefront/routing";

export default async function LoginPage() {
  const uiLocale = await getRequestUiLocale();
  const session = await getSession();
  if (session) {
    const systemRole = await getUserSystemRole(session.userId);
    if (systemRole === "SYSTEM_ADMIN") {
      redirect("/system-admin");
    }

    if (!session.hasStoreMembership || !session.activeStoreId) {
      redirect("/onboarding");
    }

    const permissionKeys = await getUserPermissionsForCurrentSession();
    redirect(getStorefrontEntryRoute(session.activeStoreType, permissionKeys));
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <p className="text-sm font-medium text-blue-600">SaaS POS</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t(uiLocale, "auth.login.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t(uiLocale, "auth.login.description")}
        </p>
      </div>
      <LoginForm />
      <div className="space-y-1 text-center text-sm text-muted-foreground">
        <p>{t(uiLocale, "auth.login.accountProvisioned")}</p>
        <p>{t(uiLocale, "auth.login.contactAdmin")}</p>
      </div>
    </div>
  );
}
