import Link from "next/link";
import { Bell, ChevronRight, Shield } from "lucide-react";
import { redirect } from "next/navigation";

import { AccountNotificationsHelpButton } from "@/components/app/account-notifications-help-button";
import { NotificationsInboxPanel } from "@/components/app/notifications-inbox-panel";
import {
  getUserPermissionsForCurrentSession,
  isPermissionGranted,
} from "@/lib/rbac/access";
import { getSession } from "@/lib/auth/session";
import { t } from "@/lib/i18n/messages";

export default async function SettingsNotificationsPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  if (!session.activeStoreId) {
    redirect("/onboarding");
  }

  const permissionKeys = await getUserPermissionsForCurrentSession();
  const canViewSettings = isPermissionGranted(permissionKeys, "settings.view");
  const canManageRules = isPermissionGranted(permissionKeys, "settings.update");
  const uiLocale = session.uiLocale;

  if (!canViewSettings) {
    return (
      <section className="space-y-3">
        <h1 className="text-xl font-semibold">{t(uiLocale, "settings.link.accountNotifications.title")}</h1>
        <p className="text-sm text-red-600">{t(uiLocale, "common.permissionDenied.viewPage")}</p>
        <Link
          href="/settings"
          className="text-sm font-medium text-blue-700 hover:underline"
        >
          {t(uiLocale, "common.backToSettings")}
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-2">
      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {t(uiLocale, "settings.link.accountNotifications.title")}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {t(uiLocale, "settings.link.accountNotifications.description")}
            </p>
          </div>
          <AccountNotificationsHelpButton uiLocale={uiLocale} />
        </div>

        <div className="space-y-4 px-4 py-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-600">
              {t(uiLocale, "settings.notifications.cronHint")}
            </p>
          </div>

          <NotificationsInboxPanel canManageRules={canManageRules} />
        </div>
      </article>

      <div className="space-y-2">
        <p className="px-1 text-[11px] font-semibold uppercase text-slate-500">
          {t(uiLocale, "settings.section.navigate")}
        </p>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <Link
            href="/settings/security"
            className="group flex min-h-14 items-center gap-3 border-b border-slate-100 px-4 py-3 transition-colors hover:bg-slate-50"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <Shield className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-slate-900">
                {t(uiLocale, "settings.link.accountSecurity.title")}
              </span>
              <span className="mt-0.5 block truncate text-xs text-slate-500">
                {t(uiLocale, "settings.link.accountSecurity.description")}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />
          </Link>

          <Link
            href="/settings"
            className="group flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <Bell className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-slate-900">
                {t(uiLocale, "common.backToSettings")}
              </span>
              <span className="mt-0.5 block truncate text-xs text-slate-500">
                {t(uiLocale, "common.backToSettings.description")}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
