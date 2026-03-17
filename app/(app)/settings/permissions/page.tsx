import Link from "next/link";
import { CheckCircle2, ChevronRight, Shield } from "lucide-react";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";
import {
  getUserPermissionsForCurrentSession,
  isPermissionGranted,
} from "@/lib/rbac/access";
import { buildUserCapabilities } from "@/lib/settings/account-capabilities";
import { t } from "@/lib/i18n/messages";
import { uiLocaleToDateLocale } from "@/lib/i18n/locales";

export default async function SettingsPermissionsPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  if (!session.activeStoreId) {
    redirect("/onboarding");
  }

  const permissionKeys = await getUserPermissionsForCurrentSession();
  const canViewSettings = isPermissionGranted(permissionKeys, "settings.view");
  const canViewTechnicalPermissions = isPermissionGranted(
    permissionKeys,
    "rbac.permissions.view",
  );
  const uiLocale = session.uiLocale;

  if (!canViewSettings) {
    return (
      <section className="space-y-3">
        <h1 className="text-xl font-semibold">{t(uiLocale, "settings.link.accountPermissions.title")}</h1>
        <p className="text-sm text-red-600">{t(uiLocale, "common.permissionDenied.viewPage")}</p>
        <Link href="/settings" className="text-sm font-medium text-blue-700 hover:underline">
          {t(uiLocale, "common.backToSettings")}
        </Link>
      </section>
    );
  }

  const userCapabilities = buildUserCapabilities(permissionKeys, uiLocale);
  const grantedCapabilitiesCount = userCapabilities.filter(
    (capability) => capability.granted,
  ).length;
  const grantedCapabilities = userCapabilities.filter((capability) => capability.granted);
  const filteredTechnicalKeys = grantedCapabilities.map((capability) => capability.id);
  const numberLocale = uiLocaleToDateLocale(uiLocale);

  return (
    <section className="space-y-5">
      <header className="space-y-1 px-1">
        <h1 className="text-[28px] font-semibold tracking-tight text-slate-900">
          {t(uiLocale, "settings.link.accountPermissions.title")}
        </h1>
        <p className="text-sm text-slate-500">
          {t(uiLocale, "settings.permissions.subtitle")}
        </p>
      </header>

      <div className="space-y-2">
        <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {t(uiLocale, "settings.permissions.section.summary")}
        </p>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="px-4 py-3">
            <p className="text-sm font-medium text-slate-900">
              {t(uiLocale, "settings.permissions.summary.granted.prefix")}{" "}
              {grantedCapabilitiesCount.toLocaleString(numberLocale)}{" "}
              {t(uiLocale, "settings.permissions.summary.granted.suffix")}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {t(uiLocale, "settings.permissions.summary.hint")}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {t(uiLocale, "settings.permissions.section.granted")}
        </p>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-xs text-slate-500">
              {t(uiLocale, "settings.permissions.granted.showing.prefix")}{" "}
              {grantedCapabilities.length.toLocaleString(numberLocale)}{" "}
              {t(uiLocale, "settings.permissions.granted.showing.suffix")}
            </p>
          </div>
          {grantedCapabilities.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {grantedCapabilities.map((capability) => (
                <li
                  key={capability.id}
                  className="flex min-h-14 items-start justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">{capability.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{capability.description}</p>
                  </div>
                  <span
                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {t(uiLocale, "settings.permissions.badge.allowed")}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-sm text-slate-500">
              {t(uiLocale, "settings.permissions.empty")}
            </p>
          )}
          {canViewTechnicalPermissions ? (
            <details className="border-t border-slate-100 bg-slate-50 px-4 py-3">
              <summary className="cursor-pointer text-xs font-medium text-slate-700">
                {t(uiLocale, "settings.permissions.technical.toggle")}
              </summary>
              {filteredTechnicalKeys.length > 0 ? (
                <ul className="mt-2 space-y-1 text-xs text-slate-600">
                  {filteredTechnicalKeys.map((permissionKey) => (
                    <li key={permissionKey}>{permissionKey}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-slate-500">
                  {t(uiLocale, "settings.permissions.technical.empty")}
                </p>
              )}
            </details>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {t(uiLocale, "settings.section.navigate")}
        </p>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <Link
            href="/settings"
            className="group flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <Shield className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-slate-900">
                {t(uiLocale, "common.backToSettings")}
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">
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
