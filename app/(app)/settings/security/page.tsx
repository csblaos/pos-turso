import Link from "next/link";
import { eq } from "drizzle-orm";
import {
  CheckCircle2,
  ChevronRight,
  Lock,
  ShieldAlert,
  Smartphone,
  UserRound,
} from "lucide-react";
import { redirect } from "next/navigation";

import { AccountPasswordSettings } from "@/components/app/account-password-settings";
import { AccountProfileSettings } from "@/components/app/account-profile-settings";
import { AccountSecurityHelpButton } from "@/components/app/account-security-help-button";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { t } from "@/lib/i18n/messages";
import { getUserPermissionsForCurrentSession, isPermissionGranted } from "@/lib/rbac/access";
import { getGlobalSessionPolicy } from "@/lib/system-config/policy";
import { type UiLocale, uiLocaleToDateLocale } from "@/lib/i18n/locales";

function formatDateTime(uiLocale: UiLocale, value: string | null) {
  if (!value) {
    return t(uiLocale, "settings.security.value.noHistory");
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(uiLocaleToDateLocale(uiLocale), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default async function SettingsSecurityPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  if (!session.activeStoreId) {
    redirect("/onboarding");
  }

  const permissionKeys = await getUserPermissionsForCurrentSession();
  const canViewSettings = isPermissionGranted(permissionKeys, "settings.view");
  const uiLocale = session.uiLocale;

  if (!canViewSettings) {
    return (
      <section className="space-y-3">
        <h1 className="text-xl font-semibold">{t(uiLocale, "settings.link.accountSecurity.title")}</h1>
        <p className="text-sm text-red-600">{t(uiLocale, "common.permissionDenied.viewPage")}</p>
        <Link href="/settings" className="text-sm font-medium text-blue-700 hover:underline">
          {t(uiLocale, "common.backToSettings")}
        </Link>
      </section>
    );
  }

  const [account, globalSessionPolicy] = await Promise.all([
    db
      .select({
        name: users.name,
        email: users.email,
        mustChangePassword: users.mustChangePassword,
        passwordUpdatedAt: users.passwordUpdatedAt,
        sessionLimit: users.sessionLimit,
      })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    getGlobalSessionPolicy(),
  ]);

  if (!account) {
    return (
      <section className="space-y-3">
        <h1 className="text-xl font-semibold">{t(uiLocale, "settings.link.accountSecurity.title")}</h1>
        <p className="text-sm text-red-600">{t(uiLocale, "settings.account.error.notFound")}</p>
        <Link href="/settings" className="text-sm font-medium text-blue-700 hover:underline">
          {t(uiLocale, "common.backToSettings")}
        </Link>
      </section>
    );
  }

  const effectiveSessionLimit = account.sessionLimit ?? globalSessionPolicy.defaultSessionLimit;
  const passwordStatus = account.mustChangePassword
    ? t(uiLocale, "settings.security.passwordStatus.mustChange")
    : t(uiLocale, "settings.security.passwordStatus.normal");
  const passwordStatusToneClassName = account.mustChangePassword
    ? "border-amber-200 bg-amber-50 text-amber-700"
    : "border-emerald-200 bg-emerald-50 text-emerald-700";
  const numberLocale = uiLocaleToDateLocale(uiLocale);

  return (
    <section className="space-y-2">
      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {t(uiLocale, "settings.link.accountSecurity.title")}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">{t(uiLocale, "settings.security.subtitle")}</p>
          </div>
          <AccountSecurityHelpButton uiLocale={uiLocale} />
        </div>

        <div className="space-y-4 px-4 py-4">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            <div className="border-b border-slate-200 px-4 py-3">
              <p className="text-sm font-medium text-slate-900">
                {t(uiLocale, "settings.security.section.account")}
              </p>
            </div>
            <ul className="divide-y divide-slate-200">
              <li className="flex min-h-14 items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{account.name}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{account.email}</p>
                </div>
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700">
                  User
                </span>
              </li>
              <li className="flex min-h-14 items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">
                    {t(uiLocale, "settings.security.passwordStatus.label")}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {t(uiLocale, "settings.security.passwordStatus.updatedAtPrefix")}{" "}
                    {formatDateTime(uiLocale, account.passwordUpdatedAt)}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${passwordStatusToneClassName}`}
                >
                  {passwordStatus}
                </span>
              </li>
              <li className="flex min-h-14 items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">
                    {t(uiLocale, "settings.security.sessionLimit.label")}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {t(uiLocale, "settings.security.sessionLimit.description")}
                  </p>
                </div>
                <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700">
                  {t(uiLocale, "settings.security.sessionLimit.badge.prefix")}{" "}
                  {effectiveSessionLimit.toLocaleString(numberLocale)}{" "}
                  {t(uiLocale, "settings.security.sessionLimit.badge.suffix")}
                </span>
              </li>
            </ul>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <AccountPasswordSettings mustChangePassword={account.mustChangePassword} embedded />
            <div className="border-t border-slate-100">
              <AccountProfileSettings initialName={account.name} email={account.email} embedded />
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-4 py-3">
              <p className="text-sm font-medium text-slate-900">
                {t(uiLocale, "settings.security.section.tips")}
              </p>
            </div>
            <ul className="divide-y divide-slate-100">
              <li className="flex min-h-14 items-start gap-3 px-4 py-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">
                    {t(uiLocale, "settings.security.tip.publicDevice.title")}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {t(uiLocale, "settings.security.tip.publicDevice.description")}
                  </p>
                </div>
              </li>
              <li className="flex min-h-14 items-start gap-3 px-4 py-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                  <ShieldAlert className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">
                    {t(uiLocale, "settings.security.tip.suspiciousActivity.title")}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {t(uiLocale, "settings.security.tip.suspiciousActivity.description")}
                  </p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </article>

      <div className="space-y-2">
        <p className="px-1 text-[11px] font-semibold uppercase text-slate-500">
          {t(uiLocale, "settings.section.navigate")}
        </p>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <Link
            href="/settings/profile"
            className="group flex min-h-14 items-center gap-3 border-b border-slate-100 px-4 py-3 transition-colors hover:bg-slate-50"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <UserRound className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-slate-900">
                {t(uiLocale, "settings.link.accountProfile.title")}
              </span>
              <span className="mt-0.5 block truncate text-xs text-slate-500">
                {t(uiLocale, "settings.link.accountProfile.description")}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />
          </Link>

          <Link
            href="/settings/notifications"
            className="group flex min-h-14 items-center gap-3 border-b border-slate-100 px-4 py-3 transition-colors hover:bg-slate-50"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <Smartphone className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-slate-900">
                {t(uiLocale, "settings.link.accountNotifications.title")}
              </span>
              <span className="mt-0.5 block truncate text-xs text-slate-500">
                {t(uiLocale, "settings.link.accountNotifications.description")}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />
          </Link>

          <Link
            href="/settings"
            className="group flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <Lock className="h-4 w-4" />
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
