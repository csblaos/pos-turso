import Link from "next/link";
import { ChevronRight, Globe } from "lucide-react";
import { redirect } from "next/navigation";

import { AccountLanguageHelpButton } from "@/components/app/account-language-help-button";
import { AccountLanguageSettings } from "@/components/app/account-language-settings";
import { getSession } from "@/lib/auth/session";
import { t } from "@/lib/i18n/messages";
import { getUserPermissionsForCurrentSession, isPermissionGranted } from "@/lib/rbac/access";

export default async function SettingsLanguagePage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  if (!session.activeStoreId) {
    redirect("/onboarding");
  }

  const permissionKeys = await getUserPermissionsForCurrentSession();
  const canViewSettings = isPermissionGranted(permissionKeys, "settings.view");

  if (!canViewSettings) {
    return (
      <section className="space-y-3">
        <h1 className="text-xl font-semibold">{t(session.uiLocale, "settings.language.title")}</h1>
        <p className="text-sm text-red-600">{t(session.uiLocale, "common.permissionDenied.viewPage")}</p>
        <Link href="/settings" className="text-sm font-medium text-blue-700 hover:underline">
          {t(session.uiLocale, "common.backToSettings")}
        </Link>
      </section>
    );
  }

  const uiLocale = session.uiLocale;

  return (
    <section className="space-y-2">
      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">{t(uiLocale, "settings.language.title")}</p>
            <p className="mt-0.5 text-xs text-slate-500">{t(uiLocale, "settings.language.description")}</p>
          </div>
          <AccountLanguageHelpButton uiLocale={uiLocale} />
        </div>
        <AccountLanguageSettings locale={uiLocale} initialUiLocale={uiLocale} embedded />
      </article>

      <div className="space-y-2">
        <p className="px-1 text-[11px] font-semibold uppercase text-slate-500">
          {t(uiLocale, "settings.section.navigate")}
        </p>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <Link
            href="/settings"
            className="group flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <Globe className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-slate-900">
                {t(uiLocale, "settings.language.nav.backToSettings.title")}
              </span>
              <span className="mt-0.5 block truncate text-xs text-slate-500">
                {t(uiLocale, "settings.language.nav.backToSettings.description")}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
